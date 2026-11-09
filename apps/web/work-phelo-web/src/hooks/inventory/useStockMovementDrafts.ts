import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StockMovement, StockMovementType } from '@/hooks/inventory/useStockMovements';

/** The movement form as typed, so a draft reopens exactly as it was left. */
export interface DraftFormValues {
  reference: string;
  date: string;
  party: string;
  warehouseId: string;
  toWarehouseId: string;
  purpose: string;
  reason: string;
  adjustmentType: 'INCREASE' | 'DECREASE' | 'PRICE';
  notes: string;
}

export interface DraftLine {
  itemId: string;
  quantity: number;
  unitCost: number;
  variant?: string;
  batchNumber?: string;
  manufactureDate?: string;
  expiryDate?: string;
}

export interface StockMovementDraft {
  id: string;
  type: StockMovementType;
  savedAt: string;
  form: DraftFormValues;
  lines: DraftLine[];
}

interface DraftStore {
  drafts: StockMovementDraft[];
  /** Updates the draft with the given id, or adds a new one. */
  saveDraft: (draft: Omit<StockMovementDraft, 'id' | 'savedAt'> & { id?: string }) => void;
  deleteDraft: (id: string) => void;
}

/**
 * The inventory service has no draft stage: a movement posts and updates stock immediately. Drafts
 * are therefore kept in this browser only and are not shared across devices or users. Nothing
 * reaches the service until the draft is submitted as a normal movement.
 */
export const useStockMovementDraftStore = create<DraftStore>()(
  persist(
    (set) => ({
      drafts: [],
      saveDraft: ({ id, ...draft }) =>
        set((s) => {
          const saved = {
            ...draft,
            id: id ?? crypto.randomUUID(),
            savedAt: new Date().toISOString(),
          };
          return {
            drafts: id ? s.drafts.map((d) => (d.id === id ? saved : d)) : [saved, ...s.drafts],
          };
        }),
      deleteDraft: (id) => set((s) => ({ drafts: s.drafts.filter((d) => d.id !== id) })),
    }),
    { name: 'inventory-movement-drafts' },
  ),
);

/** A draft shaped like a movement, so it can be listed beside real ones. */
export function draftToMovement(d: StockMovementDraft): StockMovement {
  const { form, type } = d;
  const decrease = type === 'ADJUSTMENT' && form.adjustmentType === 'DECREASE';
  const warehouse = form.warehouseId || null;
  return {
    id: d.id,
    reference: form.reference.trim() || `DRAFT-${d.id.slice(0, 6).toUpperCase()}`,
    date: form.date,
    type,
    lines: d.lines.map((l) => ({
      itemId: l.itemId,
      quantity: decrease ? -l.quantity : l.quantity,
      unitCost: l.unitCost,
      variant: l.variant || null,
    })),
    fromWarehouseId: type === 'STOCK_OUT' || type === 'TRANSFER' || decrease ? warehouse : null,
    toWarehouseId:
      type === 'TRANSFER'
        ? form.toWarehouseId || null
        : type === 'STOCK_IN' || (type === 'ADJUSTMENT' && !decrease)
          ? warehouse
          : null,
    source: type === 'STOCK_IN' || type === 'STOCK_OUT' ? form.party.trim() || null : null,
    notes: form.notes.trim() || null,
    reason: type === 'ADJUSTMENT' ? form.reason || null : null,
    purpose: type === 'STOCK_OUT' ? form.purpose || null : null,
    status: 'DRAFT',
  };
}

export function useStockMovementDrafts() {
  const drafts = useStockMovementDraftStore((s) => s.drafts);
  const saveDraft = useStockMovementDraftStore((s) => s.saveDraft);
  const deleteDraft = useStockMovementDraftStore((s) => s.deleteDraft);
  const draftMovements = useMemo(() => drafts.map(draftToMovement), [drafts]);
  return { drafts, draftMovements, saveDraft, deleteDraft };
}
