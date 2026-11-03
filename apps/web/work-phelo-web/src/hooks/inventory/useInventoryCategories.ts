import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, inventoryKeys } from '@/hooks/inventory/inventoryApi';
import {
  CATEGORY_ICONS,
  DEFAULT_CATEGORY_ICON,
  type CategoryIconKey,
} from '@/lib/inventoryCategoryIcons';

export interface InventoryCategory {
  id: string;
  name: string;
  description: string | null;
  icon: CategoryIconKey;
  itemCount: number;
  createdAt: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export type NewInventoryCategory = Pick<
  InventoryCategory,
  'name' | 'description' | 'icon' | 'status'
>;

interface ApiCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  itemCount?: number;
  createdAt: string;
}

const isIconKey = (icon: string | null): icon is CategoryIconKey =>
  !!icon && icon in CATEGORY_ICONS;

export function useInventoryCategories() {
  const { data, isLoading } = useQuery({
    queryKey: inventoryKeys.categories,
    queryFn: () => inventoryApi.get<ApiCategory[]>('/categories'),
  });

  const categories = useMemo<InventoryCategory[]>(
    () =>
      (data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        icon: isIconKey(c.icon) ? c.icon : DEFAULT_CATEGORY_ICON,
        status: c.status,
        itemCount: c.itemCount ?? 0,
        createdAt: c.createdAt,
      })),
    [data],
  );
  return { categories, isLoading };
}

export function useCreateInventoryCategory() {
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: (v: NewInventoryCategory) => inventoryApi.post<ApiCategory>('/categories', v),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.categories }),
  });
  return { createCategory: m.mutateAsync, isPending: m.isPending };
}

export function useUpdateInventoryCategory() {
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: NewInventoryCategory }) =>
      inventoryApi.patch<ApiCategory>(`/categories/${id}`, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.categories }),
  });
  return {
    updateCategory: (id: string, patch: NewInventoryCategory) => m.mutateAsync({ id, patch }),
    isPending: m.isPending,
  };
}

export function useDeleteInventoryCategory() {
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: (id: string) => inventoryApi.delete(`/categories/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.categories }),
  });
  return { deleteCategory: m.mutateAsync, isPending: m.isPending };
}
