import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CancelledStore {
  ids: string[];
  markCancelled: (id: string) => void;
}

/**
 * The inventory service has no cancelled status for a movement. Cancelling puts the stock back
 * through the service (see useReturnMovementStock) and records the status in this browser only:
 * other users still see the movement as completed. Replace with a service call when one exists.
 */
export const useCancelledMovementStore = create<CancelledStore>()(
  persist(
    (set) => ({
      ids: [],
      markCancelled: (id) => set((s) => (s.ids.includes(id) ? s : { ids: [...s.ids, id] })),
    }),
    { name: 'inventory-cancelled-movements' },
  ),
);
