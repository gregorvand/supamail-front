<script>
  import { supabase } from '$lib/supabaseClient';

  let email = '';
  let loading = false;
  let sent = false;
  let message = '';
  let error = '';

  async function submit() {
    loading = true;
    error = '';
    message = '';
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo }
      });
      if (err) {
        error = err.message;
      } else {
        sent = true;
        message = 'Check your email for the magic link.';
      }
    } finally {
      loading = false;
    }
  }
</script>

<h1 class="text-2xl font-bold mb-2">Sign in / Sign up</h1>

<form on:submit|preventDefault={submit}>
  <label>
    Email
    <br>
    <input type="email" class="mt-2 max-w-md relative inline-block" bind:value={email} required />
  </label>
  <br>
  <button class="btn-primary p-2 rounded-lg mt-2" type="submit" disabled={loading || !email}>
    {loading ? 'Sending…' : 'Send magic link'}
  </button>
</form>

{#if message}
  <p>{message}</p>
{/if}

{#if error}
  <p style="color: red">{error}</p>
{/if}


