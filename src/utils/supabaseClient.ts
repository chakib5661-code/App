import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Resolve Supabase credentials in browser or serverless
export function getClientSupabaseCredentials(): { url: string; key: string } {
  const globalEnv = typeof window !== 'undefined' ? (window as any).__TULIP_ENV__ || {} : {};

  const url = (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
    globalEnv.VITE_SUPABASE_URL ||
    globalEnv.SUPABASE_URL ||
    ''
  ).trim();

  const key = (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
    globalEnv.VITE_SUPABASE_ANON_KEY ||
    globalEnv.SUPABASE_ANON_KEY ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY) ||
    globalEnv.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();

  return { url, key };
}

let autoSyncTimer: any = null;
let isPushingToSupabase = false;
let clientInstance: SupabaseClient | null = null;

/**
 * Deprecated client auto-sync.
 * All mutations are authoritative on the server and committed directly to Supabase.
 * Client browsers must NOT blindly overwrite the master database snapshot.
 */
export function triggerAutoSyncToSupabase(_snapshotProvider: () => any, _delayMs = 1200): void {
  // Deliberately disabled: Supabase is the single source of truth managed by the server.
}

export function getClientSupabase(): SupabaseClient | null {
  const { url, key } = getClientSupabaseCredentials();
  if (!url || !key || !url.startsWith('http') || url.includes('your-project-id')) {
    return null;
  }
  if (!clientInstance) {
    clientInstance = createClient(url, key);
  }
  return clientInstance;
}

/**
 * Direct browser test of Supabase connection (works even if Vercel serverless function is spinning or down)
 */
export async function directClientTestSupabase(): Promise<{
  connected: boolean;
  url?: string;
  hasStateTable?: boolean;
  error?: string;
}> {
  const client = getClientSupabase();
  if (!client) {
    return {
      connected: false,
      error: 'Veuillez configurer VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans les variables d\'environnement Vercel.',
    };
  }

  try {
    const { url } = getClientSupabaseCredentials();
    const { data, error } = await client
      .from('tulip_store_state')
      .select('key')
      .eq('key', 'main_state')
      .maybeSingle();

    if (error && error.code === '42P01') {
      return {
        connected: true,
        url,
        hasStateTable: false,
        error: 'Connecté à Supabase mais la table tulip_store_state est introuvable. Exécutez le script supabase-schema.sql dans l\'éditeur SQL Supabase.',
      };
    }

    if (error && error.code !== 'PGRST116') {
      return {
        connected: false,
        url,
        error: error.message,
      };
    }

    return {
      connected: true,
      url,
      hasStateTable: true,
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err?.message || String(err),
    };
  }
}

/**
 * Direct browser fetch of state from Supabase for all client devices
 * (Guarantees multi-device real-time sync even on static Vercel hosts!)
 */
export async function directClientFetchFromSupabase(): Promise<any | null> {
  const client = getClientSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('tulip_store_state')
      .select('data')
      .eq('key', 'main_state')
      .maybeSingle();

    if (error || !data || !data.data) {
      return null;
    }

    return data.data;
  } catch (e) {
    console.warn('[SupabaseClient] directClientFetchFromSupabase notice:', e);
    return null;
  }
}

/**
 * Direct browser push of state to Supabase
 */
export async function directClientSaveToSupabase(dbSnapshot: any): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const client = getClientSupabase();
  if (!client) {
    return {
      success: false,
      error: 'Client Supabase non initialisé. Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.',
    };
  }

  try {
    const payload = {
      key: 'main_state',
      data: dbSnapshot,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client
      .from('tulip_store_state')
      .upsert(payload, { onConflict: 'key' });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      message: 'Base de données synchronisée directement avec succès vers Supabase !',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || String(err),
    };
  }
}

/**
 * Subscribes to real-time changes on the Supabase tulip_store_state table.
 * Whenever any admin or device updates products, orders, banners, or settings,
 * the callback is triggered with zero delay across all devices!
 */
export function subscribeToSupabaseRealtime(
  onUpdate: (updatedData: any) => void
): () => void {
  const client = getClientSupabase();
  if (!client) {
    return () => {};
  }

  try {
    const channel = client
      .channel('tulip_realtime_store_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tulip_store_state',
          filter: 'key=eq.main_state',
        },
        (payload: any) => {
          if (payload?.new && payload.new.data) {
            console.log('[Supabase Realtime] Received live update from cloud:', payload.new.updated_at);
            onUpdate(payload.new.data);
          }
        }
      )
      .subscribe((status: string) => {
        console.log('[Supabase Realtime] Channel subscription status:', status);
      });

    return () => {
      try {
        client.removeChannel(channel);
      } catch (err) {
        console.warn('[Supabase Realtime] Error removing channel:', err);
      }
    };
  } catch (err) {
    console.warn('[Supabase Realtime] Error subscribing to changes:', err);
    return () => {};
  }
}
