import { writable } from 'svelte/store';
import { supabase } from './supabaseClient';

/**
 * @typedef {import('@supabase/supabase-js').User | null} SupabaseUser
 */
/** @typedef {import('@supabase/supabase-js').Session | null} SupabaseSession */

/** @type {import('svelte/store').Writable<SupabaseSession>} */
export const authSession = writable(/** @type {SupabaseSession} */(null));
/** @type {import('svelte/store').Writable<SupabaseUser>} */
export const authUser = writable(/** @type {SupabaseUser} */(null));

async function initializeAuthStores() {
  const { data } = await supabase.auth.getSession();
  authSession.set(data.session);
  authUser.set(data.session?.user ?? null);
  // Ensure Realtime private channels have the current access token
  const accessToken = data.session?.access_token;
  if (accessToken) {
    try {
      await supabase.realtime.setAuth(accessToken);
    } catch (_e) {
      // noop: token will be refreshed on next auth change
    }
  }
}

initializeAuthStores();

supabase.auth.onAuthStateChange(async (_event, session) => {
  authSession.set(session);
  authUser.set(session?.user ?? null);
  // Propagate access token to Realtime for private channel auth
  const accessToken = session?.access_token;
  if (accessToken) {
    try {
      await supabase.realtime.setAuth(accessToken);
    } catch (_e) {
      // noop
    }
  }
});


