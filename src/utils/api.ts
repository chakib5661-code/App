import {
  Product,
  PreOrder,
  CustomerApplication,
  CustomerUser,
  AdBanner,
  StoreSettings,
  CustomerAccountStatus,
  AdminUser,
} from '../types';
import { idbSaveSyncSnapshot, idbGetSyncSnapshot, idbSaveProducts } from './indexedDb';
import { prefetchProductImages } from './imageCache';
import { directClientFetchFromSupabase, getClientSupabaseCredentials } from './supabaseClient';

export interface SyncDataResponse {
  status: string;
  visitorCountry?: string;
  products: Product[];
  orders: PreOrder[];
  customerApplications: CustomerApplication[];
  customerUsers: CustomerUser[];
  adminUsers?: AdminUser[];
  adBanners: AdBanner[];
  storeSettings: StoreSettings;
  storageProvider?: string;
  analyticsConfig?: {
    gaMeasurementId?: string;
    clarityProjectId?: string;
  };
  lastUpdated: string;
  serverTime: string;
}

export const OFFLINE_SYNC_CACHE_KEY = 'tulip_offline_sync_snapshot';

export function getCachedSyncData(): SyncDataResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('tulip_saved_store_settings');
    if (raw) {
      const parsedSettings = JSON.parse(raw);
      // Return a skeleton snapshot containing ONLY the website parameters (storeSettings)
      return {
        status: 'ok',
        products: [],
        orders: [],
        customerApplications: [],
        customerUsers: [],
        adBanners: [],
        storeSettings: parsedSettings,
        lastUpdated: new Date().toISOString(),
        serverTime: new Date().toISOString(),
      };
    }
  } catch (e) {
    console.warn('[Cache] Could not read offline parameters:', e);
  }
  return null;
}

export function saveCachedSyncData(data: SyncDataResponse): void {
  if (typeof window === 'undefined' || !data) return;
  try {
    if (data.storeSettings) {
      // ONLY persist the website parameters (storeSettings) to localStorage
      localStorage.setItem('tulip_saved_store_settings', JSON.stringify(data.storeSettings));
    }
  } catch (e) {
    console.warn('[Cache] Could not save website parameters:', e);
  }
  // Catalog & product caching, image prefetching, and IndexedDB snapshots are completely disabled
}

export async function fetchSyncData(timeoutMs = 1800, bypassCache = false): Promise<SyncDataResponse | null> {
  // If user is explicitly offline and not bypassing cache, return cached parameters instantly
  if (!bypassCache && typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = getCachedSyncData();
    if (cached) return cached;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    // Append unique timestamp and admin=true parameters to let server optimize response size and allow Edge Caching
    const url = bypassCache ? `/api/sync?t=${Date.now()}&admin=true` : '/api/sync';
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: SyncDataResponse = await res.json();
    if (Array.isArray(data.products) && data.products.length > 0) {
      saveCachedSyncData(data);
      return data;
    }
  } catch (err: any) {
    clearTimeout(timer);
  }

  // DIRECT SUPABASE FALLBACK: If serverless function is empty or unavailable,
  // load the complete live store state directly from Supabase (works on all devices & mobile phones!)
  try {
    const directSupabaseData = await directClientFetchFromSupabase();
    if (directSupabaseData && Array.isArray(directSupabaseData.products) && directSupabaseData.products.length > 0) {
      const formattedData: SyncDataResponse = {
        status: 'ok',
        products: directSupabaseData.products,
        orders: Array.isArray(directSupabaseData.orders) ? directSupabaseData.orders : [],
        customerApplications: Array.isArray(directSupabaseData.customerApplications) ? directSupabaseData.customerApplications : [],
        customerUsers: Array.isArray(directSupabaseData.customerUsers) ? directSupabaseData.customerUsers : [],
        adBanners: Array.isArray(directSupabaseData.adBanners) ? directSupabaseData.adBanners : [],
        storeSettings: directSupabaseData.storeSettings || ({} as any),
        lastUpdated: directSupabaseData.lastUpdated || new Date().toISOString(),
        serverTime: new Date().toISOString(),
      };
      saveCachedSyncData(formattedData);
      return formattedData;
    }
  } catch (supabaseErr) {
    console.warn('[API] directClientFetchFromSupabase notice:', supabaseErr);
  }

  return null;
}

export async function submitOrderToServer(
  order: PreOrder
): Promise<{ success: boolean; order?: PreOrder; updatedProducts?: Product[]; error?: string }> {
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Erreur enregistrement commande' };
    }
    return { success: true, order: json.order, updatedProducts: json.updatedProducts };
  } catch (err: any) {
    console.error('[API] submitOrderToServer error:', err);
    return { success: false, error: err.message || 'Erreur réseau lors de la commande' };
  }
}

export async function updateOrderStatusOnServer(
  orderId: string,
  status: PreOrder['status']
): Promise<{ success: boolean; order?: PreOrder; updatedProducts?: Product[] }> {
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    return {
      success: Boolean(json.success),
      order: json.order,
      updatedProducts: json.updatedProducts,
    };
  } catch (err) {
    console.error('[API] updateOrderStatusOnServer error:', err);
    return { success: false };
  }
}

export async function deleteOrderOnServer(
  orderId: string
): Promise<{ success: boolean; updatedProducts?: Product[] }> {
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    return {
      success: Boolean(json.success),
      updatedProducts: json.updatedProducts,
    };
  } catch (err) {
    console.error('[API] deleteOrderOnServer error:', err);
    return { success: false };
  }
}

export async function bulkDeleteOrdersOnServer(
  orderIds: string[]
): Promise<{ success: boolean; deletedCount?: number; updatedProducts?: Product[] }> {
  try {
    const res = await fetch('/api/orders/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds }),
    });
    const json = await res.json();
    return {
      success: Boolean(json.success),
      deletedCount: json.deletedCount,
      updatedProducts: json.updatedProducts,
    };
  } catch (err) {
    console.error('[API] bulkDeleteOrdersOnServer error:', err);
    return { success: false };
  }
}

export async function updateOrderOnServer(
  orderId: string,
  patch: Partial<PreOrder>
): Promise<{ success: boolean; order?: PreOrder; updatedProducts?: Product[] }> {
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    return {
      success: Boolean(json.success),
      order: json.order,
      updatedProducts: json.updatedProducts,
    };
  } catch (err) {
    console.error('[API] updateOrderOnServer error:', err);
    return { success: false };
  }
}

export async function loginCustomerOnServer(
  identifier: string,
  password?: string
): Promise<{ success: boolean; customer?: CustomerUser; error?: string; status?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    if (!res.ok) {
      try {
        const errJson = await res.json();
        return { success: false, error: errJson.error || `Erreur serveur (${res.status})` };
      } catch {
        return { success: false, error: `Erreur serveur HTTP ${res.status}` };
      }
    }
    const json = await res.json();
    return json;
  } catch (err: any) {
    console.error('[API] loginCustomerOnServer error:', err);
    return { success: false, error: 'Problème de communication avec le serveur Tulip.' };
  }
}

export async function registerCustomerOnServer(data: {
  fullName: string;
  companyName: string;
  phone: string;
  secondaryPhone?: string;
  email: string;
  password?: string;
  wilayaCode?: string;
  wilayaName?: string;
  commune?: string;
  deliveryAddress?: string;
  notes?: string;
  autoApprove?: boolean;
}): Promise<{
  success: boolean;
  customer?: CustomerUser;
  application?: CustomerApplication;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return json;
  } catch (err: any) {
    console.error('[API] registerCustomerOnServer error:', err);
    return { success: false, error: 'Impossible de joindre le serveur d\'enregistrement.' };
  }
}

export async function approveCustomerOnServer(
  applicationId: string,
  assignedUsername: string,
  assignedPassword: string,
  verificationNotes?: string
): Promise<CustomerUser | null> {
  try {
    const res = await fetch('/api/customers/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId,
        assignedUsername,
        assignedPassword,
        verificationNotes,
      }),
    });
    const json = await res.json();
    return json.success ? json.customer : null;
  } catch (err) {
    console.error('[API] approveCustomerOnServer error:', err);
    return null;
  }
}

export async function updateCustomerStatusOnServer(
  customerId: string,
  status: CustomerAccountStatus
): Promise<CustomerUser | null> {
  try {
    const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    return json.success ? json.customer : null;
  } catch (err) {
    console.error('[API] updateCustomerStatusOnServer error:', err);
    return null;
  }
}

export async function resetCustomerPasswordOnServer(
  customerId: string,
  newPassword: string
): Promise<CustomerUser | null> {
  try {
    const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}/reset-password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword }),
    });
    const json = await res.json();
    return json.success ? json.customer : null;
  } catch (err) {
    console.error('[API] resetCustomerPasswordOnServer error:', err);
    return null;
  }
}

export async function createDirectCustomerOnServer(
  data: Omit<CustomerUser, 'id' | 'createdAt'>
): Promise<CustomerUser | null> {
  try {
    const res = await fetch('/api/customers/create-direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return json.success ? json.customer : null;
  } catch (err) {
    console.error('[API] createDirectCustomerOnServer error:', err);
    return null;
  }
}

export async function deleteCustomerOnServer(customerId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    return Boolean(json.success);
  } catch (err) {
    console.error('[API] deleteCustomerOnServer error:', err);
    return false;
  }
}

export async function updateCustomerOnServer(
  customerId: string,
  updatedFields: Partial<CustomerUser>
): Promise<CustomerUser | null> {
  try {
    const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedFields),
    });
    const json = await res.json();
    return json.success ? json.customer : null;
  } catch (err) {
    console.error('[API] updateCustomerOnServer error:', err);
    return null;
  }
}

export async function deleteCustomerApplicationOnServer(applicationId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/customers/application/${encodeURIComponent(applicationId)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    return Boolean(json.success);
  } catch (err) {
    console.error('[API] deleteCustomerApplicationOnServer error:', err);
    return false;
  }
}

export async function syncProductsOnServer(products: Product[]): Promise<Product[] | null> {
  try {
    const res = await fetch('/api/products/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products }),
    });
    const json = await res.json();
    return json.success ? json.products : null;
  } catch (err) {
    console.error('[API] syncProductsOnServer error:', err);
    return null;
  }
}

export async function updateSingleProductOnServer(
  id: string,
  stock: number,
  priceDA?: number,
  isHidden?: boolean
): Promise<Product | null> {
  try {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock, priceDA, isHidden }),
    });
    const json = await res.json();
    return json.success ? json.product : null;
  } catch (err) {
    console.error('[API] updateSingleProductOnServer error:', err);
    return null;
  }
}

export async function createSingleProductOnServer(product: Product): Promise<Product | null> {
  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    const json = await res.json();
    return json.success ? json.product : null;
  } catch (err) {
    console.error('[API] createSingleProductOnServer error:', err);
    return null;
  }
}

export async function saveSingleProductOnServer(product: Product): Promise<Product | null> {
  try {
    const res = await fetch(`/api/products/${encodeURIComponent(product.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    const json = await res.json();
    return json.success ? json.product : null;
  } catch (err) {
    console.error('[API] saveSingleProductOnServer error:', err);
    return null;
  }
}

export async function deleteSingleProductOnServer(
  id: string
): Promise<{ success: boolean; products?: Product[] }> {
  try {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    return {
      success: Boolean(json.success),
      products: json.products,
    };
  } catch (err) {
    console.error('[API] deleteSingleProductOnServer error:', err);
    return { success: false };
  }
}

/**
 * Web Audio API synthesizer for elegant luxury notification chimes (0 external assets required)
 */
export function playRealtimeChime(type: 'order' | 'proforma' | 'access' = 'order'): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number, gainVal: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(gainVal, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    };

    if (type === 'proforma') {
      // Pleasant double tone for proforma
      playTone(587.33, now, 0.25, 0.2); // D5
      playTone(880.00, now + 0.12, 0.45, 0.25); // A5
    } else if (type === 'access') {
      // Ascending triple chime for new B2B access request
      playTone(523.25, now, 0.2, 0.2); // C5
      playTone(659.25, now + 0.1, 0.2, 0.2); // E5
      playTone(783.99, now + 0.2, 0.4, 0.25); // G5
    } else {
      // Warm luxury chime for confirmed pre-orders
      playTone(659.25, now, 0.25, 0.2); // E5
      playTone(987.77, now + 0.12, 0.5, 0.25); // B5
    }
  } catch (e) {
    // Audio autoplay or permissions notice (safe fallback)
  }
}

export async function updateBannersOnServer(banners: AdBanner[]): Promise<AdBanner[] | null> {
  try {
    const res = await fetch('/api/banners', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banners }),
    });
    const json = await res.json();
    return json.success ? json.banners : null;
  } catch (err) {
    console.error('[API] updateBannersOnServer error:', err);
    return null;
  }
}

export async function updateSettingsOnServer(settings: StoreSettings): Promise<StoreSettings | null> {
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    });
    const json = await res.json();
    return json.success ? json.settings : null;
  } catch (err) {
    console.error('[API] updateSettingsOnServer error:', err);
    return null;
  }
}

export async function importCustomersOnServer(
  customers: CustomerUser[],
  replaceExisting: boolean = false
): Promise<{ success: boolean; customerUsers?: CustomerUser[]; customerApplications?: CustomerApplication[]; error?: string }> {
  try {
    const res = await fetch('/api/customers/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customers, replaceExisting }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Erreur importation clients' };
    }
    return {
      success: true,
      customerUsers: json.customerUsers,
      customerApplications: json.customerApplications,
    };
  } catch (err: any) {
    console.error('[API] importCustomersOnServer error:', err);
    return { success: false, error: err.message || 'Erreur réseau importation clients' };
  }
}

export async function restoreAllDataOnServer(
  backup: any
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch('/api/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backup }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Erreur restauration serveur' };
    }
    return { success: true, data: json.data };
  } catch (err: any) {
    console.error('[API] restoreAllDataOnServer error:', err);
    return { success: false, error: err.message || 'Erreur réseau restauration données' };
  }
}

export async function syncOrdersOnServer(
  orders: PreOrder[]
): Promise<{ success: boolean; orders?: PreOrder[]; updatedProducts?: Product[] }> {
  try {
    const res = await fetch('/api/orders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders }),
    });
    const json = await res.json();
    return {
      success: Boolean(json.success),
      orders: json.orders,
      updatedProducts: json.updatedProducts,
    };
  } catch (err) {
    console.error('[API] syncOrdersOnServer error:', err);
    return { success: false };
  }
}

export interface DetectedTelegramChat {
  chatId: string;
  name: string;
  username?: string;
  chatType: 'group' | 'supergroup' | 'channel' | 'private' | string;
  lastMessage?: string;
  date?: string;
  isConfigured?: boolean;
  assignedChannels?: ('preorder' | 'proforma' | 'access' | 'general')[];
}

export interface DetectTelegramChatsResponse {
  success: boolean;
  count: number;
  detectedChats: DetectedTelegramChat[];
  bot?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
  } | null;
  error?: string;
}

export async function detectTelegramChats(token?: string): Promise<DetectTelegramChatsResponse> {
  try {
    const res = await fetch('/api/telegram/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      count: 0,
      detectedChats: [],
      error: err.message || 'Erreur lors de la détection des canaux Telegram.',
    };
  }
}

export interface TelegramStatusResponse {
  configured: boolean;
  tokenMasked?: string;
  chatId?: string;
  preorderChatId?: string;
  proformaChatId?: string;
  accessChatId?: string;
  resolvedPreorderChats?: string[];
  resolvedProformaChats?: string[];
  resolvedAccessChats?: string[];
  isChatIdSelfBot?: boolean;
  enabled?: boolean;
  bot?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
  } | null;
  subscribers?: {
    chatId: string;
    chatType?: string;
    name: string;
    username?: string;
    text?: string;
    date?: string;
  }[];
  error?: string | null;
}

export async function fetchTelegramStatus(): Promise<TelegramStatusResponse> {
  try {
    const res = await fetch('/api/telegram/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    return { configured: false, error: err.message };
  }
}

export async function triggerTelegramTest(
  chatId?: string,
  token?: string,
  channelType: 'preorder' | 'proforma' | 'access' | 'general' = 'general'
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, token, channelType }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Erreur lors du test Telegram.' };
    }
    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erreur réseau.' };
  }
}

export async function saveTelegramSettings(settings: {
  telegramChatId?: string;
  telegramPreorderChatId?: string;
  telegramProformaChatId?: string;
  telegramAccessChatId?: string;
  telegramBotToken?: string;
  telegramNotificationsEnabled?: boolean;
}): Promise<{ success: boolean; settings?: any; error?: string }> {
  try {
    const res = await fetch('/api/telegram/save-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Erreur sauvegarde paramètres Telegram.' };
    }
    return { success: true, settings: data.settings };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erreur réseau.' };
  }
}

export async function checkSupabaseStatus(): Promise<{
  success: boolean;
  configured: boolean;
  connected: boolean;
  url?: string;
  hasStateTable?: boolean;
  details?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/supabase/status');
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      // The serverless function might have thrown 500 or returned text
      return {
        success: false,
        configured: false,
        connected: false,
        error: `Réponse serveur non-JSON (${res.status}): ${text.slice(0, 120)}`,
      };
    }
    return data;
  } catch (err: any) {
    return {
      success: false,
      configured: false,
      connected: false,
      error: err?.message || 'Erreur lors de la vérification de Supabase',
    };
  }
}

export async function syncDatabaseToSupabase(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/supabase/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return {
        success: false,
        error: `Erreur serveur Vercel (${res.status}): ${text.slice(0, 150)}`,
      };
    }
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Erreur de connexion lors du push vers Supabase',
    };
  }
}

// ---------------- REAL-TIME SERVER-SENT EVENTS (SSE) LISTENER ----------------

export type ServerEventType =
  | 'connected'
  | 'order:created'
  | 'order:updated'
  | 'order:deleted'
  | 'orders:synced'
  | 'orders:bulk_deleted'
  | 'customer:registered'
  | 'customer:approved'
  | 'customer:updated'
  | 'customer:created'
  | 'customer:deleted'
  | 'customer:application_deleted'
  | 'product:created'
  | 'product:updated'
  | 'product:deleted'
  | 'products:updated'
  | 'products:synced'
  | 'banners:updated'
  | 'settings:updated';

export interface ServerEventData {
  type: ServerEventType;
  payload: any;
  timestamp: string;
}

/**
 * Connects to the real-time SSE stream at /api/events.
 * Provides instant multi-tab and multi-device dispatch for pre-orders, proformas,
 * access orders, status updates, and irreversible database rewrites.
 */
export function subscribeToServerEvents(
  onEvent: (event: ServerEventData) => void
): () => void {
  console.log('[SSE] Real-time synchronization is disabled per configuration.');
  return () => {};
}

export async function syncAdminUsersOnServer(users: AdminUser[]): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(users),
    });
    const json = await res.json();
    return Boolean(json.success);
  } catch (err) {
    console.error('[API] syncAdminUsersOnServer error:', err);
    return false;
  }
}

// Vercel Blob - Media & Backup upload/import/export client endpoints
export async function uploadMediaToServer(
  base64: string,
  filename?: string
): Promise<{ success: boolean; url?: string; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/media/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, filename }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[API] uploadMediaToServer error:', err);
    return { success: false, error: err.message || 'Erreur réseau lors de l\'envoi de l\'image.' };
  }
}

export async function exportDatabaseToBlobOnServer(): Promise<{
  success: boolean;
  url?: string;
  filename?: string;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/backup/export-blob', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[API] exportDatabaseToBlobOnServer error:', err);
    return { success: false, error: err.message || 'Erreur réseau lors de l\'exportation de la sauvegarde.' };
  }
}

export async function importDatabaseFromBlobOnServer(
  url: string
): Promise<{ success: boolean; message?: string; data?: any; error?: string }> {
  try {
    const res = await fetch('/api/backup/import-blob', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[API] importDatabaseFromBlobOnServer error:', err);
    return { success: false, error: err.message || 'Erreur réseau lors de l\'importation de la sauvegarde.' };
  }
}



