<script>
	import { onDestroy } from 'svelte';

	// 상태 관리
	let isConnecting = $state(false);
	let isConnected = $state(false);
	let isMuted = $state(false);
	let error = $state(/** @type {string | null} */ (null));
	let elapsedSec = $state(0);
	
	/** @type {RTCPeerConnection | null} */
	let pc = $state(null);
	/** @type {RTCDataChannel | null} */
	let dc = $state(null);
	/** @type {MediaStream | null} */
	let localStream = $state(null);
	/** @type {HTMLAudioElement | null} */
	let remoteAudioEl = $state(null);
	/** @type {ReturnType<typeof setInterval> | null} */
	let timerId = $state(null);

	// 대화 기록 상태 ({ role: 'user' | 'ai', text: string, ts: number })
	/** @type {Array<{role: 'user' | 'ai', text: string, ts: number}>} */
	let chatHistory = $state([]);
	let currentAiTranscript = $state('');
	let conversationId = $state(null);
	let messageSequence = $state(0);

	async function addChatEntry(role, text) {
		const cleanText = text?.trim();
		if (!cleanText) return;
		chatHistory = [...chatHistory, { role, text: cleanText, ts: Date.now() }];
		if (conversationId) {
			const sequence = messageSequence;
			messageSequence += 1;
			const response = await fetch(`/api/conversations/${conversationId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					role: role === 'ai' ? 'assistant' : 'user',
					content: cleanText,
					sequence
				})
			});
			if (!response.ok) error = '대화 내용을 저장하지 못했습니다.';
		}
	}

	function extractTranscriptText(event) {
		if (typeof event?.delta === 'string' && event.delta.trim()) return event.delta;
		if (typeof event?.transcript === 'string' && event.transcript.trim()) return event.transcript;
		if (Array.isArray(event?.delta)) {
			const text = event.delta.map(item => typeof item?.text === 'string' ? item.text : '').join('');
			if (text.trim()) return text;
		}
		if (Array.isArray(event?.item?.content)) {
			const text = event.item.content
				.map(item => typeof item?.text === 'string' ? item.text : '')
				.join('');
			if (text.trim()) return text;
		}
		return '';
	}

	// 웨이브폼 캔버스 관련
	/** @type {HTMLCanvasElement | null} */
	let canvasEl = $state(null);
	/** @type {number | null} */
	let animationId = $state(null);
	/** @type {AudioContext | null} */
	let audioContext = $state(null);
	/** @type {AnalyserNode | null} */
	let analyser = $state(null);
	const BAR_COUNT = 48;

	// 자동 스크롤을 위한 엘리먼트 참조
	/** @type {HTMLDivElement | null} */
	let chatContainerEl = $state(null);

	// 효과음 재생용 함수 (연결 시작/종료 효과음으로 UX 향상)
	function playSound(type) {
		try {
			const ctx = new (window.AudioContext || window.webkitAudioContext)();
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.connect(gain);
			gain.connect(ctx.destination);

			if (type === 'start') {
				osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
				osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15); // G5
				gain.gain.setValueAtTime(0.08, ctx.currentTime);
				gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
				osc.start();
				osc.stop(ctx.currentTime + 0.2);
			} else if (type === 'stop') {
				osc.frequency.setValueAtTime(783.99, ctx.currentTime); // G5
				osc.frequency.exponentialRampToValueAtTime(392.00, ctx.currentTime + 0.15); // G4
				gain.gain.setValueAtTime(0.08, ctx.currentTime);
				gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
				osc.start();
				osc.stop(ctx.currentTime + 0.2);
			}
		} catch (e) {
			// 오디오 컨텍스트 차단 등의 사유로 소리 재생 실패 시 무시
		}
	}

	// 타이머 관리
	function startTimer() {
		stopTimer();
		elapsedSec = 0;
		timerId = setInterval(() => {
			elapsedSec += 1;
		}, 1000);
	}

	function stopTimer() {
		if (timerId !== null) {
			clearInterval(timerId);
			timerId = null;
		}
	}

	function formatTime(sec) {
		const m = Math.floor(sec / 60);
		const s = sec % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	// 채팅 내역이 추가되거나 업데이트될 때 자동 스크롤
	$effect(() => {
		if (chatContainerEl && (chatHistory.length || currentAiTranscript)) {
			chatContainerEl.scrollTo({
				top: chatContainerEl.scrollHeight,
				behavior: 'smooth'
			});
		}
	});

	// 마이크 실시간 음파 시각화 (Canvas)
	function startWaveformVisualization(stream) {
		stopWaveformVisualization();

		try {
			audioContext = new (window.AudioContext || window.webkitAudioContext)();
			analyser = audioContext.createAnalyser();
			analyser.fftSize = 256;

			const source = audioContext.createMediaStreamSource(stream);
			source.connect(analyser);

			const bufferLength = analyser.frequencyBinCount;
			const dataArray = new Uint8Array(bufferLength);

			const draw = () => {
				if (!isConnected || !analyser || !canvasEl) return;

				analyser.getByteFrequencyData(dataArray);
				
				const canvas = canvasEl;
				const ctx = canvas.getContext('2d');
				if (!ctx) return;

				// 캔버스 크기 반응형 초기화
				const rect = canvas.getBoundingClientRect();
				const dpr = window.devicePixelRatio || 1;
				canvas.width = rect.width * dpr;
				canvas.height = rect.height * dpr;
				ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

				const width = rect.width;
				const height = rect.height;
				ctx.clearRect(0, 0, width, height);

				const barWidth = width / BAR_COUNT;
				const gap = 3;

				for (let i = 0; i < BAR_COUNT; i++) {
					// 대칭형 주파수 데이터 매핑
					const index = Math.abs(i - BAR_COUNT / 2) * 2;
					const value = (dataArray[index] ?? 0) / 255;
					// 기본 굴곡 제공 및 음소거 시 미동 방지
					const barHeight = Math.max(3, isMuted ? 3 : value * height * 0.75);
					const x = i * barWidth + gap / 2;
					const y = (height - barHeight) / 2;

					// 그라디언트 채우기
					const grad = ctx.createLinearGradient(x, y, x, y + barHeight);
					grad.addColorStop(0, '#6366f1'); // Indigo
					grad.addColorStop(0.5, '#a855f7'); // Purple
					grad.addColorStop(1, '#6366f1');

					ctx.fillStyle = isMuted ? '#94a3b8' : grad;
					
					ctx.beginPath();
					if (ctx.roundRect) {
						ctx.roundRect(x, y, barWidth - gap, barHeight, 4);
					} else {
						ctx.rect(x, y, barWidth - gap, barHeight);
					}
					ctx.fill();
				}

				animationId = requestAnimationFrame(draw);
			};

			draw();
		} catch (e) {
			console.error('웨이브폼 초기화 실패:', e);
		}
	}

	function stopWaveformVisualization() {
		if (animationId !== null) {
			cancelAnimationFrame(animationId);
			animationId = null;
		}
		if (audioContext) {
			audioContext.close();
			audioContext = null;
		}
		analyser = null;

		// 캔버스 초기 상태로 복구
		if (canvasEl) {
			const ctx = canvasEl.getContext('2d');
			if (ctx) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
		}
	}

	// 실시간 세션 시작
	async function startSession() {
		if (isConnecting || isConnected) return;

		isConnecting = true;
		error = null;
		chatHistory = [];
		currentAiTranscript = '';
		conversationId = null;
		messageSequence = 0;
		
		try {
			// 1. 데이터베이스에 대화 세션 생성
			const conversationRes = await fetch('/api/conversations', { method: 'POST' });
			const conversationData = await conversationRes.json();
			if (!conversationRes.ok || !conversationData.conversationId) {
				throw new Error(conversationData.error || '대화 세션을 생성하지 못했습니다.');
			}
			conversationId = conversationData.conversationId;

			// 2. 백엔드로부터 임시 토큰 받아오기
			const tokenRes = await fetch('/api/session', { method: 'POST' });
			if (!tokenRes.ok) {
				const errData = await tokenRes.json();
				throw new Error(errData.error || '임시 세션 토큰 발급에 실패했습니다.');
			}
			console.log("voice recorder - Token received");

			const sessionData = await tokenRes.json();
			const EPHEMERAL_KEY = sessionData.client_secret.value;

			// 2. Peer Connection 생성
			pc = new RTCPeerConnection();

			// AI 오디오 스트림 수신 처리
			remoteAudioEl = document.createElement('audio');
			remoteAudioEl.autoplay = true;
			
			pc.ontrack = (e) => {
				if (remoteAudioEl) {
					remoteAudioEl.srcObject = e.streams[0];
				}
			};

			// 3. 로컬 마이크 오디오 트랙 추가
			localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
			localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

			// 음소거 상태 동기화
			if (isMuted) {
				localStream.getAudioTracks().forEach(t => t.enabled = false);
			}

			// 4. 데이터 채널 개설
			dc = pc.createDataChannel('oai-events');
			
			dc.onopen = () => {
				console.log('데이터 채널 연결됨');
			};

			dc.onmessage = async (e) => {
				try {
					const event = JSON.parse(e.data);
						if (typeof event?.type === 'string') {
							console.log('Realtime event:', event.type, event);
						}
						
						// AI가 답변 생성을 시작할 때
						if (event.type === 'response.created') {
							currentAiTranscript = '';
						}
						
						const isAiTranscriptDelta =
							event.type?.includes('transcript') &&
							event.type?.includes('delta');
						if (isAiTranscriptDelta) {
							const deltaText = extractTranscriptText(event);
							if (deltaText) {
								currentAiTranscript += deltaText;
							}
						}

						const isAiTranscriptDone =
							event.type?.includes('transcript') &&
							event.type?.includes('done');
						if (isAiTranscriptDone) {
							const finalText = extractTranscriptText(event) || currentAiTranscript.trim();
							if (finalText.trim()) {
								await addChatEntry('ai', finalText.trim());
							}
							currentAiTranscript = '';
						}

						// 사용자가 말한 내용의 실시간 텍스트 전사(Whisper) 완료 수신
						if (event.type === 'conversation.item.input_audio_transcription.completed') {
							const text = extractTranscriptText(event);
							if (text.trim()) await addChatEntry('user', text.trim());
					}
				} catch (err) {
					console.error('메시지 파싱 실패:', err);
				}
			};

			// 5. SDP Offer 생성 및 설정
			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);

			console.log("voice recorder", EPHEMERAL_KEY);

			// 6. OpenAI 서버로 SDP Offer 전달하여 Answer 교환
			const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
				method: 'POST',
				body: offer.sdp,
				headers: {
					'Authorization': `Bearer ${EPHEMERAL_KEY}`,
					'Content-Type': 'application/sdp'
				}
			});

			if (!sdpResponse.ok) {
				const rawError = await sdpResponse.text();
				throw new Error(`OpenAI 연결 실패: ${rawError || sdpResponse.statusText}`);
			}
			console.log("voice recorder - SDP Answer received");

			const answerSdp = await sdpResponse.text();
			if (!answerSdp.trim().startsWith('v=')) {
				throw new Error(`OpenAI가 올바른 SDP 답변을 반환하지 않았습니다: ${answerSdp.slice(0, 200)}`);
			}
			
			// 7. SDP Answer 설정 완료
			await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

			isConnected = true;
			playSound('start');
			startTimer();
			startWaveformVisualization(localStream);

		} catch (e) {
			console.error(e);
			const errMsg = e instanceof Error ? e.message : String(e);
			error = errMsg || '마이크에 접근할 수 없거나 서버 연결에 실패했습니다.';
			cleanup();
		} finally {
			isConnecting = false;
		}
	}

	// 세션 종료 및 리소스 정리
	async function stopSession() {
		if (isConnected) {
			playSound('stop');
		}
		if (conversationId) {
			await fetch(`/api/conversations/${conversationId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: 'completed', durationSeconds: elapsedSec })
			});
		}
		cleanup();
	}

	function cleanup() {
		stopTimer();
		stopWaveformVisualization();

		if (dc) {
			dc.close();
			dc = null;
		}

		if (pc) {
			pc.close();
			pc = null;
		}

		if (localStream) {
			localStream.getTracks().forEach((track) => track.stop());
			localStream = null;
		}

		if (remoteAudioEl) {
			remoteAudioEl.pause();
			remoteAudioEl.srcObject = null;
			remoteAudioEl = null;
		}

		isConnected = false;
	}

	// 마이크 음소거 토글
	function toggleMute() {
		isMuted = !isMuted;
		if (localStream) {
			localStream.getAudioTracks().forEach((track) => {
				track.enabled = !isMuted;
			});
		}
	}

	onDestroy(() => {
		cleanup();
	});
</script>

<svelte:window onresize={() => isConnected && localStream && startWaveformVisualization(localStream)} />

<div class="mx-auto w-full max-w-lg rounded-3xl border border-slate-200/80 bg-white/70 backdrop-blur-xl p-6 shadow-xl transition-all duration-300">
	<!-- 헤더 영역 -->
	<div class="flex items-center justify-between border-b border-slate-100 pb-4">
		<div>
			<h2 class="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
				Speaking Partner AI
				{#if isConnected}
					<span class="relative flex h-2 w-2">
						<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
						<span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
					</span>
				{/if}
			</h2>
			<p class="text-xs font-medium text-slate-500 mt-0.5">OpenAI Realtime WebRTC 영어회화</p>
		</div>
		
		<!-- 상태 인디케이터 배지 -->
		<div>
			{#if isConnecting}
				<span class="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/10 animate-pulse">
					연결 요청 중...
				</span>
			{:else if isConnected}
				<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
					대화 중: {formatTime(elapsedSec)}
				</span>
			{:else}
				<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
					준비 완료
				</span>
			{/if}
		</div>
	</div>

	<!-- 실시간 음파 시각화 (Canvas) 영역 -->
	<div class="mt-6 flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all relative overflow-hidden">
		<canvas bind:this={canvasEl} class="h-20 w-full transition-all"></canvas>
		<p class="mt-3 text-center text-xs font-medium tracking-wide text-slate-400">
			{#if isConnecting}
				OpenAI Realtime 서버와 연결을 설정하고 있습니다.
			{:else if isConnected}
				{#if isMuted}
					마이크 음소거 상태입니다.
				{:else}
					자유롭게 영어로 말을 건네보세요.
				{/if}
			{:else}
				<!--아래 통화 시작 버튼을 클릭해 대화를 시작하세요.-->
				아래 영어회화 시작 버튼을 클릭해 대화를 시작하세요.
			{/if}
		</p>
	</div>

	<!-- 대화 자막(Transcript) 영역 -->
	<div class="mt-6">
		<div class="flex items-center justify-between px-1 mb-2">
			<span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">실시간 자막 (Transcript)</span>
			<button 
				type="button" 
				onclick={() => chatHistory = []} 
				disabled={chatHistory.length === 0}
				class="text-xs text-slate-400 hover:text-slate-600 transition disabled:opacity-40 disabled:hover:text-slate-400"
			>
				기록 지우기
			</button>
		</div>
		
		<div 
			bind:this={chatContainerEl}
			class="h-64 overflow-y-auto rounded-2xl border border-slate-150 bg-slate-50/30 p-4 flex flex-col gap-3 shadow-inner"
		>
			{#if chatHistory.length === 0 && !currentAiTranscript}
				<div class="m-auto text-center text-sm text-slate-400/80 px-4">
					<svg class="mx-auto h-8 w-8 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
					</svg>
					말씀하신 대화와 AI의 답변이 여기에 실시간 텍스트 자막으로 기록됩니다.
				</div>
			{/if}

			{#each [...chatHistory].sort((a, b) => a.ts - b.ts) as chat}
				<div class="flex flex-col {chat.role === 'user' ? 'items-end' : 'items-start'}">
					<span class="text-[10px] font-medium text-slate-400 mb-0.5 px-1">
						{chat.role === 'user' ? '나 (You)' : 'AI Partner'}
					</span>
					<div class="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm transition-all {
						chat.role === 'user' 
							? 'bg-indigo-600 text-white rounded-tr-none' 
							: 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
					}">
						{chat.text}
					</div>
				</div>
			{/each}

			{#if currentAiTranscript}
				<div class="flex flex-col items-start">
					<span class="text-[10px] font-medium text-indigo-400 mb-0.5 px-1 animate-pulse">
						AI Partner (입력 중...)
					</span>
					<div class="max-w-[85%] rounded-2xl bg-indigo-50/60 border border-indigo-100/50 px-4 py-2.5 text-sm text-slate-700 rounded-tl-none animate-pulse">
						{currentAiTranscript}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- 에러 표시 -->
	{#if error}
		<div class="mt-4 rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-700 flex items-start gap-2.5 shadow-sm" role="alert">
			<svg class="h-5 w-5 text-rose-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
				<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
			</svg>
			<span>{error}</span>
		</div>
	{/if}

	<!-- 컨트롤러 버튼 인터페이스 -->
	<div class="mt-6 flex items-center justify-center gap-4">
		<!-- 음소거(Mute) 토글 버튼 -->
		<button
			type="button"
			onclick={toggleMute}
			disabled={!isConnected}
			class="flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-40 disabled:cursor-not-allowed {
				isMuted 
					? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100' 
					: 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
			}"
			aria-label={isMuted ? '음소거 해제' : '음소거'}
			title={isMuted ? '음소거 해제' : '음소거'}
		>
			{#if isMuted}
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
				</svg>
			{:else}
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
				</svg>
			{/if}
		</button>

		<!-- 통화 시작 / 종료 메인 제어 버튼 -->
		{#if isConnected}
			<button
				type="button"
				onclick={stopSession}
				class="flex h-14 px-8 items-center justify-center gap-2.5 rounded-2xl bg-rose-600 text-white font-semibold transition hover:bg-rose-500 shadow-md shadow-rose-600/20 active:scale-95 focus:outline-none focus:ring-4 focus:ring-rose-200"
			>
				<svg class="h-5 w-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
				</svg>
				대화 종료
			</button>
		{:else}
			<button
				type="button"
				onclick={startSession}
				disabled={isConnecting}
				class="flex h-14 px-8 items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold transition hover:opacity-95 shadow-md shadow-indigo-600/20 active:scale-95 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{#if isConnecting}
					<svg class="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					연결하는 중...
				{:else}
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
					</svg>
					영어회화 시작
				{/if}
			</button>
		{/if}
	</div>
</div>
