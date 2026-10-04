/**
 * Tulip Fragrance Company - IndexedDB Offline Storage Utility (DISABLED)
 * Cache saving is disabled. This mock storage always returns empty results.
 */

import { Product, PreOrder } from '../types';

export const STORES = {
  PRODUCTS: 'products',
  SYNC_SNAPSHOT: 'sync_snapshot',
  OFFLINE_ORDERS: 'offline_orders',
} as const;

export async function idbSaveProducts(products: Product[]): Promise<void> {
  // No-op
}

export async function idbGetProducts(): Promise<Product[] | null> {
  return null;
}

export async function idbSaveSyncSnapshot(snapshot: any): Promise<void> {
  // No-op
}

export async function idbGetSyncSnapshot(): Promise<any | null> {
  return null;
}

export async function idbSaveOfflineOrders(orders: PreOrder[]): Promise<void> {
  // No-op
}

export async function idbGetOfflineOrders(): Promise<PreOrder[]> {
  return [];
}
