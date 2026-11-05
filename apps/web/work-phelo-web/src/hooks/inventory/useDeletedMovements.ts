import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DeletedStore {
  ids: string[];
  markDeleted: (id: string) => void;
}

/**
 * The inventory service has no way to delete a posted movement. Deleting puts the stock back
 * through the service (see useReturnMovementStock) and hides the movement in this browser only:
 * other users still see it. The same list hides the movements that put the stock back.
 */
export const useDeletedMovementStore = create<DeletedStore>()(
  persist(
    (set) => ({
      ids: [],
      markDeleted: (id) => set((s) => (s.ids.includes(id) ? s : { ids: [...s.ids, id] })),
    }),
    { name: 'inventory-deleted-movements' },
  ),
);
