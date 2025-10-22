<script>
	import '../app.css';
	import { supabase } from '$lib/supabaseClient';
	import { authUser } from '$lib/authStore';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	async function signOut() {
		await supabase.auth.signOut();
		goto('/');
	}

	$: currentPath = $page.url.pathname;
</script>

<div class="min-h-screen flex flex-col">
	<!-- Header -->
	<header class="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
		<nav class="container py-4">
			<div class="flex items-center justify-between">
				<!-- Logo/Brand -->
				<a href="/" class="flex items-center gap-2 text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
					<svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
					</svg>
					<span>Supamail</span>
				</a>

				<!-- Navigation -->
				<div class="flex items-center gap-6">
					{#if $authUser}
						<!-- Main Nav Links -->
						<div class="hidden md:flex items-center gap-1">
							<a 
								href="/aliases" 
								class="px-4 py-2 rounded-lg font-medium transition-colors {currentPath === '/aliases' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
							>
								Aliases
							</a>
							<a 
								href="/messages" 
								class="px-4 py-2 rounded-lg font-medium transition-colors {currentPath === '/messages' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
							>
								Messages
							</a>
						</div>

						<!-- User Menu -->
						<div class="flex items-center gap-4">
							<span class="hidden sm:block text-sm text-gray-600">
								{$authUser.email}
							</span>
							<button 
								on:click={signOut}
								class="btn-secondary text-sm"
							>
								Sign out
							</button>
						</div>
					{:else}
						<a href="/signin" class="btn-primary">
							Sign in
						</a>
					{/if}
				</div>
			</div>

			<!-- Mobile Nav -->
			{#if $authUser}
				<div class="flex md:hidden gap-2 mt-4 border-t border-gray-200 pt-4">
					<a 
						href="/aliases" 
						class="flex-1 px-4 py-2 text-center rounded-lg font-medium transition-colors {currentPath === '/aliases' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
					>
						Aliases
					</a>
					<a 
						href="/messages" 
						class="flex-1 px-4 py-2 text-center rounded-lg font-medium transition-colors {currentPath === '/messages' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
					>
						Messages
					</a>
				</div>
			{/if}
		</nav>
	</header>

	<!-- Main Content -->
	<main class="flex-1 container py-8">
		<slot />
	</main>

	<!-- Footer -->
	<footer class="bg-white border-t border-gray-200 mt-auto">
		<div class="container py-6">
			<div class="flex flex-col md:flex-row items-center justify-between gap-4">
				<p class="text-sm text-gray-600">
					© {new Date().getFullYear()} Supamail. All rights reserved.
				</p>
				<div class="flex items-center gap-6">
					<a href="/about" class="text-sm text-gray-600 hover:text-gray-900 transition-colors">
						About
					</a>
					<a href="#" class="text-sm text-gray-600 hover:text-gray-900 transition-colors">
						Privacy
					</a>
					<a href="#" class="text-sm text-gray-600 hover:text-gray-900 transition-colors">
						Terms
					</a>
				</div>
			</div>
		</div>
	</footer>
</div>