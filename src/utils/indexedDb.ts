/**
 * Tulip Fragrance Company - IndexedDB Offline Storage Utility
 * Provides massive, robust persistent storage for PWA offline experience.
 * Bypasses the 5MB browser localStorage quota so hundreds of products,
 * high-resolution images, categories, and offline orders are never lost.
 */

import { Product, PreOrder } from '../types';
import { SyncDataResponse } from './api';

const DB_NAME = 'tulip_fragrance_offline_db';
const DB_VERSION = 1;

export const STORES = {
  PRODUCTS: 'products',
  SYNC_SNAPSHOT: 'sync_snapshot',
  OFFLINE_ORDERS: 'offline_orders',
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getOfflineDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment.'));
  }

  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
            db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORES.SYNC_SNAPSHOT)) {
            db.createObjectStore(STORES.SYNC_SNAPSHOT, { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains(STORES.OFFLINE_ORDERS)) {
            db.createObjectStore(STORES.OFFLINE_ORDERS, { keyPath: 'id' });
          }
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(request.error || new Error('Failed to open IndexedDB'));
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  return dbPromise;
}

/**
 * Save products list into IndexedDB
 */
export async function idbSaveProducts(products: Product[]): Promise<void> {
  try {
    const db = await getOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PRODUCTS, 'readwrite');
      const store = tx.objectStore(STORES.PRODUCTS);

      // Clear existing records and replace with updated catalog
      store.clear();
      for (const product of products) {
        store.put(product);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IDB] Failed to save products to IndexedDB:', err);
  }
}

/**
 * Retrieve all products from IndexedDB
 */
export async function idbGetProducts(): Promise<Product[] | null> {
  try {
    const db = await getOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PRODUCTS, 'readonly');
      const store = tx.objectStore(STORES.PRODUCTS);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result;
        resolve(Array.isArray(result) && result.length > 0 ? result : null);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IDB] Failed to retrieve products from IndexedDB:', err);
    return null;
  }
}

/**
 * Save full API sync snapshot into IndexedDB
 */
export async function idbSaveSyncSnapshot(snapshot: SyncDataResponse): Promise<void> {
  try {
    const db = await getOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_SNAPSHOT, 'readwrite');
      const store = tx.objectStore(STORES.SYNC_SNAPSHOT);
      store.put({
        key: 'latest_snapshot',
        data: snapshot,
        timestamp: Date.now(),
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IDB] Failed to save sync snapshot to IndexedDB:', err);
  }
}

/**
 * Get latest full API sync snapshot from IndexedDB
 */
export async function idbGetSyncSnapshot(): Promise<SyncDataResponse | null> {
  try {
    const db = await getOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_SNAPSHOT, 'readonly');
      const store = tx.objectStore(STORES.SYNC_SNAPSHOT);
      const request = store.get('latest_snapshot');

      request.onsuccess = () => {
        if (request.result && request.result.data) {
          resolve(request.result.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IDB] Failed to get sync snapshot from IndexedDB:', err);
    return null;
  }
}

/**
 * Save offline orders in IndexedDB
 */
export async function idbSaveOfflineOrders(orders: PreOrder[]): Promise<void> {
  try {
    const db = await getOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.OFFLINE_ORDERS, 'readwrite');
      const store = tx.objectStore(STORES.OFFLINE_ORDERS);
      store.clear();
      for (const order of orders) {
        store.put(order);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IDB] Failed to save offline orders to IndexedDB:', err);
  }
}

/**
 * Retrieve offline orders from IndexedDB
 */
export async function idbGetOfflineOrders(): Promise<PreOrder[]> {
  try {
    const db = await getOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.OFFLINE_ORDERS, 'readonly');
      const store = tx.objectStore(STORES.OFFLINE_ORDERS);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(Array.isArray(request.result) ? request.result : []);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IDB] Failed to get offline orders from IndexedDB:', err);
    return [];
  }
}
