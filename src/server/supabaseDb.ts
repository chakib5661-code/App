import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Product,
  PreOrder,
  CustomerApplication,
  CustomerUser,
  AdBanner,
  StoreSettings,
} from '../types';
import type { ServerDatabase } from './storeDb';

// Supabase environment variables resolution
export function getSupabaseCredentials(): { url: string; key: string } {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''
  ).trim();

  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseCredentials();
  return Boolean(url && key && url.startsWith('http') && !url.includes('your-project-id'));
}

let supabaseInstance: SupabaseClient | null = null;
let lastSyncTimestamp = 0;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseInstance) {
    const { url, key } = getSupabaseCredentials();
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseInstance;
}

/**
 * Checks connection status to Supabase and verifies required tables.
 */
export async function testSupabaseConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  url?: string;
  hasStateTable?: boolean;
  details?: string;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      connected: false,
      details: 'Supabase credentials not configured in environment variables (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY).',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      configured: true,
      connected: false,
      error: 'Failed to initialize Supabase client.',
    };
  }

  try {
    const { url } = getSupabaseCredentials();
    const { data: stateData, error: stateError } = await client
      .from('tulip_store_state')
      .select('key, updated_at')
      .eq('key', 'main_state')
      .maybeSingle();

    const hasStateTable = !stateError || stateError.code !== '42P01';

    return {
      configured: true,
      connected: true,
      url: url ? url.replace(/^(https?:\/\/[^.]+).*/, '$1.supabase.co') : '',
      hasStateTable,
      details: hasStateTable
        ? 'Connected to Supabase. Master state table (tulip_store_state) is active and ready.'
        : 'Connected to Supabase. Table tulip_store_state not created yet. Please execute supabase-schema.sql in your Supabase SQL editor.',
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      error: err?.message || String(err),
    };
  }
}

/**
 * Loads the complete database snapshot from Supabase.
 * Returns null if Supabase is not configured or not yet initialized with data.
 */
export async function loadDatabaseFromSupabase(): Promise<ServerDatabase | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    // 1. Try reading the unified snapshot from tulip_store_state
    const { data, error } = await client
      .from('tulip_store_state')
      .select('data, updated_at')
      .eq('key', 'main_state')
      .maybeSingle();

    if (!error && data && data.data && Array.isArray(data.data.products)) {
      lastSyncTimestamp = Date.now();
      const loaded = data.data as ServerDatabase;
      if (Array.isArray(loaded.orders)) {
        loaded.orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
      console.log('[Supabase] Loaded store database snapshot from table tulip_store_state.');
      return loaded;
    }

    // 2. If snapshot is not present, check individual tables
    const [prodsRes, ordersRes, appsRes, usersRes, bannersRes, settingsRes] = await Promise.allSettled([
      client.from('tulip_products').select('*'),
      client.from('tulip_orders').select('*'),
      client.from('tulip_customer_applications').select('*'),
      client.from('tulip_customer_users').select('*'),
      client.from('tulip_ad_banners').select('*'),
      client.from('tulip_store_settings').select('*').limit(1).maybeSingle(),
    ]);

    const prods = prodsRes.status === 'fulfilled' && prodsRes.value.data ? prodsRes.value.data : null;
    if (prods && Array.isArray(prods) && prods.length > 0) {
      const orders = ordersRes.status === 'fulfilled' && ordersRes.value.data ? ordersRes.value.data : [];
      const apps = appsRes.status === 'fulfilled' && appsRes.value.data ? appsRes.value.data : [];
      const users = usersRes.status === 'fulfilled' && usersRes.value.data ? usersRes.value.data : [];
      const banners = bannersRes.status === 'fulfilled' && bannersRes.value.data ? bannersRes.value.data : [];
      const settings = settingsRes.status === 'fulfilled' && settingsRes.value.data ? settingsRes.value.data : null;

      const loadedDb: ServerDatabase = {
        products: prods as Product[],
        orders: orders as PreOrder[],
        customerApplications: apps as CustomerApplication[],
        customerUsers: users as CustomerUser[],
        adBanners: banners as AdBanner[],
        storeSettings: (settings as StoreSettings) || undefined as any,
        lastUpdated: new Date().toISOString(),
      };

      lastSyncTimestamp = Date.now();
      console.log('[Supabase] Loaded store database from normalized tables.');
      return loadedDb;
    }

    return null;
  } catch (err) {
    console.warn('[Supabase] loadDatabaseFromSupabase notice:', err);
    return null;
  }
}

/**
 * Persists the entire database to Supabase.
 * - Upserts the master document snapshot into `tulip_store_state`
 * - Also updates normalized tables in background if available
 */
export async function saveDatabaseToSupabase(db: ServerDatabase): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    if (Array.isArray(db.orders)) {
      db.orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    const payload = {
      key: 'main_state',
      data: db,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client
      .from('tulip_store_state')
      .upsert(payload, { onConflict: 'key' });

    if (error) {
      console.warn('[Supabase] Notice upserting to tulip_store_state:', error.message);
      return false;
    }

    lastSyncTimestamp = Date.now();

    // Asynchronous background sync to individual normalized tables for SQL queries in Supabase Dashboard
    syncNormalizedTablesAsync(client, db).catch((syncErr) => {
      console.warn('[Supabase] Normalized tables background sync note:', syncErr?.message || syncErr);
    });

    return true;
  } catch (err: any) {
    console.warn('[Supabase] saveDatabaseToSupabase error:', err?.message || err);
    return false;
  }
}

/**
 * Background non-blocking sync of normalized tables for Supabase dashboard visibility
 */
async function syncNormalizedTablesAsync(client: SupabaseClient, db: ServerDatabase): Promise<void> {
  try {
    if (db.storeSettings) {
      await Promise.resolve(
        client.from('tulip_store_settings').upsert({
          id: 'default',
          ...db.storeSettings,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })
      ).catch(() => {});
    }

    // Sync products in batches of 50
    if (Array.isArray(db.products) && db.products.length > 0) {
      const batch = db.products.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        name_ar: p.arabicName || null,
        family: p.family,
        sub_family: p.category || null,
        notes: null,
        price_da: p.priceDA,
        stock: p.stock,
        unit: p.unit,
        description: p.description || null,
        image_url: p.imageUrl || null,
        is_hidden: Boolean(p.isHidden),
        is_featured: Boolean(p.isTopSeller),
        is_new: false,
        discount_percent: p.discountPercent || null,
        fragrance_pyramid: null,
        safety_data: null,
        updated_at: new Date().toISOString(),
      }));

      for (let i = 0; i < batch.length; i += 50) {
        await Promise.resolve(
          client.from('tulip_products').upsert(batch.slice(i, i + 50), { onConflict: 'id' })
        ).catch(() => {});
      }
    }

    // Sync orders in batches of 25
    if (Array.isArray(db.orders) && db.orders.length > 0) {
      const ordersBatch = db.orders.map((o) => ({
        id: o.id,
        order_number: o.orderNumber,
        status: o.status,
        date: o.date,
        total_da: o.totalDA,
        is_proforma: Boolean(o.isProforma),
        customer: o.customer,
        items: o.items,
        notes: o.customer?.notes || null,
        updated_at: new Date().toISOString(),
      }));

      for (let i = 0; i < ordersBatch.length; i += 25) {
        await Promise.resolve(
          client.from('tulip_orders').upsert(ordersBatch.slice(i, i + 25), { onConflict: 'id' })
        ).catch(() => {});
      }
    }
  } catch {
    // Non-blocking catch
  }
}
