<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { authUser } from '$lib/authStore';

  /**
   * @typedef {{
   *   id?: string,
   *   subject?: string | null,
   *   to_addresses: string[],
   *   from_address?: string | null,
   *   created_at: string,
   * }} Message
   */

  /** @type {Message[]} */
  let messages = [];
  let loading = false;
  let error = '';

  async function loadMessages() {
    error = '';
    loading = true;
    try {
      // RLS on email_messages.user_id ensures the user sees only their messages
      const { data, error: err } = await supabase
        .from('email_messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) {
        error = err.message;
        return;
      }
      messages = data ?? [];
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    if ($authUser) loadMessages();
  });

  $: if ($authUser) {
    // Reload when auth becomes available
    loadMessages();
  }
</script>

{#if !$authUser}
  <p>Please sign in to view your messages.</p>
{:else}
  <h1>Your messages</h1>
  {#if loading}
    <p>Loading…</p>
  {:else if error}
    <p style="color: red">{error}</p>
  {:else if messages.length === 0}
    <p>No messages yet.</p>
  {:else}
    <ul>
      {#each messages as m}
        <li>
          <strong>{m.subject || '(no subject)'}</strong>
          <div>To: {m.to_addresses?.join(', ')}</div>
          <div>From: {m.from_address}</div>
          <div>Received: {new Date(m.created_at).toLocaleString()}</div>
        </li>
      {/each}
    </ul>
  {/if}
{/if}


