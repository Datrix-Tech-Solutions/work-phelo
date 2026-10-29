import { create } from 'zustand';

export interface InventoryUnit {
  id: string;
  name: string;
  description: string | null;
  symbol: string;
  createdAt: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export type NewInventoryUnit = Pick<InventoryUnit, 'name' | 'description' | 'symbol' | 'status'>;

interface UnitStore {
  units: InventoryUnit[];
  add: (unit: NewInventoryUnit) => void;
  update: (id: string, patch: NewInventoryUnit) => void;
  remove: (id: string) => void;
}

// Stand-in until the inventory service exists: units live in memory for the session only.
// Swap the store for API calls in the two hooks below; the pages don't need to change.
const useUnitStore = create<UnitStore>((set) => ({
  units: [],
  add: (unit) =>
    set((s) => ({
      units: [
        { ...unit, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
        ...s.units,
      ],
    })),
  update: (id, patch) =>
    set((s) => ({ units: s.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),
  remove: (id) => set((s) => ({ units: s.units.filter((u) => u.id !== id) })),
}));

export function useInventoryUnits() {
  const units = useUnitStore((s) => s.units);
  return { units, isLoading: false };
}

export function useCreateInventoryUnit() {
  const add = useUnitStore((s) => s.add);
  return { createUnit: add, isPending: false };
}

export function useUpdateInventoryUnit() {
  const update = useUnitStore((s) => s.update);
  return { updateUnit: update, isPending: false };
}

export function useDeleteInventoryUnit() {
  const remove = useUnitStore((s) => s.remove);
  return { deleteUnit: remove, isPending: false };
}
