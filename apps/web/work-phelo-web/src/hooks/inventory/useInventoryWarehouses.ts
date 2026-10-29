import { create } from 'zustand';

export interface InventoryWarehouse {
  id: string;
  name: string;
  code: string;
  address: string | null;
  itemCount: number;
  stockValue: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export type NewInventoryWarehouse = Pick<InventoryWarehouse, 'name' | 'code' | 'address'>;

interface WarehouseStore {
  warehouses: InventoryWarehouse[];
  add: (warehouse: NewInventoryWarehouse) => void;
  update: (id: string, patch: NewInventoryWarehouse) => void;
  remove: (id: string) => void;
}

// Stand-in until the inventory service exists: warehouses live in memory for the session only.
// Swap the store for API calls in the two hooks below; the pages don't need to change.
const useWarehouseStore = create<WarehouseStore>((set) => ({
  warehouses: [],
  add: (warehouse) =>
    set((s) => ({
      warehouses: [
        {
          ...warehouse,
          id: crypto.randomUUID(),
          itemCount: 0,
          stockValue: 0,
          status: 'ACTIVE',
        },
        ...s.warehouses,
      ],
    })),
  update: (id, patch) =>
    set((s) => ({ warehouses: s.warehouses.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
  remove: (id) => set((s) => ({ warehouses: s.warehouses.filter((w) => w.id !== id) })),
}));

export function useInventoryWarehouses() {
  const warehouses = useWarehouseStore((s) => s.warehouses);
  return { warehouses, isLoading: false };
}

export function useCreateInventoryWarehouse() {
  const add = useWarehouseStore((s) => s.add);
  return { createWarehouse: add, isPending: false };
}

export function useUpdateInventoryWarehouse() {
  const update = useWarehouseStore((s) => s.update);
  return { updateWarehouse: update, isPending: false };
}

export function useDeleteInventoryWarehouse() {
  const remove = useWarehouseStore((s) => s.remove);
  return { deleteWarehouse: remove, isPending: false };
}
