<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { authUser } from '$lib/authStore';
  import { aliasDomain } from '$lib/env';

  /**
   * @typedef {{ id: string, address: string, label?: string | null, created_at: string }} Alias
   */

  /** @type {Alias[]} */
  let aliases = [];
  let loading = false;
  let error = '';
  /** @type {string | null} */
  let editingAliasId = null;
  let editingLabel = '';

  const MAX_RETRIES = 5;

  function generateLocalPart() {
    const random = Math.random().toString(36).slice(2, 10);
    return random;
  }

  async function loadAliases() {
    error = '';
    const { data, error: err } = await supabase
      .from('aliases')
      .select('id,address,label,created_at')
      .order('created_at', { ascending: false });
    if (err) {
      error = err.message;
      return;
    }
    aliases = data ?? [];
  }

  /**
   * @param {string} aliasId
   * @param {string} newLabel
   */
  async function updateAliasLabel(aliasId, newLabel) {
    try {
      console.log('Updating alias label:', { aliasId, newLabel });
      
      const { data, error: updateError, count } = await supabase
        .from('aliases')
        .update({ label: newLabel || null })
        .eq('id', aliasId)
        .select();
      
      console.log('Update response:', { data, error: updateError, count });
      
      if (updateError) {
        error = 'Failed to update label: ' + updateError.message;
        console.error('Update error:', updateError);
        return;
      }
      
      if (!data || data.length === 0) {
        error = 'No alias found with that ID. The alias may have been deleted.';
        console.warn('No rows updated for alias ID:', aliasId);
        return;
      }
      
      await loadAliases();
      editingAliasId = null;
      editingLabel = '';
      error = ''; // Clear any previous errors
      
      console.log('Label updated successfully');
    } catch (e) {
      error = 'Failed to update label: ' + String(e);
      console.error('Exception during update:', e);
    }
  }

  /**
   * @param {string} aliasId
   * @param {string | null} currentLabel
   */
  function startEditingLabel(aliasId, currentLabel) {
    editingAliasId = aliasId;
    editingLabel = currentLabel || '';
  }

  function cancelEditing() {
    editingAliasId = null;
    editingLabel = '';
  }

  /**
   * @param {string} aliasId
   */
  async function saveLabel(aliasId) {
    await updateAliasLabel(aliasId, editingLabel);
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
  <h1 class="mb-4">Your aliases</h1>
  <button on:click={createAlias} disabled={loading}>
    {loading ? 'Creating…' : 'Generate new alias'}
  </button>
  {#if error}
    <p style="color: red">{error}</p>
  {/if}
  {#if aliases.length === 0}
    <p>No aliases yet.</p>
  {:else}
    <ul style="list-style: none; padding: 0;">
      {#each aliases as a}
        <li style="margin-bottom: 1rem; padding: 1rem; border: 1px solid #ccc; border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 200px;">
              <div style="font-weight: bold; margin-bottom: 0.25rem;">
                {a.address}
              </div>
              <div style="font-size: 0.85rem; color: #666;">
                Created: {new Date(a.created_at).toLocaleDateString()}
              </div>
            </div>
            
            <div style="flex: 1; min-width: 200px; display: flex; align-items: center; gap: 0.5rem;">
              {#if editingAliasId === a.id}
                <input
                  type="text"
                  bind:value={editingLabel}
                  placeholder="Enter label..."
                  style="padding: 0.5rem; flex: 1;"
                  on:keydown={(/** @type {KeyboardEvent} */ e) => {
                    if (e.key === 'Enter') saveLabel(a.id);
                    if (e.key === 'Escape') cancelEditing();
                  }}
                />
                <button on:click={() => saveLabel(a.id)}>Save</button>
                <button on:click={cancelEditing}>Cancel</button>
              {:else}
                <div style="flex: 1;">
                  <strong>Label:</strong> {a.label || '(none)'}
                </div>
                <button 
                  on:click={() => startEditingLabel(a.id, a.label || null)}
                  style="white-space: nowrap;"
                >
                  {a.label ? 'Edit' : 'Add'} Label
                </button>
              {/if}
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/if}


