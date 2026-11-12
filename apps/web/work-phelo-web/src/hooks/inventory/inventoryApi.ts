import { api } from '@/lib/api';

/** Gateway route for the inventory service (apps/inventory-service). */
const BASE = '/operations/inventory';

export const inventoryApi = {
  get: async <T>(path: string) => (await api.get<T>(`${BASE}${path}`)).data,
  post: async <T>(path: string, body: unknown) => (await api.post<T>(`${BASE}${path}`, body)).data,
  patch: async <T>(path: string, body: unknown) =>
    (await api.patch<T>(`${BASE}${path}`, body)).data,
  delete: async (path: string) => {
    await api.delete(`${BASE}${path}`);
  },
};

export const inventoryKeys = {
  categories: ['inventory', 'categories'] as const,
  units: ['inventory', 'units'] as const,
  locations: ['inventory', 'locations'] as const,
  items: ['inventory', 'items'] as const,
  balances: ['inventory', 'stock-balances'] as const,
  movements: ['inventory', 'stock-movements'] as const,
  movementRequests: ['inventory', 'stock-movement-requests'] as const,
  lots: ['inventory', 'stock-lots'] as const,
  purchaseOrders: ['inventory', 'purchase-orders'] as const,
  parties: ['inventory', 'parties'] as const,
  subcategories: ['inventory', 'subcategories'] as const,
  variants: ['inventory', 'variants'] as const,
  variantBalances: ['inventory', 'variant-balances'] as const,
  adjustmentReasons: ['inventory', 'adjustment-reasons'] as const,
};

/** The service returns decimals as strings; the UI works in numbers. */
export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** The service accepts up to 4 decimal places. */
export function toDecimal(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toFixed(4);
}
