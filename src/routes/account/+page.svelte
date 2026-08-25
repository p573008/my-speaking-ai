<script>
	import { supabase } from '$lib/supabase/client';

	let password = $state('');
	let message = $state('');
	let error = $state('');
	let loading = $state(false);

	async function updatePassword() {
		loading = true;
		message = '';
		error = '';
		const { error: updateError } = await supabase.auth.updateUser({ password });
		if (updateError) error = updateError.message;
		else message = '비밀번호가 변경되었습니다.';
		loading = false;
	}
</script>

<svelte:head><title>계정 관리 | My Speaking AI</title></svelte:head>

<main class="min-h-screen bg-slate-100 px-4 py-10">
	<div class="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm">
		<h1 class="text-2xl font-bold text-slate-900">계정 관리</h1>
		<p class="mt-2 text-sm text-slate-500">비밀번호를 변경할 수 있습니다.</p>
		<form class="mt-8 space-y-4" onsubmit={(event) => { event.preventDefault(); updatePassword(); }}>
			<label class="block text-sm font-medium text-slate-700">
				새 비밀번호
				<input class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="password" minlength="6" bind:value={password} required />
			</label>
			{#if error}<p class="text-sm text-red-600">{error}</p>{/if}
			{#if message}<p class="text-sm text-emerald-600">{message}</p>{/if}
			<button class="w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50" type="submit" disabled={loading}>
				{loading ? '변경 중...' : '비밀번호 변경'}
			</button>
		</form>
	</div>
</main>