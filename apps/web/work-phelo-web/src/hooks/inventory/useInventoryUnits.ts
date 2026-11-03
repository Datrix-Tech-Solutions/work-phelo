import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, inventoryKeys } from '@/hooks/inventory/inventoryApi';

export interface InventoryUnit {
  id: string;
  name: string;
  description: string | null;
  symbol: string;
  createdAt: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export type NewInventoryUnit = Pick<InventoryUnit, 'name' | 'description' | 'symbol' | 'status'>;

export function useInventoryUnits() {
  const { data, isLoading } = useQuery({
    queryKey: inventoryKeys.units,
    queryFn: () => inventoryApi.get<InventoryUnit[]>('/units'),
  });
  const units = useMemo(() => data ?? [], [data]);
  return { units, isLoading };
}

export function useCreateInventoryUnit() {
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: (v: NewInventoryUnit) => inventoryApi.post<InventoryUnit>('/units', v),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.units }),
  });
  return { createUnit: m.mutateAsync, isPending: m.isPending };
}

export function useUpdateInventoryUnit() {
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: NewInventoryUnit }) =>
      inventoryApi.patch<InventoryUnit>(`/units/${id}`, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.units }),
  });
  return {
    updateUnit: (id: string, patch: NewInventoryUnit) => m.mutateAsync({ id, patch }),
    isPending: m.isPending,
  };
}

export function useDeleteInventoryUnit() {
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: (id: string) => inventoryApi.delete(`/units/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.units }),
  });
  return { deleteUnit: m.mutateAsync, isPending: m.isPending };
}
