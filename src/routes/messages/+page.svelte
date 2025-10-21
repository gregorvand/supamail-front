<script>
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { authUser } from '$lib/authStore';
  import { attachmentsBucket } from '$lib/env';

  /**
   * @typedef {{
   *   id?: string,
   *   user_id?: string,
   *   subject?: string | null,
   *   to_addresses: string[],
   *   from_address?: string | null,
   *   created_at: string,
   *   attachments?: Attachment[],
   * }} Message
   */

  /**
   * @typedef {{
   *   id?: string,
   *   message_id?: string,
   *   filename?: string | null,
   *   file_name?: string | null,
   *   name?: string | null,
   *   content_type?: string | null,
   *   size_bytes?: number | null,
   *   signedUrl?: string | null,
   * }} Attachment
   */

  /**
   * @typedef {{
   *   id: string,
   *   address: string,
   *   label?: string | null,
   * }} Alias
   */

  /**
   * @typedef {{
   *   alias: string,
   *   label: string | null,
   *   aliasId: string,
   *   messages: Message[],
   * }} GroupedMessages
   */

  /** @type {Message[]} */
  let messages = [];
  /** @type {Record<string, Alias>} */
  let aliasesMap = {};
  /** @type {GroupedMessages[]} */
  let groupedMessages = [];
  let loading = false;
  let error = '';
  /** @type {import('@supabase/supabase-js').RealtimeChannel | null} */
  let channel = null;
  /** @type {import('@supabase/supabase-js').RealtimeChannel | null} */
  let broadcastChannel = null;
  /** @type {string | null} */
  let editingAliasId = null;
  let editingLabel = '';

  /**
   * Pick the best display name provided by the record
   * @param {Attachment} a
   */
  function resolveAttachmentName(a) {
    return a.filename || a.file_name || a.name || '';
  }

  /**
   * For each message, attempt to locate its attachments in the storage bucket
   * under a folder named by the message id, and create signed download URLs.
   * Batches all requests for better performance.
   * @param {Message[]} msgs
   */
  async function populateSignedUrls(msgs) {
    // Collect all paths that need signed URLs
    /** @type {Array<{message: Message, attachment: Attachment, path: string}>} */
    const pathsToSign = [];

    for (const m of msgs) {
      if (!m.id || !m.attachments || m.attachments.length === 0) continue;
      const userId = /** @type {string | undefined} */ (m.user_id) || $authUser?.id;
      if (!userId) continue;
      const folder = `${userId}/${m.id}`;

      for (const a of m.attachments) {
        const name = resolveAttachmentName(a);
        if (!name) continue;
        const objectPath = `${folder}/${name}`;
        pathsToSign.push({ message: m, attachment: a, path: objectPath });
      }
    }

    // Create signed URLs in parallel batches of 20 to avoid overwhelming the API
    const batchSize = 20;
    for (let i = 0; i < pathsToSign.length; i += batchSize) {
      const batch = pathsToSign.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(({ path }) =>
          supabase.storage.from(attachmentsBucket).createSignedUrl(path, 3600)
        )
      );

      // Assign the signed URLs back to the attachments
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value.data?.signedUrl) {
          batch[idx].attachment.signedUrl = result.value.data.signedUrl;
        }
      });
    }
  }

  async function loadAliases() {
    const { data, error: err } = await supabase
      .from('aliases')
      .select('id, address, label');
    if (err) {
      console.error('Error loading aliases:', err);
      return;
    }
    aliasesMap = {};
    for (const alias of data ?? []) {
      aliasesMap[alias.address] = alias;
    }
  }

  function groupMessagesByAlias() {
    /** @type {Record<string, GroupedMessages>} */
    const groups = {};
    
    for (const msg of messages) {
      for (const toAddr of msg.to_addresses || []) {
        const alias = aliasesMap[toAddr];
        if (alias) {
          if (!groups[alias.address]) {
            groups[alias.address] = {
              alias: alias.address,
              label: alias.label || null,
              aliasId: alias.id,
              messages: []
            };
          }
          groups[alias.address].messages.push(msg);
        }
      }
    }
    
    groupedMessages = Object.values(groups).sort((a, b) => {
      // Sort by most recent message in each group
      const aLatest = a.messages[0]?.created_at || '';
      const bLatest = b.messages[0]?.created_at || '';
      return new Date(bLatest).getTime() - new Date(aLatest).getTime();
    });
  }

  async function loadMessages() {
    error = '';
    loading = true;
    try {
      // Load aliases first
      await loadAliases();

      // RLS on email_messages.user_id ensures the user sees only their messages
      const { data, error: err } = await supabase
        .from('email_messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) {
        error = err.message;
        return;
      }
      const baseMessages = (data ?? []).map((m) => ({ ...m, attachments: [] }));

      // Fetch all attachments (RLS scopes to current user) and match by message_id
      const { data: atts, error: attErr } = await supabase
        .from('email_attachments')
        .select('*');
      if (!attErr && atts) {
        /** @type {Record<string, Attachment[]>} */
        const byMessageId = {};
        for (const a of atts) {
          const key = /** @type {string} */ (a.message_id);
          if (!byMessageId[key]) byMessageId[key] = [];
          byMessageId[key].push(a);
        }
        for (const m of baseMessages) {
          // @ts-ignore - extend at runtime
          m.attachments = byMessageId[m.id] || [];
        }
      }

      // Enrich with signed download URLs from storage
      await populateSignedUrls(baseMessages);

      messages = baseMessages;
      groupMessagesByAlias();
    } finally {
      loading = false;
    }
  }

  /**
   * Fetch a single message row by id, including its attachments and signed URLs.
   * @param {string} messageId
   */
  async function fetchMessageWithAttachments(messageId) {
    const { data: msg, error: mErr } = await supabase
      .from('email_messages')
      .select('*')
      .eq('id', messageId)
      .single();
    if (mErr || !msg) return null;

    const { data: atts } = await supabase
      .from('email_attachments')
      .select('*')
      .eq('message_id', messageId);

    /** @type {Message} */
    const enriched = { ...msg, attachments: atts ?? [] };
    await populateSignedUrls([enriched]);
    return enriched;
  }

  /** @param {Message} m */
  function upsertMessageInList(m) {
    const idx = messages.findIndex((x) => x.id === m.id);
    if (idx >= 0) {
      messages[idx] = m;
    } else {
      messages.unshift(m);
    }
    messages = [...messages].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    groupMessagesByAlias();
  }

  /** @param {string} id */
  function removeMessageFromList(id) {
    messages = messages.filter((m) => m.id !== id);
    groupMessagesByAlias();
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
      
      // Update local state
      await loadAliases();
      groupMessagesByAlias();
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

  /**
   * Handle custom broadcast events where payload shape may vary.
   * Falls back to reloading list if id cannot be derived.
   * @param {'INSERT'|'UPDATE'|'DELETE'} evt
   * @param {any} payload
   */
  async function handleBroadcast(evt, payload) {
    try {
      const idForInsert = payload?.new?.id ?? payload?.id ?? null;
      const idForUpdate = payload?.new?.id ?? payload?.id ?? null;
      const idForDelete = payload?.old?.id ?? payload?.id ?? null;
      if (evt === 'INSERT') {
        if (idForInsert) {
          const m = await fetchMessageWithAttachments(idForInsert);
          if (m) upsertMessageInList(m);
          return;
        }
      } else if (evt === 'UPDATE') {
        if (idForUpdate) {
          const m = await fetchMessageWithAttachments(idForUpdate);
          if (m) upsertMessageInList(m);
          return;
        }
      } else if (evt === 'DELETE') {
        if (idForDelete) {
          removeMessageFromList(idForDelete);
          return;
        }
      }
      await loadMessages();
    } catch {
      await loadMessages();
    }
  }

  /**
   * Handle a Postgres change payload (INSERT/UPDATE/DELETE)
   * @param {any} payload
   */
  async function handleRowChange(payload) {
    const evt = payload?.eventType || payload?.event || '';
    if (evt === 'INSERT') {
      const id = payload?.new?.id;
      if (!id) return;
      const m = await fetchMessageWithAttachments(id);
      if (m) upsertMessageInList(m);
      return;
    }
    if (evt === 'UPDATE') {
      const id = payload?.new?.id;
      if (!id) return;
      const m = await fetchMessageWithAttachments(id);
      if (m) upsertMessageInList(m);
      return;
    }
    if (evt === 'DELETE') {
      const id = payload?.old?.id;
      if (!id) return;
      removeMessageFromList(id);
      return;
    }
  }

  onMount(async () => {
    if ($authUser) {
      await loadMessages();

      // Ensure Realtime has a valid access token before subscribing
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (accessToken) {
        try { await supabase.realtime.setAuth(accessToken); } catch {}
      }

      // Subscribe to Postgres changes on email_messages (RLS will scope rows)
      channel = supabase.channel('email_messages:realtime');

      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'email_messages' }, async (payload) => {
          // eslint-disable-next-line no-console
          console.debug('email_messages change', payload?.eventType, payload);
          await handleRowChange(payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // eslint-disable-next-line no-console
            console.log('Subscribed to email_messages Postgres changes');
          }
        });

      // Also subscribe to private broadcast channel if backend emits custom events
      broadcastChannel = supabase.channel('email_messages:changes', {
        config: { private: true, broadcast: { ack: true } }
      });
      broadcastChannel
        .on('broadcast', { event: 'INSERT' }, async ({ payload }) => { await handleBroadcast('INSERT', payload); })
        .on('broadcast', { event: 'UPDATE' }, async ({ payload }) => { await handleBroadcast('UPDATE', payload); })
        .on('broadcast', { event: 'DELETE' }, async ({ payload }) => { await handleBroadcast('DELETE', payload); })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // eslint-disable-next-line no-console
            console.log('Subscribed to email_messages broadcast channel');
          }
        });
    }
  });

  onDestroy(() => {
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
    if (broadcastChannel) {
      supabase.removeChannel(broadcastChannel);
      broadcastChannel = null;
    }
  });

  $: if ($authUser && !loading && !channel) {
    // If auth arrives after mount, ensure data and subscription are initialized
    (async () => {
      await loadMessages();
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (accessToken) {
        try { await supabase.realtime.setAuth(accessToken); } catch {}
      }
      channel = supabase.channel('email_messages:realtime');
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'email_messages' }, async (payload) => {
          // eslint-disable-next-line no-console
          console.debug('email_messages change', payload?.eventType, payload);
          await handleRowChange(payload);
        })
        .subscribe();

      // Private broadcast channel
      broadcastChannel = supabase.channel('email_messages:changes', {
        config: { private: true, broadcast: { ack: true } }
      });
      broadcastChannel
        .on('broadcast', { event: 'INSERT' }, async ({ payload }) => { await handleBroadcast('INSERT', payload); })
        .on('broadcast', { event: 'UPDATE' }, async ({ payload }) => { await handleBroadcast('UPDATE', payload); })
        .on('broadcast', { event: 'DELETE' }, async ({ payload }) => { await handleBroadcast('DELETE', payload); })
        .subscribe();
    })();
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
  {:else if groupedMessages.length === 0}
    <p>No messages found for your aliases.</p>
  {:else}
    {#each groupedMessages as group}
      <div style="margin-bottom: 2rem; border: 1px solid #ccc; padding: 1rem; border-radius: 8px;">
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; background-color: #f5f5f5; padding: 0.5rem; border-radius: 4px;">
          <h2 style="margin: 0; font-size: 1.2rem;">
            {#if editingAliasId === group.aliasId}
              <input
                type="text"
                bind:value={editingLabel}
                placeholder="Enter label..."
                style="padding: 0.25rem; font-size: 1rem;"
                on:keydown={(/** @type {KeyboardEvent} */ e) => {
                  if (e.key === 'Enter') saveLabel(group.aliasId);
                  if (e.key === 'Escape') cancelEditing();
                }}
              />
              <button on:click={() => saveLabel(group.aliasId)} style="margin-left: 0.5rem;">Save</button>
              <button on:click={cancelEditing}>Cancel</button>
            {:else}
              <span style="font-weight: bold;">
                {group.label || 'Unlabeled'}
              </span>
              <button 
                on:click={() => startEditingLabel(group.aliasId, group.label)}
                style="margin-left: 0.5rem; font-size: 0.8rem;"
              >
                {group.label ? 'Edit' : 'Add'} Label
              </button>
            {/if}
          </h2>
          <div style="color: #666; font-size: 0.9rem;">
            {group.alias} ({group.messages.length} message{group.messages.length !== 1 ? 's' : ''})
          </div>
        </div>
        
        <ul style="list-style: none; padding: 0;">
          {#each group.messages as m}
            <li style="margin-bottom: 1.5rem; padding: 1rem; background-color: #fafafa; border-radius: 4px;">
              <strong>{m.subject || '(no subject)'}</strong>
              <div style="font-size: 0.9rem; color: #666;">From: {m.from_address}</div>
              <div style="font-size: 0.9rem; color: #666;">Received: {new Date(m.created_at).toLocaleString()}</div>
              {#if m.attachments && m.attachments.length > 0}
                <div style="margin-top: 0.5rem;">Attachments ({m.attachments.length}):</div>
                <ul style="margin-top: 0.5rem;">
                  {#each m.attachments as a}
                    <li style="margin-bottom: 0.5rem;">
                      {#if a.signedUrl}
                        {#if a.content_type?.startsWith('image/')}
                          <div>
                            <img src={a.signedUrl} alt={resolveAttachmentName(a)} style="max-width: 300px; max-height: 300px;" />
                            <br>
                            <a href={a.signedUrl} target="_blank" rel="noopener" download>
                              {resolveAttachmentName(a)}
                            </a>
                          </div>
                        {:else}
                          <a href={a.signedUrl} target="_blank" rel="noopener" download>
                            {resolveAttachmentName(a)}
                          </a>
                        {/if}
                      {:else}
                        {resolveAttachmentName(a) || `Attachment ${a.id}`}
                      {/if}
                    </li>
                  {/each}
                </ul>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  {/if}
{/if}


