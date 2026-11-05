import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, inventoryKeys } from '@/hooks/inventory/inventoryApi';

export interface InventorySubcategory {
  id: string;
  categoryId: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  itemCount: number;
}

/** Every subcategory, and the actions to add or remove one. */
export function useSubcategories() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: inventoryKeys.subcategories,
    queryFn: () => inventoryApi.get<InventorySubcategory[]>('/subcategories'),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: inventoryKeys.subcategories });
  const create = useMutation({
    mutationFn: ({ categoryId, name }: { categoryId: string; name: string }) =>
      inventoryApi.post<InventorySubcategory>('/subcategories', { categoryId, name }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => inventoryApi.delete(`/subcategories/${id}`),
    onSuccess: refresh,
  });
  return {
    subcategories: data ?? [],
    isLoading,
    createSubcategory: (categoryId: string, name: string) =>
      create.mutateAsync({ categoryId, name }),
    deleteSubcategory: remove.mutateAsync,
  };
}

/** One category's subcategories. */
export function useCategorySubcategories(categoryId?: string | null) {
  const { subcategories: all, ...actions } = useSubcategories();
  const subcategories = useMemo(
    () => (categoryId ? all.filter((s) => s.categoryId === categoryId) : []),
    [all, categoryId],
  );
  return { subcategories, ...actions };
}
