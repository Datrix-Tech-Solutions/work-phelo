import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, inventoryKeys, toDecimal, toNumber } from '@/hooks/inventory/inventoryApi';

export interface ItemVariant {
  id: string;
  itemId: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

/** Every item's variants, and the actions to add or remove one. */
export function useItemVariants() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: inventoryKeys.variants,
    queryFn: () => inventoryApi.get<ItemVariant[]>('/variants'),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: inventoryKeys.variants });
  const create = useMutation({
    mutationFn: ({ itemId, name }: { itemId: string; name: string }) =>
      inventoryApi.post<ItemVariant>('/variants', { itemId, name }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => inventoryApi.delete(`/variants/${id}`),
    onSuccess: refresh,
  });
  return {
    variants: data ?? [],
    isLoading,
    createVariant: (itemId: string, name: string) => create.mutateAsync({ itemId, name }),
    deleteVariant: remove.mutateAsync,
  };
}

/** The names of each item's active variants, by item id. */
export function useItemVariantsMap(): Record<string, string[]> {
  const { variants } = useItemVariants();
  return useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const v of variants) {
      if (v.status !== 'ACTIVE') continue;
      (map[v.itemId] ??= []).push(v.name);
    }
    return map;
  }, [variants]);
}

export interface VariantBalance {
  itemId: string;
  locationId: string;
  variant: string;
  quantity: number;
}

interface ApiVariantBalance {
  itemId: string;
  locationId: string;
  variant: string;
  quantity: string;
}

/** Stock held under each variant, per item and warehouse, from the service. */
export function useVariantBalances() {
  const { data, isLoading } = useQuery({
    queryKey: inventoryKeys.variantBalances,
    queryFn: () => inventoryApi.get<ApiVariantBalance[]>('/variant-balances'),
  });
  const balances = useMemo<VariantBalance[]>(
    () =>
      (data ?? []).map((b) => ({
        itemId: b.itemId,
        locationId: b.locationId,
        variant: b.variant,
        quantity: toNumber(b.quantity) ?? 0,
      })),
    [data],
  );
  return { balances, isLoading };
}

/** Counts stock an item held without a variant as one of its variants (the total is unchanged). */
export function useAssignVariant() {
  const queryClient = useQueryClient();
  const assign = useMutation({
    mutationFn: (body: { itemId: string; locationId: string; variant: string; quantity: number }) =>
      inventoryApi.post('/variant-balances/assign', {
        ...body,
        quantity: toDecimal(body.quantity),
      }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: inventoryKeys.variantBalances }),
        queryClient.invalidateQueries({ queryKey: inventoryKeys.movements }),
      ]),
  });
  return { assignVariant: assign.mutateAsync, isPending: assign.isPending };
}
