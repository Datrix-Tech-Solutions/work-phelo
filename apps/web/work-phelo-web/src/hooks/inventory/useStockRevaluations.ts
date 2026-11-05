import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StockMovement } from '@/hooks/inventory/useStockMovements';

export interface StockRevaluationLine {
  itemId: string;
  variant: string | null;
  /** Quantity on hand in the warehouse when the price was adjusted. */
  quantity: number;
  /** The new unit cost the stock was revalued at. */
  unitCost: number;
}

export interface StockRevaluation {
  id: string;
  reference: string;
  date: string;
  warehouseId: string;
  notes: string | null;
  lines: StockRevaluationLine[];
}

interface RevaluationStore {
  entries: StockRevaluation[];
  add: (entry: Omit<StockRevaluation, 'id' | 'reference'> & { reference?: string }) => void;
}

/**
 * The inventory service has no price adjustment, so a revaluation is kept in this browser only:
 * not shared across devices or users. It changes no stock and no item price; it is a record of
 * the unit cost the stock on hand was revalued at.
 */
export const useRevaluationStore = create<RevaluationStore>()(
  persist(
    (set) => ({
      entries: [],
      add: ({ reference, ...entry }) =>
        set((s) => {
          const id = crypto.randomUUID();
          return {
            entries: [
              { ...entry, id, reference: reference || `REV-${id.slice(0, 8).toUpperCase()}` },
              ...s.entries,
            ],
          };
        }),
    }),
    { name: 'inventory-revaluations' },
  ),
);

/** A revaluation shaped like a movement, so it can be listed beside real ones. */
export function revaluationToMovement(r: StockRevaluation): StockMovement {
  return {
    id: r.id,
    reference: r.reference,
    date: r.date,
    type: 'ADJUSTMENT',
    kind: 'REVALUATION',
    lines: r.lines.map((l) => ({
      itemId: l.itemId,
      variant: l.variant,
      quantity: l.quantity,
      unitCost: l.unitCost,
    })),
    fromWarehouseId: null,
    toWarehouseId: r.warehouseId,
    source: null,
    notes: r.notes,
    reason: 'Price Adjustment',
    purpose: null,
    status: 'COMPLETED',
  };
}
