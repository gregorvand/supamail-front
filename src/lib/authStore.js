import { writable } from 'svelte/store';
import { supabase } from './supabaseClient';

/**
 * @typedef {import('@supabase/supabase-js').User | null} SupabaseUser
 */

export const authSession = writable(null);
/** @type {import('svelte/store').Writable<SupabaseUser>} */
export const authUser = writable(/** @type {SupabaseUser} */(null));

async function initializeAuthStores() {
  const { data } = await supabase.auth.getSession();
  authSession.set(data.session);
  authUser.set(data.session?.user ?? null);
}

initializeAuthStores();

supabase.auth.onAuthStateChange((_event, session) => {
  authSession.set(session);
  authUser.set(session?.user ?? null);
});


