<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase/client';

	let mode = $state('login');
	let email = $state('');
	let password = $state('');
	let message = $state('');
	let error = $state('');
	let loading = $state(false);

	onMount(() => {
		if (new URLSearchParams(window.location.search).get('mode') === 'signup') {
			mode = 'signup';
		}
	});

	async function submit() {
		loading = true;
		message = '';
		error = '';

		const result =
			mode === 'login'
				? await supabase.auth.signInWithPassword({ email, password })
				: await supabase.auth.signUp({ email, password });

		if (result.error) {
			error = result.error.message;
		} else if (mode === 'signup' && !result.data.session) {
			message = '가입 확인 이메일을 확인해 주세요.';
		} else {
			window.location.href = '/';
		}

		loading = false;
	}
</script>

<svelte:head><title>{mode === 'login' ? '로그인' : '회원가입'} | My Speaking AI</title></svelte:head>

<main class="min-h-screen bg-slate-100 px-4 py-12">
	<div class="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm">
		<h1 class="text-2xl font-bold text-slate-900">My Speaking AI</h1>
		<p class="mt-2 text-slate-600">{mode === 'login' ? '계정에 로그인하세요.' : '새 계정을 만들어 보세요.'}</p>

		<form class="mt-8 space-y-4" onsubmit={(event) => { event.preventDefault(); submit(); }}>
			<label class="block text-sm font-medium text-slate-700">
				이메일
				<input class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="email" bind:value={email} required />
			</label>
			<label class="block text-sm font-medium text-slate-700">
				비밀번호
				<input class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="password" minlength="6" bind:value={password} required />
			</label>
			{#if error}<p class="text-sm text-red-600">{error}</p>{/if}
			{#if message}<p class="text-sm text-emerald-600">{message}</p>{/if}
			<button class="w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50" type="submit" disabled={loading}>
				{loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
			</button>
		</form>

		<button class="mt-5 text-sm text-slate-600 underline" type="button" onclick={() => { mode = mode === 'login' ? 'signup' : 'login'; error = ''; message = ''; }}>
			{mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
		</button>
	</div>
</main>