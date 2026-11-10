import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventoryApi, inventoryKeys, toNumber } from '@/hooks/inventory/inventoryApi';

export interface StockLot {
  id: string;
  itemId: string;
  warehouseId: string;
  variant: string | null;
  /** Blank when the stock was received with an expiry date but no batch number. */
  lotNumber: string;
  /** YYYY-MM-DD. */
  manufactureDate: string | null;
  expiryDate: string | null;
  receivedQuantity: number;
  remainingQuantity: number;
  /** ISO date-time the lot was created. */
  receivedAt: string;
}

interface ApiStockLot {
  id: string;
  itemId: string;
  locationId: string;
  variant: string | null;
  lotNumber: string | null;
  manufactureDate: string | null;
  expiryDate: string | null;
  receivedQuantity: string;
  remainingQuantity: string;
  createdAt: string;
}

/** Batches / lots received, with how much of each is left. */
export function useStockLots() {
  const { data, isLoading } = useQuery({
    queryKey: inventoryKeys.lots,
    queryFn: () => inventoryApi.get<ApiStockLot[]>('/stock-lots'),
  });
  const lots = useMemo<StockLot[]>(
    () =>
      (data ?? []).map((l) => ({
        id: l.id,
        itemId: l.itemId,
        warehouseId: l.locationId,
        variant: l.variant,
        lotNumber: l.lotNumber ?? '',
        manufactureDate: l.manufactureDate?.slice(0, 10) ?? null,
        expiryDate: l.expiryDate?.slice(0, 10) ?? null,
        receivedQuantity: toNumber(l.receivedQuantity) ?? 0,
        remainingQuantity: toNumber(l.remainingQuantity) ?? 0,
        receivedAt: l.createdAt,
      })),
    [data],
  );
  return { lots, isLoading };
}
