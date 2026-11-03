import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ReversedStore {
  ids: string[];
  markReversed: (id: string) => void;
}

/**
 * The inventory service has no way to reverse a movement. A reversal is therefore only recorded in
 * this browser: the movement shows as Reversed here, but the stock it changed is NOT put back and
 * other users do not see it. Replace with a service call when one exists.
 */
export const useReversedMovementStore = create<ReversedStore>()(
  persist(
    (set) => ({
      ids: [],
      markReversed: (id) => set((s) => (s.ids.includes(id) ? s : { ids: [...s.ids, id] })),
    }),
    { name: 'inventory-reversed-movements' },
  ),
);
