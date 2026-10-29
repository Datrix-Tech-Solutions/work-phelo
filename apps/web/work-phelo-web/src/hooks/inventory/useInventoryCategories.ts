import { create } from 'zustand';
import type { CategoryIconKey } from '@/lib/inventoryCategoryIcons';

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

interface CategoryStore {
  categories: InventoryCategory[];
  add: (category: NewInventoryCategory) => void;
  update: (id: string, patch: NewInventoryCategory) => void;
  remove: (id: string) => void;
}

// Stand-in until the inventory service exists: categories live in memory for the session only.
// Swap the store for API calls in the two hooks below; the pages don't need to change.
const useCategoryStore = create<CategoryStore>((set) => ({
  categories: [],
  add: (category) =>
    set((s) => ({
      categories: [
        {
          ...category,
          id: crypto.randomUUID(),
          itemCount: 0,
          createdAt: new Date().toISOString(),
        },
        ...s.categories,
      ],
    })),
  update: (id, patch) =>
    set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
  remove: (id) => set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),
}));

export function useInventoryCategories() {
  const categories = useCategoryStore((s) => s.categories);
  return { categories, isLoading: false };
}

export function useCreateInventoryCategory() {
  const add = useCategoryStore((s) => s.add);
  return { createCategory: add, isPending: false };
}

export function useUpdateInventoryCategory() {
  const update = useCategoryStore((s) => s.update);
  return { updateCategory: update, isPending: false };
}

export function useDeleteInventoryCategory() {
  const remove = useCategoryStore((s) => s.remove);
  return { deleteCategory: remove, isPending: false };
}
