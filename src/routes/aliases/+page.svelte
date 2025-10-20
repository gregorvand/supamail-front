<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { authUser } from '$lib/authStore';
  import { aliasDomain } from '$lib/env';

  /**
   * @typedef {{ id: string, address: string, created_at: string }} Alias
   */

  /** @type {Alias[]} */
  let aliases = [];
  let loading = false;
  let error = '';

  const MAX_RETRIES = 5;

  function generateLocalPart() {
    const random = Math.random().toString(36).slice(2, 10);
    return random;
  }

  async function loadAliases() {
    error = '';
    const { data, error: err } = await supabase
      .from('aliases')
      .select('id,address,created_at')
      .order('created_at', { ascending: false });
    if (err) {
      error = err.message;
      return;
    }
    aliases = data ?? [];
  }

  async function createAlias() {
    if (!$authUser) return;
    loading = true;
    error = '';
    try {
      let attempt = 0;
      while (attempt < MAX_RETRIES) {
        const localPart = generateLocalPart();
        const address = `${localPart}@${aliasDomain}`;
        const { error: insertError } = await supabase
          .from('aliases')
          .insert({ user_id: $authUser.id, address });
        if (!insertError) {
          await loadAliases();
          return;
        }
        if (insertError.code === '23505') {
          attempt += 1; // unique violation, retry
          continue;
        }
        throw insertError;
      }
      error = 'Failed to generate a unique alias. Please try again.';
    } catch (e) {
      error = (e && typeof e === 'object' && 'message' in e)
        ? /** @type {{message?: string}} */ (e).message || ''
        : String(e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    if ($authUser) loadAliases();
  });

  $: if ($authUser) {
    // Reload when auth becomes available
    loadAliases();
  }
</script>

{#if !$authUser}
  <p>Please sign in to manage your aliases.</p>
{:else}
  <h1>Your aliases</h1>
  <button on:click={createAlias} disabled={loading}>
    {loading ? 'Creating…' : 'Generate new alias'}
  </button>
  {#if error}
    <p style="color: red">{error}</p>
  {/if}
  {#if aliases.length === 0}
    <p>No aliases yet.</p>
  {:else}
    <ul>
      {#each aliases as a}
        <li>{a.address}</li>
      {/each}
    </ul>
  {/if}
{/if}


