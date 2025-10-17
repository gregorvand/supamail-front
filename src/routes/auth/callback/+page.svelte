<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';

  let error = '';

  onMount(async () => {
    const currentUrl = new URL(window.location.href);
    // Handle error returned in hash fragment (e.g. #error_description=...)
    if (currentUrl.hash.includes('error')) {
      const params = new URLSearchParams(currentUrl.hash.replace('#', ''));
      const description = params.get('error_description') || params.get('error') || 'Authentication error';
      error = description;
      return;
    }

    // detectSessionInUrl=true will auto-store session if access_token is in the URL
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      goto('/');
      return;
    }

    // Fallback: if a PKCE/OAuth code exists, try exchanging it
    const code = currentUrl.searchParams.get('code');
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (exchangeError) {
        error = exchangeError.message;
        return;
      }
      goto('/');
      return;
    }

    // If nothing to process, go home
    goto('/');
  });
</script>

<p>Signing you in…</p>
{#if error}
  <p style="color: red">{error}</p>
{/if}


