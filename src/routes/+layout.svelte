<script>
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { supabase } from '$lib/supabase/client';
	import { resolve } from '$app/paths';

	let { data, children } = $props();

	async function signOut() {
		await supabase.auth.signOut();
		window.location.href = '/login';
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{#if data.user}
	<header class="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
		<button class="font-semibold text-slate-900" type="button" onclick={() => (window.location.href = '/')}>My Speaking AI</button>
		<div class="flex items-center gap-3 text-sm text-slate-600">
			<span>{data.user.email}</span>
			<a class="rounded-md border border-slate-300 px-3 py-1.5" href={resolve('/history')}>기록</a>
			<a class="rounded-md border border-slate-300 px-3 py-1.5" href={resolve('/account')}>계정</a>
			<a class="rounded-md border border-slate-300 px-3 py-1.5" href={`${resolve('/login')}?mode=signup`}>회원가입</a>
			<button class="rounded-md border border-slate-300 px-3 py-1.5" type="button" onclick={signOut}>로그아웃</button>
		</div>
	</header>
{/if}
{@render children()}
