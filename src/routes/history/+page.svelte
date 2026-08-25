<script>
	import { onMount } from 'svelte';

	let conversations = $state([]);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		const controller = new AbortController();
		const timeoutId = window.setTimeout(() => controller.abort(), 10000);

		try {
			const response = await fetch('/api/conversations', { signal: controller.signal });
			const result = await response.json();
			if (response.ok) {
				conversations = result.conversations;
			} else {
				error = result.error || '대화 기록을 불러오지 못했습니다.';
			}
		} catch (loadError) {
			error = loadError.name === 'AbortError'
				? '대화 기록 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.'
				: '대화 기록 서버에 연결하지 못했습니다.';
		} finally {
			window.clearTimeout(timeoutId);
			loading = false;
		}
	});

	async function removeConversation(id) {
		if (!window.confirm('이 대화를 삭제할까요?')) return;
		const response = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
		if (response.ok) conversations = conversations.filter((conversation) => conversation.id !== id);
		else error = '대화를 삭제하지 못했습니다.';
	}
</script>

<svelte:head><title>대화 기록 | My Speaking AI</title></svelte:head>

<main class="min-h-screen bg-slate-100 px-4 py-10">
	<div class="mx-auto max-w-2xl">
		<div class="flex items-end justify-between">
			<div>
				<h1 class="text-2xl font-bold text-slate-900">대화 기록</h1>
				<p class="mt-1 text-sm text-slate-500">저장된 영어회화 세션입니다.</p>
			</div>
			<button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="button" onclick={() => (window.location.href = '/')}>새 대화</button>
		</div>

		{#if error}<p class="mt-6 text-sm text-red-600">{error}</p>{/if}
		{#if loading}
			<p class="mt-10 text-center text-slate-500">불러오는 중...</p>
		{:else if conversations.length === 0}
			<p class="mt-10 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">저장된 대화가 없습니다.</p>
		{:else}
			<div class="mt-6 space-y-3">
				{#each conversations as conversation (conversation.id)}
					<article class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
						<div class="flex items-start justify-between gap-4">
							<div>
								<h2 class="font-semibold text-slate-900">{conversation.title}</h2>
								<p class="mt-1 text-xs text-slate-500">{new Date(conversation.created_at).toLocaleString('ko-KR')} · {conversation.duration_seconds}초</p>
							</div>
							<button class="text-sm text-red-600" type="button" onclick={() => removeConversation(conversation.id)}>삭제</button>
						</div>
						<div class="mt-4 space-y-2 border-t border-slate-100 pt-3">
							{#each [...conversation.conversation_messages].sort((a, b) => a.sequence - b.sequence) as message (message.id)}
								<p class="text-sm text-slate-700"><strong>{message.role === 'user' ? '나' : 'AI'}:</strong> {message.content}</p>
							{/each}
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</div>
</main>