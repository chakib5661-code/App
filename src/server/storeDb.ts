import fs from 'fs';
import path from 'path';
import { put } from '@vercel/blob';
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
import { INITIAL_PRODUCTS, INITIAL_STORE_SETTINGS } from '../data/initialProducts';
import { INITIAL_CUSTOMER_APPLICATIONS, INITIAL_AD_BANNERS } from '../data/initialCustomerData';
import {
  isSupabaseConfigured,
  loadDatabaseFromSupabase,
  saveDatabaseToSupabase,
} from './supabaseDb';

export interface ServerDatabase {
  products: Product[];
  orders: PreOrder[];
  customerApplications: CustomerApplication[];
  customerUsers: CustomerUser[];
  adBanners: AdBanner[];
  storeSettings: StoreSettings;
  adminUsers?: AdminUser[];
  lastUpdated: string;
}

const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = process.env.DATA_DIR || (IS_VERCEL ? path.join('/tmp', 'tulip-data') : path.join(process.cwd(), 'data'));
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'store_db.json');
const SEED_FILE = path.join(process.cwd(), 'data', 'store_db.json');

function normalizePhone(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

function getInitialDatabase(): ServerDatabase {
  const initialUsers: CustomerUser[] = INITIAL_CUSTOMER_APPLICATIONS.filter(
    (app) => app.status === 'approved'
  ).map((app) => ({
    id: app.id,
    username: app.assignedUsername || app.email.split('@')[0],
    password: app.assignedPassword || 'tulip2026',
    fullName: app.fullName,
    companyName: app.companyName,
    email: app.email,
    phone: app.phone,
    secondaryPhone: app.secondaryPhone,
    wilayaCode: app.wilayaCode,
    wilayaName: app.wilayaName,
    commune: app.commune,
    deliveryAddress: app.deliveryAddress,
    status: 'approved',
    createdAt: app.approvedAt || app.submittedAt,
  }));

  return {
    products: INITIAL_PRODUCTS,
    orders: [],
    customerApplications: INITIAL_CUSTOMER_APPLICATIONS,
    customerUsers: initialUsers,
    adBanners: INITIAL_AD_BANNERS,
    storeSettings: INITIAL_STORE_SETTINGS,
    adminUsers: [
      {
        id: 'user-admin-root',
        username: 'admin',
        fullName: 'Administrateur Principal',
        role: 'admin',
        password: 'tulip',
        createdAt: new Date().toISOString(),
      }
    ],
    lastUpdated: new Date().toISOString(),
  };
}

let cachedDb: ServerDatabase | null = null;
let lastSupabaseFetchTime = 0;
let isOptimizingImages = false;

async function optimizeBase64Image(dataUrl: string, maxDim = 450, quality = 70): Promise<string> {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/') || dataUrl.length < 20 * 1024) {
    return dataUrl;
  }
  try {
    const sharp = require('sharp');
    const matches = dataUrl.match(/^data:([A-Za-z0-9\-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return dataUrl;
    const buffer = Buffer.from(matches[2], 'base64');
    const optimized = await sharp(buffer)
      .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    return `data:image/webp;base64,${optimized.toString('base64')}`;
  } catch {
    return dataUrl;
  }
}

export async function optimizeDatabaseImagesAsync(db: ServerDatabase): Promise<void> {
  if (isOptimizingImages) return;
  isOptimizingImages = true;
  try {
    let changed = false;
    for (let i = 0; i < db.products.length; i++) {
      const p = db.products[i];
      if (p.imageUrl && p.imageUrl.startsWith('data:image/') && p.imageUrl.length > 20 * 1024) {
        const opt = await optimizeBase64Image(p.imageUrl, 450, 70);
        if (opt !== p.imageUrl) {
          p.imageUrl = opt;
          changed = true;
        }
      }
    }
    for (let j = 0; j < db.adBanners.length; j++) {
      const b = db.adBanners[j];
      if (b.imageUrl && b.imageUrl.startsWith('data:image/') && b.imageUrl.length > 80 * 1024) {
        const opt = await optimizeBase64Image(b.imageUrl, 1000, 75);
        if (opt !== b.imageUrl) {
          b.imageUrl = opt;
          changed = true;
        }
      }
    }
    if (changed) {
      await persistDatabaseAsync(db);
    }
  } catch (err) {
    console.warn('[StoreDB] Image optimization notice:', err);
  } finally {
    isOptimizingImages = false;
  }
}

/**
 * Loads the database synchronously from memory or disk cache (legacy fallback).
 */
export function loadDatabase(): ServerDatabase {
  if (cachedDb) {
    return cachedDb;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE) && fs.existsSync(SEED_FILE) && path.resolve(DB_FILE) !== path.resolve(SEED_FILE)) {
      try {
        fs.copyFileSync(SEED_FILE, DB_FILE);
      } catch (copyErr) {
        console.warn('[StoreDB] Could not copy seed db:', copyErr);
      }
    }

    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.products)) {
        const loadedProducts = parsed.products.length > 0 ? parsed.products : INITIAL_PRODUCTS;
        const defaultAdmins: AdminUser[] = [
          {
            id: 'user-admin-root',
            username: 'admin',
            fullName: 'Administrateur Principal',
            role: 'admin',
            password: 'tulip',
            createdAt: new Date().toISOString(),
          }
        ];
        cachedDb = {
          products: loadedProducts,
          orders: Array.isArray(parsed.orders)
            ? parsed.orders.sort(
                (a: PreOrder, b: PreOrder) => new Date(b.date).getTime() - new Date(a.date).getTime()
              )
            : [],
          customerApplications: Array.isArray(parsed.customerApplications) ? parsed.customerApplications : [],
          customerUsers: Array.isArray(parsed.customerUsers) ? parsed.customerUsers : [],
          adBanners: Array.isArray(parsed.adBanners) ? parsed.adBanners : [],
          storeSettings: parsed.storeSettings || INITIAL_STORE_SETTINGS,
          adminUsers: Array.isArray(parsed.adminUsers) && parsed.adminUsers.length > 0 ? parsed.adminUsers : defaultAdmins,
          lastUpdated: parsed.lastUpdated || new Date().toISOString(),
        };
        return cachedDb;
      }
    }
  } catch (err) {
    console.error('[StoreDB] Error reading DB_FILE:', err);
  }

  cachedDb = getInitialDatabase();
  return cachedDb;
}

/**
 * Loads the database asynchronously, using SUPABASE as the Single Source of Truth.
 */
export async function loadDatabaseAsync(forceRefresh = false): Promise<ServerDatabase> {
  const now = Date.now();
  // If Supabase is configured, ALWAYS query the real database in real-time. No caching to avoid state mismatch!
  if (isSupabaseConfigured()) {
    try {
      const remoteDb = await loadDatabaseFromSupabase();
      if (remoteDb && Array.isArray(remoteDb.products) && remoteDb.products.length > 0) {
        // Ensure priority ordering for orders
        if (Array.isArray(remoteDb.orders)) {
          remoteDb.orders.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
        }
        cachedDb = remoteDb;
        lastSupabaseFetchTime = now;

        // Self-heal and migrate inline base64 images to CDN / highly compressed WebPs on load to reduce Fast Origin Transfer instantly!
        const hasBase64 = remoteDb.products.some(p => p.imageUrl && p.imageUrl.startsWith('data:image/')) ||
                          remoteDb.adBanners.some(b => b.imageUrl && b.imageUrl.startsWith('data:image/'));
        if (hasBase64) {
          console.log('[StoreDB Optimizer] Database has base64 images on load. Triggering background self-healing migration...');
          persistDatabaseAsync(remoteDb).catch(() => {});
        }

        // Persist local disk copy for recovery
        try {
          if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
          }
          fs.writeFileSync(DB_FILE, JSON.stringify(remoteDb, null, 2), 'utf-8');
        } catch {}

        return cachedDb;
      } else {
        // If Supabase is connected but empty, seed it with local database
        const localDb = loadDatabase();
        console.log('[StoreDB] Supabase is empty. Seeding initial data to Supabase...');
        await saveDatabaseToSupabase(localDb);
        cachedDb = localDb;
        lastSupabaseFetchTime = now;
        return cachedDb;
      }
    } catch (err) {
      console.warn('[StoreDB] loadDatabaseAsync error from Supabase, using local cache fallback:', err);
    }
  }

  return loadDatabase();
}

/**
 * Automatically optimizes and migrates inline base64 images to Vercel Blob storage,
 * or falls back to inline micro-compression via Sharp.
 * This keeps the database payload extremely compact, reducing "Fast Origin Transfer" by 99%!
 */
async function optimizeAndMigrateImages(db: ServerDatabase): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  let sharp: any;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.warn('[StoreDB Optimizer] Sharp is not available, skipping active image resizing:', e);
  }

  // 1. Optimize Products
  if (Array.isArray(db.products)) {
    for (const p of db.products) {
      if (p.imageUrl && p.imageUrl.startsWith('data:image/') && p.imageUrl.includes(';base64,')) {
        try {
          const matches = p.imageUrl.match(/^data:([A-Za-z0-9\-+\/]+);base64,(.+)$/);
          if (!matches || matches.length !== 3) continue;
          const contentType = matches[1];
          let buffer = Buffer.from(matches[2], 'base64');

          // Optimize image buffer using Sharp if available
          if (sharp) {
            try {
              buffer = await sharp(buffer)
                .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 60, effort: 4 })
                .toBuffer();
            } catch (sharpErr) {
              console.warn('[StoreDB Optimizer] Sharp resize failed for product image:', p.id, sharpErr);
            }
          }

          if (token) {
            // Upload to Vercel Blob
            const uniqueFilename = `product-migrated-${p.id}-${Date.now()}.webp`;
            const blob = await put(`media/${uniqueFilename}`, buffer, {
              access: 'public',
              contentType: 'image/webp',
              token,
            });
            console.log(`[StoreDB Optimizer] Migrated product image to Vercel Blob CDN: ${blob.url}`);
            p.imageUrl = blob.url;
          } else {
            // Fallback to inline micro-compressed base64 WebP to avoid bloating DB snapshot
            const optimizedBase64 = buffer.toString('base64');
            p.imageUrl = `data:image/webp;base64,${optimizedBase64}`;
            console.log(`[StoreDB Optimizer] Micro-compressed inline base64 for product: ${p.id} (${Math.round(optimizedBase64.length / 1024)} KB)`);
          }
        } catch (err: any) {
          console.warn('[StoreDB Optimizer] Failed to optimize product image:', p.id, err?.message || err);
        }
      }
    }
  }

  // 2. Optimize Ad Banners
  if (Array.isArray(db.adBanners)) {
    for (const b of db.adBanners) {
      if (b.imageUrl && b.imageUrl.startsWith('data:image/') && b.imageUrl.includes(';base64,')) {
        try {
          const matches = b.imageUrl.match(/^data:([A-Za-z0-9\-+\/]+);base64,(.+)$/);
          if (!matches || matches.length !== 3) continue;
          const contentType = matches[1];
          let buffer = Buffer.from(matches[2], 'base64');

          // Optimize image buffer using Sharp if available (banners can be wider)
          if (sharp) {
            try {
              buffer = await sharp(buffer)
                .resize(1000, 400, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 60, effort: 4 })
                .toBuffer();
            } catch (sharpErr) {
              console.warn('[StoreDB Optimizer] Sharp resize failed for banner image:', b.id, sharpErr);
            }
          }

          if (token) {
            // Upload to Vercel Blob
            const uniqueFilename = `banner-migrated-${b.id}-${Date.now()}.webp`;
            const blob = await put(`media/${uniqueFilename}`, buffer, {
              access: 'public',
              contentType: 'image/webp',
              token,
            });
            console.log(`[StoreDB Optimizer] Migrated banner image to Vercel Blob CDN: ${blob.url}`);
            b.imageUrl = blob.url;
          } else {
            // Fallback to inline micro-compressed base64 WebP
            const optimizedBase64 = buffer.toString('base64');
            b.imageUrl = `data:image/webp;base64,${optimizedBase64}`;
            console.log('[StoreDB Optimizer] Micro-compressed inline base64 for banner:', b.id);
          }
        } catch (err: any) {
          console.warn('[StoreDB Optimizer] Failed to optimize banner image:', b.id, err?.message || err);
        }
      }
    }
  }
}

/**
 * Persists the entire database asynchronously:
 * 1. Guarantees newest-first order sorting (Orders Priority)
 * 2. Directly awaits upsert to SUPABASE (Single Source of Truth)
 * 3. Writes local backup file
 */
export async function persistDatabaseAsync(db: ServerDatabase): Promise<void> {
  try {
    // Automatically filter, micro-compress, and migrate base64 image content to high-performance CDN URLs
    await optimizeAndMigrateImages(db).catch((optErr) => {
      console.warn('[StoreDB Optimizer] Non-blocking optimizeAndMigrateImages error:', optErr);
    });

    db.lastUpdated = new Date().toISOString();
    if (!Array.isArray(db.products) || db.products.length === 0) {
      if (cachedDb && Array.isArray(cachedDb.products) && cachedDb.products.length > 0) {
        db.products = cachedDb.products;
      } else {
        db.products = [...INITIAL_PRODUCTS];
      }
    }
    if (Array.isArray(db.orders)) {
      db.orders.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    }
    cachedDb = db;

    // Await Supabase cloud commit FIRST so serverless lambda never terminates before cloud write completes
    if (isSupabaseConfigured()) {
      const saved = await saveDatabaseToSupabase(db);
      if (!saved) {
        console.warn('[StoreDB] Notice: Supabase cloud write did not report success.');
      }
    }

    // Local file write backup
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    } catch (fsErr) {
      // In read-only or serverless envs, disk errors are non-fatal since Supabase holds the data
    }
  } catch (err) {
    console.error('[StoreDB] Error in persistDatabaseAsync:', err);
  }
}

/**
 * Synchronous persist wrapper (calls async persist in background).
 */
export function persistDatabase(db: ServerDatabase): void {
  persistDatabaseAsync(db).catch((err) => {
    console.error('[StoreDB] Background persist notice:', err);
  });
}

/**
 * Loads database asynchronously from Supabase if available.
 */
export async function syncWithSupabaseAsync(): Promise<ServerDatabase> {
  return await loadDatabaseAsync(true);
}

// ---------------- ORDERS (COMMANDES) ----------------

export async function getAllOrdersAsync(): Promise<PreOrder[]> {
  const db = await loadDatabaseAsync();
  return [...db.orders].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getAllOrders(): PreOrder[] {
  const db = loadDatabase();
  return [...db.orders].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/**
 * Create or update order with PRIORITY & Supabase persistence:
 * - Checks for duplicate by ID or orderNumber
 * - Deducts inventory stock
 * - Inserts at top of orders array (unshift)
 * - Sorts by date desc
 * - Awaits Supabase save before returning
 */
export async function createOrder(orderPayload: PreOrder): Promise<{ order: PreOrder; updatedProducts: Product[] }> {
  const db = await loadDatabaseAsync(true);

  const timestamp = Date.now();
  const isProforma = Boolean(orderPayload.isProforma);
  const prefix = isProforma ? 'PRO' : 'PRE';
  const orderNumber =
    orderPayload.orderNumber || `${prefix}-${new Date().getFullYear()}-${timestamp.toString().slice(-5)}`;

  const orderId = orderPayload.id || `order-${timestamp}-${Math.random().toString(36).slice(2, 6)}`;

  const newOrder: PreOrder = {
    ...orderPayload,
    id: orderId,
    orderNumber,
    date: orderPayload.date || new Date().toISOString(),
    status: orderPayload.status || 'en_attente',
    isProforma,
    isOfflinePending: false,
  };

  // Check if order already exists (e.g. offline queue retry)
  const existingIndex = db.orders.findIndex(
    (o) => o.id === orderId || o.orderNumber === orderNumber
  );

  if (existingIndex >= 0) {
    db.orders[existingIndex] = newOrder;
  } else {
    // Deduct stock for new order
    db.products = db.products.map((prod) => {
      const item = newOrder.items.find((i) => i.productId === prod.id || i.code === prod.code);
      if (item && item.quantity > 0) {
        const newStock = Math.max(0, prod.stock - item.quantity);
        return {
          ...prod,
          stock: newStock,
          lastUpdated: new Date().toISOString(),
        };
      }
      return prod;
    });

    db.orders.unshift(newOrder);
  }

  // Ensure priority sorting by date descending
  db.orders.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  await persistDatabaseAsync(db);

  return { order: newOrder, updatedProducts: db.products };
}

export async function updateOrderStatus(
  orderId: string,
  status: PreOrder['status']
): Promise<{ order: PreOrder; updatedProducts: Product[] } | null> {
  const db = await loadDatabaseAsync(true);
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) return null;

  const oldStatus = order.status;
  order.status = status;

  // Restore stock when order is cancelled
  if (oldStatus !== 'annulee' && status === 'annulee') {
    db.products = db.products.map((prod) => {
      const item = order.items.find((i) => i.productId === prod.id || i.code === prod.code);
      if (item && item.quantity > 0) {
        return {
          ...prod,
          stock: prod.stock + item.quantity,
          lastUpdated: new Date().toISOString(),
        };
      }
      return prod;
    });
  } else if (oldStatus === 'annulee' && status !== 'annulee') {
    // If order was cancelled and is now reactivated, deduct stock again
    db.products = db.products.map((prod) => {
      const item = order.items.find((i) => i.productId === prod.id || i.code === prod.code);
      if (item && item.quantity > 0) {
        return {
          ...prod,
          stock: Math.max(0, prod.stock - item.quantity),
          lastUpdated: new Date().toISOString(),
        };
      }
      return prod;
    });
  }

  await persistDatabaseAsync(db);
  return { order, updatedProducts: db.products };
}

export async function updateOrder(
  orderId: string,
  patch: Partial<PreOrder>
): Promise<{ order: PreOrder; updatedProducts: Product[] } | null> {
  const db = await loadDatabaseAsync(true);
  const index = db.orders.findIndex((o) => o.id === orderId);
  if (index === -1) return null;

  const currentOrder = db.orders[index];
  const oldStatus = currentOrder.status;
  const newStatus = patch.status !== undefined ? patch.status : oldStatus;

  // Stock adjustment if status changed
  if (oldStatus !== 'annulee' && newStatus === 'annulee') {
    db.products = db.products.map((prod) => {
      const item = currentOrder.items.find((i) => i.productId === prod.id || i.code === prod.code);
      if (item && item.quantity > 0) {
        return {
          ...prod,
          stock: prod.stock + item.quantity,
          lastUpdated: new Date().toISOString(),
        };
      }
      return prod;
    });
  } else if (oldStatus === 'annulee' && newStatus !== 'annulee') {
    db.products = db.products.map((prod) => {
      const item = currentOrder.items.find((i) => i.productId === prod.id || i.code === prod.code);
      if (item && item.quantity > 0) {
        return {
          ...prod,
          stock: Math.max(0, prod.stock - item.quantity),
          lastUpdated: new Date().toISOString(),
        };
      }
      return prod;
    });
  }

  const updated: PreOrder = {
    ...currentOrder,
    ...patch,
    id: currentOrder.id,
  };
  db.orders[index] = updated;

  await persistDatabaseAsync(db);
  return { order: updated, updatedProducts: db.products };
}

export async function deleteOrder(orderId: string): Promise<{ success: boolean; updatedProducts?: Product[] }> {
  const db = await loadDatabaseAsync(true);
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) return { success: false };

  // If order was not cancelled, return stock on deletion
  if (order.status !== 'annulee') {
    db.products = db.products.map((prod) => {
      const item = order.items.find((i) => i.productId === prod.id || i.code === prod.code);
      if (item && item.quantity > 0) {
        return {
          ...prod,
          stock: prod.stock + item.quantity,
          lastUpdated: new Date().toISOString(),
        };
      }
      return prod;
    });
  }

  db.orders = db.orders.filter((o) => o.id !== orderId);
  await persistDatabaseAsync(db);
  return { success: true, updatedProducts: db.products };
}

export async function bulkDeleteOrders(
  orderIds: string[]
): Promise<{ success: boolean; deletedCount: number; updatedProducts: Product[] }> {
  const db = await loadDatabaseAsync(true);
  const idSet = new Set(orderIds);
  const ordersToDelete = db.orders.filter((o) => idSet.has(o.id));
  if (ordersToDelete.length === 0) {
    return { success: false, deletedCount: 0, updatedProducts: db.products };
  }

  // Restore stock for active orders being deleted
  ordersToDelete.forEach((order) => {
    if (order.status !== 'annulee') {
      db.products = db.products.map((prod) => {
        const item = order.items.find((i) => i.productId === prod.id || i.code === prod.code);
        if (item && item.quantity > 0) {
          return {
            ...prod,
            stock: prod.stock + item.quantity,
            lastUpdated: new Date().toISOString(),
          };
        }
        return prod;
      });
    }
  });

  db.orders = db.orders.filter((o) => !idSet.has(o.id));
  await persistDatabaseAsync(db);
  return { success: true, deletedCount: ordersToDelete.length, updatedProducts: db.products };
}

export async function syncOrders(ordersList: PreOrder[]): Promise<{ orders: PreOrder[]; updatedProducts: Product[] }> {
  const db = await loadDatabaseAsync(true);

  // Merge incoming list preserving orders from other devices
  const incomingMap = new Map<string, PreOrder>();
  ordersList.forEach((o) => incomingMap.set(o.id, o));

  ordersList.forEach((incoming) => {
    const existing = db.orders.find((o) => o.id === incoming.id);
    if (existing) {
      if (existing.status !== 'annulee' && incoming.status === 'annulee') {
        db.products = db.products.map((prod) => {
          const item = incoming.items.find((i) => i.productId === prod.id || i.code === prod.code);
          if (item && item.quantity > 0) {
            return {
              ...prod,
              stock: prod.stock + item.quantity,
              lastUpdated: new Date().toISOString(),
            };
          }
          return prod;
        });
      } else if (existing.status === 'annulee' && incoming.status !== 'annulee') {
        db.products = db.products.map((prod) => {
          const item = incoming.items.find((i) => i.productId === prod.id || i.code === prod.code);
          if (item && item.quantity > 0) {
            return {
              ...prod,
              stock: Math.max(0, prod.stock - item.quantity),
              lastUpdated: new Date().toISOString(),
            };
          }
          return prod;
        });
      }
    }
  });

  // Preserve existing orders not in incoming list, update existing ones
  const mergedOrders: PreOrder[] = [];
  const processedIds = new Set<string>();

  for (const o of ordersList) {
    mergedOrders.push(o);
    processedIds.add(o.id);
  }

  for (const existing of db.orders) {
    if (!processedIds.has(existing.id)) {
      mergedOrders.push(existing);
      processedIds.add(existing.id);
    }
  }

  // Priority sorting: latest date first
  mergedOrders.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  db.orders = mergedOrders;
  await persistDatabaseAsync(db);
  return { orders: db.orders, updatedProducts: db.products };
}

// ---------------- CUSTOMERS & AUTH ----------------

export async function getCustomersDataAsync() {
  const db = await loadDatabaseAsync();
  return {
    applications: db.customerApplications,
    users: db.customerUsers,
  };
}

export function getCustomersData() {
  const db = loadDatabase();
  return {
    applications: db.customerApplications,
    users: db.customerUsers,
  };
}

export async function registerCustomer(data: {
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
}): Promise<{ application: CustomerApplication; user: CustomerUser }> {
  const db = await loadDatabaseAsync(true);
  const id = `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const chosenPassword = (data.password && data.password.trim()) || 'tulip2026';
  const cleanUsername =
    data.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') ||
    data.phone.replace(/\D/g, '') ||
    `client_${Date.now().toString().slice(-4)}`;

  const shouldAutoApprove = Boolean(data.autoApprove);

  const application: CustomerApplication = {
    id,
    fullName: data.fullName.trim(),
    companyName: data.companyName.trim(),
    phone: data.phone.trim(),
    secondaryPhone: data.secondaryPhone?.trim(),
    email: data.email.trim().toLowerCase(),
    wilayaCode: data.wilayaCode || '16',
    wilayaName: data.wilayaName || 'Alger',
    commune: data.commune?.trim(),
    deliveryAddress: data.deliveryAddress?.trim(),
    notes: data.notes?.trim(),
    submittedAt: now,
    status: shouldAutoApprove ? 'approved' : 'pending',
    assignedUsername: shouldAutoApprove ? cleanUsername : undefined,
    assignedPassword: shouldAutoApprove ? chosenPassword : undefined,
    approvedAt: shouldAutoApprove ? now : undefined,
    approvedBy: shouldAutoApprove ? 'admin_auto' : undefined,
    verificationNotes: shouldAutoApprove ? 'Accès direct validé.' : undefined,
  };

  const user: CustomerUser = {
    id,
    username: shouldAutoApprove ? cleanUsername : '',
    password: shouldAutoApprove ? chosenPassword : '',
    fullName: data.fullName.trim(),
    companyName: data.companyName.trim(),
    email: data.email.trim().toLowerCase(),
    phone: data.phone.trim(),
    secondaryPhone: data.secondaryPhone?.trim(),
    wilayaCode: data.wilayaCode || '16',
    wilayaName: data.wilayaName || 'Alger',
    commune: data.commune?.trim(),
    deliveryAddress: data.deliveryAddress?.trim(),
    status: shouldAutoApprove ? 'approved' : 'pending',
    createdAt: now,
    lastLogin: shouldAutoApprove ? now : undefined,
  };

  db.customerApplications.unshift(application);
  if (shouldAutoApprove) {
    db.customerUsers.unshift(user);
  }

  await persistDatabaseAsync(db);
  return { application, user };
}

export async function authenticateCustomer(
  identifier: string,
  password?: string
): Promise<{ success: boolean; user?: CustomerUser; error?: string; status?: CustomerAccountStatus }> {
  const db = await loadDatabaseAsync(true);
  const cleanId = (identifier || '').trim().toLowerCase();
  const cleanInputDigits = normalizePhone(cleanId);
  const cleanPass = (password || '').trim();

  let foundUser = db.customerUsers.find((u) => {
    const matchUsername = u.username.toLowerCase() === cleanId;
    const matchEmail = u.email.toLowerCase() === cleanId;
    const matchPhone = cleanInputDigits && normalizePhone(u.phone) === cleanInputDigits;
    return matchUsername || matchEmail || matchPhone;
  });

  if (!foundUser) {
    const foundApp = db.customerApplications.find((app) => {
      const matchUsername = app.assignedUsername && app.assignedUsername.toLowerCase() === cleanId;
      const matchEmail = app.email.toLowerCase() === cleanId;
      const matchPhone = cleanInputDigits && normalizePhone(app.phone) === cleanInputDigits;
      return matchUsername || matchEmail || matchPhone;
    });

    if (foundApp) {
      if (foundApp.status === 'pending') {
        return {
          success: false,
          status: 'pending',
          error:
            "Votre demande d'accès B2B est en cours d'examen. Nos équipes commerciales vous transmettront votre identifiant et mot de passe par WhatsApp ou téléphone après validation.",
        };
      }
      if (foundApp.status === 'rejected' || foundApp.status === 'suspended') {
        return {
          success: false,
          status: foundApp.status,
          error: "Ce compte client a été suspendu ou désactivé par l'administrateur.",
        };
      }

      foundUser = {
        id: foundApp.id,
        username: foundApp.assignedUsername || foundApp.email.split('@')[0],
        password: foundApp.assignedPassword || 'tulip2026',
        fullName: foundApp.fullName,
        companyName: foundApp.companyName,
        email: foundApp.email,
        phone: foundApp.phone,
        secondaryPhone: foundApp.secondaryPhone,
        wilayaCode: foundApp.wilayaCode,
        wilayaName: foundApp.wilayaName,
        commune: foundApp.commune,
        deliveryAddress: foundApp.deliveryAddress,
        status: 'approved',
        createdAt: foundApp.approvedAt || foundApp.submittedAt,
      };
      db.customerUsers.push(foundUser);
      await persistDatabaseAsync(db);
    }
  }

  if (!foundUser) {
    return {
      success: false,
      error: "Identifiant (nom d'utilisateur, email ou numéro de téléphone) introuvable.",
    };
  }

  if (foundUser.status === 'suspended') {
    return {
      success: false,
      status: 'suspended',
      error: "Votre compte client a été suspendu par l'administrateur.",
    };
  }

  if (foundUser.password && cleanPass && foundUser.password !== cleanPass) {
    return {
      success: false,
      error: 'Mot de passe incorrect. Veuillez vérifier ou contacter le support.',
    };
  }

  foundUser.lastLogin = new Date().toISOString();
  await persistDatabaseAsync(db);

  return {
    success: true,
    user: foundUser,
    status: foundUser.status,
  };
}

export async function approveCustomerApplication(
  applicationId: string,
  assignedUsername: string,
  assignedPassword: string,
  verificationNotes?: string
): Promise<CustomerUser | null> {
  const db = await loadDatabaseAsync(true);
  const app = db.customerApplications.find((a) => a.id === applicationId);
  if (!app) return null;

  const now = new Date().toISOString();
  app.status = 'approved';
  app.assignedUsername = assignedUsername.trim();
  app.assignedPassword = assignedPassword.trim();
  app.approvedAt = now;
  app.approvedBy = 'admin';
  if (verificationNotes) {
    app.verificationNotes = verificationNotes.trim();
  }

  let user = db.customerUsers.find((u) => u.id === applicationId);
  if (!user) {
    user = {
      id: app.id,
      username: app.assignedUsername,
      password: app.assignedPassword,
      fullName: app.fullName,
      companyName: app.companyName,
      email: app.email,
      phone: app.phone,
      secondaryPhone: app.secondaryPhone,
      wilayaCode: app.wilayaCode,
      wilayaName: app.wilayaName,
      commune: app.commune,
      deliveryAddress: app.deliveryAddress,
      status: 'approved',
      createdAt: now,
    };
    db.customerUsers.push(user);
  } else {
    user.username = app.assignedUsername;
    user.password = app.assignedPassword;
    user.status = 'approved';
  }

  await persistDatabaseAsync(db);
  return user;
}

export async function updateCustomerStatus(
  customerId: string,
  status: CustomerAccountStatus
): Promise<CustomerUser | null> {
  const db = await loadDatabaseAsync(true);
  const user = db.customerUsers.find((u) => u.id === customerId);
  if (user) {
    user.status = status;
  }
  const app = db.customerApplications.find((a) => a.id === customerId);
  if (app) {
    app.status = status;
  }
  await persistDatabaseAsync(db);
  return user || null;
}

export async function resetCustomerPassword(customerId: string, newPassword: string): Promise<CustomerUser | null> {
  const db = await loadDatabaseAsync(true);
  const user = db.customerUsers.find((u) => u.id === customerId);
  if (user) {
    user.password = newPassword.trim();
  }
  const app = db.customerApplications.find((a) => a.id === customerId);
  if (app) {
    app.assignedPassword = newPassword.trim();
  }
  await persistDatabaseAsync(db);
  return user || null;
}

export async function createDirectCustomer(data: Omit<CustomerUser, 'id' | 'createdAt'>): Promise<CustomerUser> {
  const db = await loadDatabaseAsync(true);
  const id = `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const newUser: CustomerUser = {
    ...data,
    id,
    createdAt: now,
    status: data.status || 'approved',
  };

  const newApp: CustomerApplication = {
    id,
    fullName: data.fullName,
    companyName: data.companyName,
    phone: data.phone,
    secondaryPhone: data.secondaryPhone,
    email: data.email,
    wilayaCode: data.wilayaCode,
    wilayaName: data.wilayaName,
    commune: data.commune,
    deliveryAddress: data.deliveryAddress,
    submittedAt: now,
    status: data.status || 'approved',
    assignedUsername: data.username,
    assignedPassword: data.password || 'tulip2026',
    approvedAt: now,
    approvedBy: 'admin_direct_creation',
  };

  db.customerUsers.unshift(newUser);
  db.customerApplications.unshift(newApp);
  await persistDatabaseAsync(db);
  return newUser;
}

export async function deleteCustomer(customerId: string): Promise<boolean> {
  const db = await loadDatabaseAsync(true);
  db.customerUsers = db.customerUsers.filter((u) => u.id !== customerId);
  db.customerApplications = db.customerApplications.filter((a) => a.id !== customerId);
  await persistDatabaseAsync(db);
  return true;
}

export async function updateCustomerDetails(customerId: string, updatedFields: Partial<CustomerUser>): Promise<CustomerUser | null> {
  const db = await loadDatabaseAsync(true);
  const userIndex = db.customerUsers.findIndex((u) => u.id === customerId);
  if (userIndex === -1) return null;

  const originalUser = db.customerUsers[userIndex];
  const updatedUser = {
    ...originalUser,
    ...updatedFields,
  };
  db.customerUsers[userIndex] = updatedUser;

  const appIndex = db.customerApplications.findIndex((a) => a.id === customerId);
  if (appIndex !== -1) {
    const originalApp = db.customerApplications[appIndex];
    db.customerApplications[appIndex] = {
      ...originalApp,
      fullName: updatedFields.fullName ?? originalApp.fullName,
      companyName: updatedFields.companyName ?? originalApp.companyName,
      phone: updatedFields.phone ?? originalApp.phone,
      secondaryPhone: updatedFields.secondaryPhone ?? originalApp.secondaryPhone,
      email: updatedFields.email ?? originalApp.email,
      wilayaCode: updatedFields.wilayaCode ?? originalApp.wilayaCode,
      wilayaName: updatedFields.wilayaName ?? originalApp.wilayaName,
      commune: updatedFields.commune ?? originalApp.commune,
      deliveryAddress: updatedFields.deliveryAddress ?? originalApp.deliveryAddress,
      assignedUsername: updatedFields.username ?? originalApp.assignedUsername,
      assignedPassword: updatedFields.password ?? originalApp.assignedPassword,
    };
  }

  await persistDatabaseAsync(db);
  return updatedUser;
}

export async function deleteCustomerApplication(applicationId: string): Promise<boolean> {
  const db = await loadDatabaseAsync(true);
  db.customerApplications = db.customerApplications.filter((a) => a.id !== applicationId);
  await persistDatabaseAsync(db);
  return true;
}

export async function importCustomers(
  newCustomers: CustomerUser[],
  replaceExisting: boolean = false
): Promise<{ users: CustomerUser[]; applications: CustomerApplication[] }> {
  const db = await loadDatabaseAsync(true);
  const now = new Date().toISOString();

  if (replaceExisting) {
    db.customerUsers = newCustomers.map((c) => ({
      ...c,
      status: c.status || 'approved',
      createdAt: c.createdAt || now,
    }));

    db.customerApplications = newCustomers.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      companyName: c.companyName,
      email: c.email,
      phone: c.phone,
      secondaryPhone: c.secondaryPhone,
      wilayaCode: c.wilayaCode,
      wilayaName: c.wilayaName,
      commune: c.commune,
      deliveryAddress: c.deliveryAddress,
      status: c.status || 'approved',
      submittedAt: c.createdAt || now,
      approvedAt: c.createdAt || now,
      approvedBy: 'import_system',
      assignedUsername: c.username,
      assignedPassword: c.password,
      verificationNotes: 'Importé dans le système.',
    }));
  } else {
    newCustomers.forEach((nc) => {
      const idx = db.customerUsers.findIndex(
        (existing) =>
          existing.id === nc.id ||
          (nc.username && existing.username.toLowerCase() === nc.username.toLowerCase()) ||
          (nc.phone && normalizePhone(existing.phone) === normalizePhone(nc.phone)) ||
          (nc.email && existing.email.toLowerCase() === nc.email.toLowerCase())
      );
      if (idx >= 0) {
        db.customerUsers[idx] = { ...db.customerUsers[idx], ...nc };
      } else {
        db.customerUsers.push({
          ...nc,
          status: nc.status || 'approved',
          createdAt: nc.createdAt || now,
        });
      }

      const appIdx = db.customerApplications.findIndex(
        (a) =>
          a.id === nc.id ||
          (nc.username && a.assignedUsername && a.assignedUsername.toLowerCase() === nc.username.toLowerCase()) ||
          (nc.phone && normalizePhone(a.phone) === normalizePhone(nc.phone))
      );
      if (appIdx >= 0) {
        db.customerApplications[appIdx] = {
          ...db.customerApplications[appIdx],
          fullName: nc.fullName,
          companyName: nc.companyName,
          phone: nc.phone,
          secondaryPhone: nc.secondaryPhone,
          email: nc.email,
          wilayaCode: nc.wilayaCode,
          wilayaName: nc.wilayaName,
          commune: nc.commune,
          deliveryAddress: nc.deliveryAddress,
          status: nc.status || 'approved',
          assignedUsername: nc.username,
          assignedPassword: nc.password,
        };
      } else {
        db.customerApplications.push({
          id: nc.id,
          fullName: nc.fullName,
          companyName: nc.companyName,
          email: nc.email,
          phone: nc.phone,
          secondaryPhone: nc.secondaryPhone,
          wilayaCode: nc.wilayaCode,
          wilayaName: nc.wilayaName,
          commune: nc.commune,
          deliveryAddress: nc.deliveryAddress,
          status: nc.status || 'approved',
          submittedAt: nc.createdAt || now,
          approvedAt: nc.createdAt || now,
          approvedBy: 'import_system',
          assignedUsername: nc.username,
          assignedPassword: nc.password,
          verificationNotes: 'Importé dans le système.',
        });
      }
    });
  }

  await persistDatabaseAsync(db);
  return { users: db.customerUsers, applications: db.customerApplications };
}

// ---------------- MASTER RESTORATION ----------------

export async function restoreDatabase(backup: Partial<ServerDatabase>): Promise<ServerDatabase> {
  const db = await loadDatabaseAsync(true);
  const now = new Date().toISOString();

  if (Array.isArray(backup.products) && backup.products.length > 0) {
    db.products = backup.products;
  }
  if (Array.isArray(backup.orders)) {
    db.orders = backup.orders;
  }
  if (Array.isArray(backup.customerUsers)) {
    db.customerUsers = backup.customerUsers;
  }
  if (Array.isArray(backup.customerApplications)) {
    db.customerApplications = backup.customerApplications;
  } else if (Array.isArray(backup.customerUsers) && backup.customerUsers.length > 0) {
    db.customerApplications = backup.customerUsers.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      companyName: c.companyName,
      email: c.email,
      phone: c.phone,
      secondaryPhone: c.secondaryPhone,
      wilayaCode: c.wilayaCode,
      wilayaName: c.wilayaName,
      commune: c.commune,
      deliveryAddress: c.deliveryAddress,
      status: c.status || 'approved',
      submittedAt: c.createdAt || now,
      approvedAt: c.createdAt || now,
      approvedBy: 'restore_system',
      assignedUsername: c.username,
      assignedPassword: c.password,
      verificationNotes: 'Restauré depuis sauvegarde.',
    }));
  }
  if (Array.isArray(backup.adBanners)) {
    db.adBanners = backup.adBanners;
  }
  if (backup.storeSettings && typeof backup.storeSettings === 'object') {
    db.storeSettings = { ...db.storeSettings, ...backup.storeSettings };
  }

  db.lastUpdated = now;
  await persistDatabaseAsync(db);
  return db;
}

// ---------------- PRODUCTS & INVENTORY ----------------

export async function getProductsAsync(): Promise<Product[]> {
  const db = await loadDatabaseAsync();
  return db.products;
}

export function getProducts(): Product[] {
  const db = loadDatabase();
  return db.products;
}

export async function syncProducts(newProducts: Product[]): Promise<Product[]> {
  const db = await loadDatabaseAsync(true);
  db.products = newProducts;
  await persistDatabaseAsync(db);
  return db.products;
}

export async function updateSingleProduct(
  id: string,
  stock: number,
  priceDA?: number,
  isHidden?: boolean
): Promise<Product | null> {
  const db = await loadDatabaseAsync(true);
  const prod = db.products.find((p) => p.id === id);
  if (!prod) return null;

  prod.stock = stock;
  if (priceDA !== undefined) prod.priceDA = priceDA;
  if (isHidden !== undefined) prod.isHidden = isHidden;
  prod.lastUpdated = new Date().toISOString();

  await persistDatabaseAsync(db);
  return prod;
}

export async function createSingleProduct(product: Product): Promise<Product> {
  const db = await loadDatabaseAsync(true);
  const existingIdx = db.products.findIndex(
    (p) => p.id === product.id || p.code.toUpperCase() === product.code.toUpperCase()
  );
  const now = new Date().toISOString();
  const newProd: Product = { ...product, lastUpdated: now };
  if (existingIdx >= 0) {
    db.products[existingIdx] = newProd;
  } else {
    db.products.unshift(newProd);
  }
  await persistDatabaseAsync(db);
  return newProd;
}

export async function saveSingleProduct(product: Product): Promise<Product> {
  const db = await loadDatabaseAsync(true);
  const existingIdx = db.products.findIndex((p) => p.id === product.id);
  const now = new Date().toISOString();
  const updated: Product = { ...product, lastUpdated: now };
  if (existingIdx >= 0) {
    db.products[existingIdx] = updated;
  } else {
    db.products.unshift(updated);
  }
  await persistDatabaseAsync(db);
  return updated;
}

export async function deleteSingleProduct(id: string): Promise<{ success: boolean; products: Product[] }> {
  const db = await loadDatabaseAsync(true);
  db.products = db.products.filter((p) => p.id !== id);
  await persistDatabaseAsync(db);
  return { success: true, products: db.products };
}

// ---------------- BANNERS & SETTINGS ----------------

export async function getBannersAsync(): Promise<AdBanner[]> {
  const db = await loadDatabaseAsync();
  return db.adBanners;
}

export function getBanners(): AdBanner[] {
  const db = loadDatabase();
  return db.adBanners;
}

export async function updateBanners(banners: AdBanner[]): Promise<AdBanner[]> {
  const db = await loadDatabaseAsync(true);
  db.adBanners = banners;
  await persistDatabaseAsync(db);
  return db.adBanners;
}

export async function getSettingsAsync(): Promise<StoreSettings> {
  const db = await loadDatabaseAsync();
  return db.storeSettings;
}

export function getSettings(): StoreSettings {
  const db = loadDatabase();
  return db.storeSettings;
}

export async function updateSettings(settings: StoreSettings): Promise<StoreSettings> {
  const db = await loadDatabaseAsync(true);
  db.storeSettings = settings;
  await persistDatabaseAsync(db);
  return db.storeSettings;
}

// ---------------- ADMIN / MANAGER USERS ----------------

export async function getAdminUsersAsync(): Promise<AdminUser[]> {
  const db = await loadDatabaseAsync();
  const defaultAdmins: AdminUser[] = [
    {
      id: 'user-admin-root',
      username: 'admin',
      fullName: 'Administrateur Principal',
      role: 'admin',
      password: 'tulip',
      createdAt: new Date().toISOString(),
    }
  ];
  return db.adminUsers && db.adminUsers.length > 0 ? db.adminUsers : defaultAdmins;
}

export function getAdminUsers(): AdminUser[] {
  const db = loadDatabase();
  const defaultAdmins: AdminUser[] = [
    {
      id: 'user-admin-root',
      username: 'admin',
      fullName: 'Administrateur Principal',
      role: 'admin',
      password: 'tulip',
      createdAt: new Date().toISOString(),
    }
  ];
  return db.adminUsers && db.adminUsers.length > 0 ? db.adminUsers : defaultAdmins;
}

export async function saveAdminUsers(users: AdminUser[]): Promise<AdminUser[]> {
  const db = await loadDatabaseAsync(true);
  db.adminUsers = users;
  await persistDatabaseAsync(db);
  return db.adminUsers;
}
