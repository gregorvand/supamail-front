<script>
	import { authUser } from '$lib/authStore';
</script>

<div class="max-w-6xl mx-auto">
	{#if $authUser}
		<!-- Authenticated Home -->
		<div class="space-y-8">
			<!-- Welcome Section -->
			<div class="text-center py-12">
				<h1 class="mb-4">Welcome back!</h1>
				<p class="text-xl text-gray-600">
					Manage your email aliases and messages
				</p>
			</div>

			<!-- Quick Actions -->
			<div class="grid md:grid-cols-2 gap-6">
				<a href="/aliases" class="card group cursor-pointer hover:border-blue-200">
					<div class="flex items-start gap-4">
						<div class="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
							<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
							</svg>
						</div>
						<div class="flex-1">
							<h3 class="mb-2 group-hover:text-blue-600 transition-colors">Email Aliases</h3>
							<p class="text-gray-600">Create and manage your email aliases for better privacy</p>
						</div>
					</div>
				</a>

				<a href="/messages" class="card group cursor-pointer hover:border-blue-200">
					<div class="flex items-start gap-4">
						<div class="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
							<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
							</svg>
						</div>
						<div class="flex-1">
							<h3 class="mb-2 group-hover:text-green-600 transition-colors">Messages</h3>
							<p class="text-gray-600">View and manage messages sent to your aliases</p>
						</div>
					</div>
				</a>
			</div>
		</div>
	{:else}
		<!-- Unauthenticated Home (Landing Page) -->
		<div class="space-y-16">
			<!-- Hero Section -->
			<div class="text-center py-20">
				<div class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-8">
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
					</svg>
					Privacy-focused email management
				</div>
				
				<h1 class="mb-6">
					Protect Your Inbox with<br />
					<span class="text-blue-600">Smart Email Aliases</span>
				</h1>
				
				<p class="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
					Create unlimited email aliases to keep your real email private. 
					Control who can contact you and eliminate spam effortlessly.
				</p>
				
				<div class="flex items-center justify-center gap-4">
					<a href="/signin" class="btn-primary text-lg px-8 py-3">
						Get Started
					</a>
				</div>
			</div>

			<!-- Features Section -->
			<div class="grid md:grid-cols-3 gap-8">
				<div class="card text-center">
					<div class="inline-flex p-4 bg-blue-100 rounded-full mb-4">
						<svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
						</svg>
					</div>
					<h3 class="mb-3">Privacy First</h3>
					<p class="text-gray-600">
						Keep your real email address private and protect yourself from spam and tracking
					</p>
				</div>

				<div class="card text-center">
					<div class="inline-flex p-4 bg-green-100 rounded-full mb-4">
						<svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
						</svg>
					</div>
					<h3 class="mb-3">Instant Aliases</h3>
					<p class="text-gray-600">
						Create email aliases on the fly. No limits, no hassle, complete control
					</p>
				</div>

				<div class="card text-center">
					<div class="inline-flex p-4 bg-purple-100 rounded-full mb-4">
						<svg class="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
						</svg>
					</div>
					<h3 class="mb-3">Stay Secure</h3>
					<p class="text-gray-600">
						Built with security in mind using Supabase for reliable and safe data storage
					</p>
				</div>
			</div>

			<!-- CTA Section -->
			<div class="card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 text-center">
				<h2 class="mb-4">Ready to take control of your inbox?</h2>
				<p class="text-gray-600 mb-6 max-w-2xl mx-auto">
					Join thousands of users who have already protected their privacy with Supamail
				</p>
				<a href="/signin" class="btn-primary text-lg px-8 py-3 inline-block">
					Start for Free
				</a>
			</div>
		</div>
	{/if}
</div>