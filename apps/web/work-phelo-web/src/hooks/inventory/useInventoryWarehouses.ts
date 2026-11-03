import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, inventoryKeys } from '@/hooks/inventory/inventoryApi';

/** Location types the inventory service accepts. */
export type InventoryLocationType = 'WAREHOUSE' | 'STORE' | 'BRANCH' | 'OFFICE_STORE' | 'OTHER';

export const LOCATION_TYPE_LABEL: Record<InventoryLocationType, string> = {
  WAREHOUSE: 'Warehouse',
  STORE: 'Store',
  BRANCH: 'Branch Store',
  OFFICE_STORE: 'Office Store',
  OTHER: 'Other',
};

export interface InventoryWarehouse {
  id: string;
  name: string;
  code: string;
  type: InventoryLocationType;
  address: string | null;
  /** Items with a stock balance row here, including zero-quantity rows. */
  itemCount: number;
  status: 'ACTIVE' | 'INACTIVE';
}

/** What the service accepts when saving a location. */
export type NewInventoryWarehouse = Pick<InventoryWarehouse, 'name' | 'code' | 'type' | 'status'>;

interface ApiLocation extends Omit<InventoryWarehouse, 'itemCount'> {
  itemCount?: number;
}

export function useInventoryWarehouses() {
  const { data, isLoading } = useQuery({
    queryKey: inventoryKeys.locations,
    queryFn: () => inventoryApi.get<ApiLocation[]>('/locations'),
  });
  const warehouses = useMemo<InventoryWarehouse[]>(
    () => (data ?? []).map((w) => ({ ...w, itemCount: w.itemCount ?? 0 })),
    [data],
  );
  return { warehouses, isLoading };
}

export function useCreateInventoryWarehouse() {
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: (v: NewInventoryWarehouse) => inventoryApi.post<ApiLocation>('/locations', v),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.locations }),
  });
  return { createWarehouse: m.mutateAsync, isPending: m.isPending };
}

export function useUpdateInventoryWarehouse() {
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: NewInventoryWarehouse }) =>
      inventoryApi.patch<ApiLocation>(`/locations/${id}`, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.locations }),
  });
  return {
    updateWarehouse: (id: string, patch: NewInventoryWarehouse) => m.mutateAsync({ id, patch }),
    isPending: m.isPending,
  };
}

export function useDeleteInventoryWarehouse() {
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: (id: string) => inventoryApi.delete(`/locations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.locations }),
  });
  return { deleteWarehouse: m.mutateAsync, isPending: m.isPending };
}
