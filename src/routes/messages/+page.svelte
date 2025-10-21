<script>
  import { onMount } from 'svelte';
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
   * @param {Message[]} msgs
   */
  async function populateSignedUrls(msgs) {
    for (const m of msgs) {
      if (!m.id || !m.attachments || m.attachments.length === 0) continue;
      const userId = /** @type {string | undefined} */ (m.user_id) || $authUser?.id;
      if (!userId) continue;
      const folder = `${userId}/${m.id}`;
      const { data: objects, error: listErr } = await supabase
        .storage
        .from(attachmentsBucket)
        .list(folder, { limit: 1000 });
      if (listErr || !objects) continue;
      const objectNames = new Set(objects.map((o) => o.name));

      for (const a of m.attachments) {
        const name = resolveAttachmentName(a);
        if (!name || !objectNames.has(name)) continue;
        const objectPath = `${folder}/${name}`;
        const { data: signed, error: signErr } = await supabase
          .storage
          .from(attachmentsBucket)
          .createSignedUrl(objectPath, 3600);
        if (!signErr && signed && signed.signedUrl) {
          a.signedUrl = signed.signedUrl;
        }
      }
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


