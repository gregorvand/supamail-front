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

  /** @type {Message[]} */
  let messages = [];
  let loading = false;
  let error = '';
  /** @type {import('@supabase/supabase-js').RealtimeChannel | null} */
  let channel = null;
  /** @type {import('@supabase/supabase-js').RealtimeChannel | null} */
  let broadcastChannel = null;

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
  }

  /** @param {string} id */
  function removeMessageFromList(id) {
    messages = messages.filter((m) => m.id !== id);
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
  {:else}
    <ul>
      {#each messages as m}
        <li>
          <strong>{m.subject || '(no subject)'}</strong>
          <div>To: {m.to_addresses?.join(', ')}</div>
          <div>From: {m.from_address}</div>
          <div>Received: {new Date(m.created_at).toLocaleString()}</div>
          {#if m.attachments && m.attachments.length > 0}
            <div>Attachments ({m.attachments.length}):</div>
            <ul>
              {#each m.attachments as a}
                <li>
                  {#if a.signedUrl}
                    <a href={a.signedUrl} target="_blank" rel="noopener" download>
                      {resolveAttachmentName(a)}
                    </a>
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
  {/if}
{/if}


