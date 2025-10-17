<script>
	import { supabase } from '$lib/supabaseClient';
	import { authUser } from '$lib/authStore';
	import { goto } from '$app/navigation';

	async function signOut() {
		await supabase.auth.signOut();
		goto('/');
	}
</script>

<header>
	{#if $authUser}
		<span>Signed in as {$authUser.email}</span>
		<button on:click={signOut}>Sign out</button>
	{:else}
		<a href="/signin">Sign in</a>
	{/if}
</header>

<main>
	welcome to layout
	<slot />
</main>