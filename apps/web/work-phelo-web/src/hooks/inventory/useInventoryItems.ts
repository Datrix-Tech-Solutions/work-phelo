import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, inventoryKeys, toDecimal, toNumber } from '@/hooks/inventory/inventoryApi';
import { useItemImageStore } from '@/hooks/inventory/useInventoryLocalMeta';
import { useStockPositions } from '@/hooks/inventory/useStockBalances';
import type { ItemImportPayloadRow } from '@/lib/inventory/itemImport';

export type InventoryStockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  subcategoryId: string | null;
  unitId: string;
  description: string | null;
  /** Purchase cost per unit. */
  costPrice: number | null;
  sellingPrice: number | null;
  reorderLevel: number | null;
  /** Most stock the business wants to hold of this item. Optional. */
  maxStock: number | null;
  /** Perishable stock needs an expiry date when it is received. */
  isPerishable: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  /** Data URL or remote URL, or null when no image is set. Stored in this browser only. */
  imageUrl: string | null;
  /** On-hand quantity across all warehouses, from the service's stock balances. */
  currentStock: number;
  /** Warehouses currently holding stock of this item. */
  warehouseIds: string[];
}

export type NewInventoryItem = Omit<InventoryItem, 'id' | 'currentStock' | 'warehouseIds'>;

interface ApiItem {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  subcategoryId: string | null;
  unitOfMeasureId: string;
  description: string | null;
  costPrice: string | null;
  sellingPrice: string | null;
  reorderLevel: string | null;
  maxStock: string | null;
  isPerishable: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}

function toPayload(item: NewInventoryItem) {
  return {
    name: item.name,
    sku: item.sku,
    categoryId: item.categoryId,
    subcategoryId: item.subcategoryId,
    unitOfMeasureId: item.unitId,
    description: item.description,
    costPrice: toDecimal(item.costPrice),
    sellingPrice: toDecimal(item.sellingPrice),
    reorderLevel: toDecimal(item.reorderLevel),
    maxStock: toDecimal(item.maxStock),
    isPerishable: item.isPerishable,
    status: item.status,
  };
}

export const STOCK_STATUS_BADGE: Record<
  InventoryStockStatus,
  { label: string; variant: 'success' | 'warning' | 'danger' }
> = {
  IN_STOCK: { label: 'In Stock', variant: 'success' },
  LOW_STOCK: { label: 'Low Stock', variant: 'warning' },
  OUT_OF_STOCK: { label: 'Out of Stock', variant: 'danger' },
};

export function getStockStatus(item: InventoryItem): InventoryStockStatus {
  if (item.currentStock <= 0) return 'OUT_OF_STOCK';
  if (item.reorderLevel !== null && item.currentStock <= item.reorderLevel) return 'LOW_STOCK';
  return 'IN_STOCK';
}

export function getItemValue(item: InventoryItem): number {
  return item.currentStock * (item.costPrice ?? 0);
}

export function useInventoryItems() {
  const { data, isLoading: itemsLoading } = useQuery({
    queryKey: inventoryKeys.items,
    queryFn: () => inventoryApi.get<ApiItem[]>('/items'),
  });
  const { positions, isLoading: stockLoading } = useStockPositions();
  const images = useItemImageStore((s) => s.images);

  const items = useMemo<InventoryItem[]>(
    () =>
      (data ?? []).map((i) => {
        const byLocation = positions.get(i.id);
        const held = byLocation ? [...byLocation].filter(([, qty]) => qty > 0) : [];
        return {
          id: i.id,
          name: i.name,
          sku: i.sku,
          categoryId: i.categoryId,
          subcategoryId: i.subcategoryId,
          unitId: i.unitOfMeasureId,
          description: i.description,
          costPrice: toNumber(i.costPrice),
          sellingPrice: toNumber(i.sellingPrice),
          reorderLevel: toNumber(i.reorderLevel),
          maxStock: toNumber(i.maxStock),
          isPerishable: i.isPerishable,
          status: i.status,
          imageUrl: images[i.id] ?? null,
          currentStock: byLocation ? [...byLocation.values()].reduce((a, b) => a + b, 0) : 0,
          warehouseIds: held.map(([locationId]) => locationId),
        };
      }),
    [data, positions, images],
  );

  return { items, isLoading: itemsLoading || stockLoading };
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  const setImage = useItemImageStore((s) => s.setImage);
  const m = useMutation({
    mutationFn: async (item: NewInventoryItem) => {
      const created = await inventoryApi.post<ApiItem>('/items', toPayload(item));
      setImage(created.id, item.imageUrl);
      return created;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.items }),
  });
  return { createItem: m.mutateAsync, isPending: m.isPending };
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();
  const setImage = useItemImageStore((s) => s.setImage);
  const m = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: NewInventoryItem }) => {
      const updated = await inventoryApi.patch<ApiItem>(`/items/${id}`, toPayload(patch));
      setImage(id, patch.imageUrl);
      return updated;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.items }),
  });
  return {
    updateItem: (id: string, patch: NewInventoryItem) => m.mutateAsync({ id, patch }),
    isPending: m.isPending,
  };
}

/**
 * The service has no item delete, so this deactivates the item instead: it stays in history and
 * stock records but can no longer receive stock.
 */
export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: (id: string) => inventoryApi.patch<ApiItem>(`/items/${id}`, { status: 'INACTIVE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.items }),
  });
  return { deleteItem: m.mutateAsync, isPending: m.isPending };
}

export interface ItemImportRowResult {
  sku: string;
  status: 'created' | 'skipped' | 'failed';
  id?: string;
  message?: string;
}

export interface ItemImportResult {
  results: ItemImportRowResult[];
  createdCategories: string[];
  createdSubcategories: string[];
  createdUnits: string[];
}

/** Creates items from spreadsheet rows; the service also creates any missing category, subcategory or unit. */
export function useBulkImportItems() {
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: (rows: ItemImportPayloadRow[]) =>
      inventoryApi.post<ItemImportResult>('/items/bulk-import', { rows }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.categories });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.subcategories });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.units });
    },
  });
  return { bulkImport: m.mutateAsync, isPending: m.isPending };
}
