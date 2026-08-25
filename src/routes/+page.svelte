<script>
	import VoiceRecorder from '$lib/VoiceRecorder.svelte';
	let { data } = $props();
</script>

<svelte:head><title>{data.user ? 'My Speaking AI' : '로그인 | My Speaking AI'}</title></svelte:head>

{#if !data.user}
	<main class="min-h-screen bg-slate-100 px-4 py-12">
		<div class="mx-auto max-w-lg text-center">
			<h1 class="text-2xl font-bold tracking-tight text-slate-900">My Speaking AI</h1>
			<p class="mt-2 text-slate-600">대화를 시작하려면 로그인해 주세요.</p>
			<button class="mt-6 rounded-lg bg-slate-900 px-5 py-2 font-medium text-white" type="button" onclick={() => (window.location.href = '/login')}>로그인 / 회원가입</button>
		</div>
	</main>
{:else}
<main class="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-12">
	<div class="mx-auto max-w-lg text-center">
		<h1 class="text-2xl font-bold tracking-tight text-slate-900">My Speaking AI</h1>
		<p class="mt-2 text-slate-600">녹음 · 확인</p>
	</div>

	<div class="mx-auto mt-8 max-w-lg">
		<VoiceRecorder />
	</div>
</main>
{/if}
