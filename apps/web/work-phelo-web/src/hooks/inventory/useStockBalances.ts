import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventoryApi, inventoryKeys, toNumber } from '@/hooks/inventory/inventoryApi';

interface ApiStockBalance {
  itemId: string;
  locationId: string;
  quantity: string;
}

/** On-hand quantity per item, then per warehouse. */
export type StockPositions = Map<string, Map<string, number>>;

/** On-hand quantity per item and warehouse, from the service's stock balances. */
export function useStockPositions() {
  const { data, isLoading } = useQuery({
    queryKey: inventoryKeys.balances,
    queryFn: () => inventoryApi.get<ApiStockBalance[]>('/stock-balances'),
  });

  const positions = useMemo<StockPositions>(() => {
    const map: StockPositions = new Map();
    for (const b of data ?? []) {
      const byLocation = map.get(b.itemId) ?? new Map<string, number>();
      byLocation.set(
        b.locationId,
        (byLocation.get(b.locationId) ?? 0) + (toNumber(b.quantity) ?? 0),
      );
      map.set(b.itemId, byLocation);
    }
    return map;
  }, [data]);

  return { positions, isLoading };
}
