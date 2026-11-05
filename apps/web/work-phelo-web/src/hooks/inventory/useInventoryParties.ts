import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, inventoryKeys } from '@/hooks/inventory/inventoryApi';

export type PartyKind = 'CUSTOMER' | 'SUPPLIER';

export interface InventoryParty {
  id: string;
  kind: PartyKind;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export type NewInventoryParty = Omit<InventoryParty, 'id' | 'kind' | 'createdAt'>;

/** Customers or suppliers, plus the actions to change them. */
export function useInventoryParties(kind: PartyKind) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: inventoryKeys.parties,
    queryFn: () => inventoryApi.get<InventoryParty[]>('/parties'),
  });
  const parties = useMemo(() => (data ?? []).filter((p) => p.kind === kind), [data, kind]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: inventoryKeys.parties });

  const create = useMutation({
    mutationFn: (party: NewInventoryParty) =>
      inventoryApi.post<InventoryParty>('/parties', { ...party, kind }),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: NewInventoryParty }) =>
      inventoryApi.patch<InventoryParty>(`/parties/${id}`, patch),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => inventoryApi.delete(`/parties/${id}`),
    onSuccess: refresh,
  });

  return {
    parties,
    isLoading,
    createParty: create.mutateAsync,
    updateParty: (id: string, patch: NewInventoryParty) => update.mutateAsync({ id, patch }),
    deleteParty: remove.mutateAsync,
    isPending: create.isPending || update.isPending || remove.isPending,
  };
}

export const useInventoryCustomers = () => useInventoryParties('CUSTOMER');
export const useInventorySuppliers = () => useInventoryParties('SUPPLIER');
