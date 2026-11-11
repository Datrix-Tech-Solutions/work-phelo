import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCancelledMovementStore } from '@/hooks/inventory/useCancelledMovements';
import { useDeletedMovementStore } from '@/hooks/inventory/useDeletedMovements';
import { revaluationToMovement, useRevaluationStore } from '@/hooks/inventory/useStockRevaluations';
import { useReversedMovementStore } from '@/hooks/inventory/useReversedMovements';
import { inventoryApi, inventoryKeys, toDecimal, toNumber } from '@/hooks/inventory/inventoryApi';

export type StockMovementType = 'STOCK_IN' | 'STOCK_OUT' | 'TRANSFER' | 'ADJUSTMENT';
/** DRAFT movements exist in this browser only; the service has no draft stage. */
/** REVERSED is recorded in this browser only; see useReversedMovements. */
export type StockMovementStatus = 'DRAFT' | 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REVERSED';

export interface StockMovementLine {
  itemId: string;
  quantity: number;
  unitCost: number | null;
  /** The item variant this line is for. */
  variant?: string | null;
  /** Stock in only: the batch / lot the stock belongs to. */
  lotNumber?: string | null;
  /** Stock in only, perishable items: YYYY-MM-DD. */
  manufactureDate?: string | null;
  expiryDate?: string | null;
  /** The batch / lot this line concerns: the one a stock in created, or a stock out drew on. */
  lotId?: string | null;
  /** Transfers only: the batch / lot the stock became at the destination. */
  toLotId?: string | null;
  /** Stock in only: the purchase order line this was received against, if any. */
  purchaseOrderLineId?: string | null;
}

export interface StockMovement {
  id: string;
  reference: string;
  /** ISO date of the movement. */
  date: string;
  type: StockMovementType;
  /** A price adjustment: it revalues stock on hand and changes no quantity. Browser-only. */
  kind?: 'REVALUATION';
  lines: StockMovementLine[];
  /** Source warehouse; null when stock comes from outside (e.g. a supplier). */
  fromWarehouseId: string | null;
  /** Free-text origin shown when there is no source warehouse, e.g. a supplier name. */
  source: string | null;
  notes: string | null;
  /** Adjustments only: why stock was corrected (a service reason code, e.g. DAMAGE). */
  reason: string | null;
  /** Stock out only: why stock was issued (a service purpose code, e.g. SALE). */
  purpose: string | null;
  /** Destination warehouse; null when stock leaves the business. */
  toWarehouseId: string | null;
  status: StockMovementStatus;
}

export type NewStockMovement = Omit<StockMovement, 'id' | 'reference' | 'status'> & {
  /** Leave blank to generate one from the movement type. */
  reference?: string;
};

const REFERENCE_PREFIX: Record<StockMovementType, string> = {
  STOCK_IN: 'SIN',
  STOCK_OUT: 'SOUT',
  TRANSFER: 'TRF',
  ADJUSTMENT: 'ADJ',
};

type ApiMovementType =
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'ADJUSTMENT_INCREASE'
  | 'ADJUSTMENT_DECREASE';

interface ApiStockMovement {
  id: string;
  type: ApiMovementType;
  itemId: string;
  locationId: string;
  quantity: string;
  unitCost: string | null;
  date: string;
  source: string | null;
  supplier: string | null;
  reference: string | null;
  notes: string | null;
  recipient: string | null;
  purpose: string | null;
  transferId: string | null;
  /** Shared by movements saved together (several items on one form); null for single saves. */
  batchId: string | null;
  adjustmentReason: string | null;
  /** Name of the item variant the movement was for, if any. */
  variant: string | null;
  lotNumber: string | null;
  /** Date-only values arrive as ISO date-times at midnight UTC. */
  manufactureDate: string | null;
  expiryDate: string | null;
  lotId: string | null;
  purchaseOrderLineId: string | null;
}

export function getMovementQuantity(m: StockMovement): number {
  return m.lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function getMovementValue(m: StockMovement): number {
  return m.lines.reduce((sum, l) => sum + l.quantity * (l.unitCost ?? 0), 0);
}

const UI_TYPE: Record<ApiMovementType, StockMovementType> = {
  STOCK_IN: 'STOCK_IN',
  STOCK_OUT: 'STOCK_OUT',
  TRANSFER_OUT: 'TRANSFER',
  TRANSFER_IN: 'TRANSFER',
  ADJUSTMENT_INCREASE: 'ADJUSTMENT',
  ADJUSTMENT_DECREASE: 'ADJUSTMENT',
};

/**
 * Turns service rows into movements. A transfer is two rows sharing a transferId, and rows saved
 * together share a batchId: each of those reads back as one movement with several lines.
 */
function toMovements(rows: ApiStockMovement[]): StockMovement[] {
  const result: StockMovement[] = [];
  const transfers = new Map<string, StockMovement>();
  const batchIdOf = new Map<StockMovement, string>();
  for (const m of rows) {
    const before = result.length;
    const type = UI_TYPE[m.type];
    const quantity = toNumber(m.quantity) ?? 0;
    const base = {
      id: m.id,
      reference:
        m.reference ?? `${REFERENCE_PREFIX[type]}-${(m.batchId ?? m.id).slice(0, 8).toUpperCase()}`,
      date: m.date,
      type,
      lines: [
        {
          itemId: m.itemId,
          quantity,
          unitCost: toNumber(m.unitCost),
          variant: m.variant,
          lotNumber: m.lotNumber,
          manufactureDate: m.manufactureDate?.slice(0, 10) ?? null,
          expiryDate: m.expiryDate?.slice(0, 10) ?? null,
          lotId: m.lotId,
          purchaseOrderLineId: m.purchaseOrderLineId,
        },
      ],
      fromWarehouseId: null,
      toWarehouseId: null,
      source: null,
      notes: m.notes,
      reason: null,
      purpose: null,
      status: 'COMPLETED' as const,
    };
    if (type === 'TRANSFER' && m.transferId) {
      const existing = transfers.get(m.transferId);
      const merged: StockMovement = existing ?? { ...base, id: m.transferId };
      // The out row names the batch taken from the source, the in row the one it became.
      const line = merged.lines[0];
      if (m.type === 'TRANSFER_OUT') {
        merged.fromWarehouseId = m.locationId;
        line.lotId = m.lotId;
      } else {
        merged.toWarehouseId = m.locationId;
        line.toLotId = m.lotId;
        if (!existing) line.lotId = null;
      }
      if (!existing) {
        transfers.set(m.transferId, merged);
        result.push(merged);
      }
    } else if (type === 'STOCK_IN') {
      result.push({ ...base, toWarehouseId: m.locationId, source: m.source ?? m.supplier });
    } else if (type === 'STOCK_OUT') {
      result.push({
        ...base,
        fromWarehouseId: m.locationId,
        source: m.recipient,
        purpose: m.purpose,
      });
    } else if (type === 'ADJUSTMENT') {
      const decrease = m.type === 'ADJUSTMENT_DECREASE';
      result.push({
        ...base,
        // Adjustment quantities are signed: negative when stock is reduced.
        lines: [{ ...base.lines[0], quantity: decrease ? -quantity : quantity }],
        fromWarehouseId: decrease ? m.locationId : null,
        toWarehouseId: decrease ? null : m.locationId,
        reason: m.adjustmentReason,
      });
    }
    // A row that started a new movement carries its batch along for the grouping below.
    if (m.batchId && result.length > before) batchIdOf.set(result[result.length - 1], m.batchId);
  }
  // The list is newest first, so older rows of a batch come later: put them in front of the
  // lines gathered so far to restore the order they were saved in.
  const grouped: StockMovement[] = [];
  const batches = new Map<string, StockMovement>();
  for (const mv of result) {
    const batchId = batchIdOf.get(mv);
    if (!batchId) {
      grouped.push(mv);
      continue;
    }
    const existing = batches.get(batchId);
    if (existing) existing.lines.unshift(...mv.lines);
    else {
      const batch = { ...mv, id: batchId, lines: [...mv.lines] };
      batches.set(batchId, batch);
      grouped.push(batch);
    }
  }
  return grouped;
}

export function useStockMovements() {
  const { data, isLoading } = useQuery({
    queryKey: inventoryKeys.movements,
    queryFn: () => inventoryApi.get<ApiStockMovement[]>('/stock-movements'),
  });
  // The service returns newest first.
  const reversedIds = useReversedMovementStore((s) => s.ids);
  const cancelledIds = useCancelledMovementStore((s) => s.ids);
  const deletedIds = useDeletedMovementStore((s) => s.ids);
  const revaluations = useRevaluationStore((s) => s.entries);
  const movements = useMemo(
    () =>
      [
        ...revaluations.map(revaluationToMovement),
        ...toMovements(data ?? []).map((m) => {
          if (cancelledIds.includes(m.id)) return { ...m, status: 'CANCELLED' as const };
          return reversedIds.includes(m.id) ? { ...m, status: 'REVERSED' as const } : m;
        }),
      ].filter((m) => !deletedIds.includes(m.id)),
    [data, reversedIds, cancelledIds, revaluations, deletedIds],
  );
  return { movements, isLoading };
}

/**
 * Posts a movement as one batch request: every item is saved together under a shared batchId, or
 * none is, so a failure part-way never leaves half a movement behind.
 */
function postMovement(movement: NewStockMovement) {
  const common = {
    reference: movement.reference?.trim() || null,
    notes: movement.notes,
  };
  const lines = movement.lines.map((l) => ({
    itemId: l.itemId,
    quantity: toDecimal(Math.abs(l.quantity)),
    variant: l.variant || null,
  }));
  // A line can name the batch to draw on; otherwise the service picks, earliest expiry first.
  const lotLines = lines.map((l, i) => ({ ...l, lotId: movement.lines[i].lotId || null }));
  if (movement.type === 'STOCK_IN') {
    if (!movement.toWarehouseId) throw new Error('Choose a warehouse to receive the stock.');
    return inventoryApi.post<{ batchId: string }>('/stock-in-batches', {
      ...common,
      locationId: movement.toWarehouseId,
      dateReceived: movement.date,
      source: movement.source,
      lines: movement.lines.map((l, i) => ({
        ...lines[i],
        unitCost: toDecimal(l.unitCost),
        // Stock coming back (a reversed issue) is added to the batch it left; new stock names its own.
        ...(l.lotId
          ? { lotId: l.lotId }
          : {
              lotNumber: l.lotNumber?.trim() || null,
              manufactureDate: l.manufactureDate || null,
              expiryDate: l.expiryDate || null,
            }),
      })),
    });
  }
  if (movement.type === 'STOCK_OUT') {
    if (!movement.fromWarehouseId) throw new Error('Choose a warehouse to issue stock from.');
    if (!movement.purpose) throw new Error('Choose a purpose for this issue.');
    return inventoryApi.post<{ batchId: string }>('/stock-out-batches', {
      ...common,
      locationId: movement.fromWarehouseId,
      date: movement.date,
      purpose: movement.purpose,
      recipient: movement.source,
      lines: lotLines,
    });
  }
  if (movement.type === 'TRANSFER') {
    if (!movement.fromWarehouseId || !movement.toWarehouseId)
      throw new Error('Choose the warehouses to transfer between.');
    return inventoryApi.post<{ batchId: string }>('/stock-transfer-batches', {
      ...common,
      sourceLocationId: movement.fromWarehouseId,
      destinationLocationId: movement.toWarehouseId,
      date: movement.date,
      lines: lotLines,
    });
  }
  // One adjustment is all increases or all decreases (the form has a single type).
  const decrease = movement.lines.some((l) => l.quantity < 0);
  const locationId = decrease ? movement.fromWarehouseId : movement.toWarehouseId;
  if (!locationId) throw new Error('Choose a warehouse to adjust.');
  if (!movement.reason) throw new Error('Choose a reason for this adjustment.');
  return inventoryApi.post<{ batchId: string }>('/stock-adjustment-batches', {
    ...common,
    locationId,
    type: decrease ? 'DECREASE' : 'INCREASE',
    reason: movement.reason,
    date: movement.date,
    lines: lotLines,
  });
}

export function useCreateStockMovement() {
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: async (movement: NewStockMovement) => {
      await postMovement(movement);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.movements });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.balances });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.variantBalances });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.lots });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.variants });
    },
  });
  return { createMovement: m.mutateAsync, isPending: m.isPending };
}

/** The movement that puts back the stock a movement changed. */
function counterMovement(m: StockMovement): NewStockMovement {
  const date = new Date().toISOString().slice(0, 10);
  const base = {
    date,
    notes: `Stock returned from ${m.reference}`,
    source: null,
    reason: null,
    purpose: null,
    fromWarehouseId: null,
    toWarehouseId: null,
  };
  const lines = m.lines.map((l) => ({ ...l, quantity: Math.abs(l.quantity) }));
  if (m.type === 'STOCK_IN') {
    return {
      ...base,
      type: 'STOCK_OUT',
      purpose: 'OTHER',
      fromWarehouseId: m.toWarehouseId,
      lines,
    };
  }
  if (m.type === 'STOCK_OUT') {
    return { ...base, type: 'STOCK_IN', toWarehouseId: m.fromWarehouseId, lines };
  }
  if (m.type === 'TRANSFER') {
    return {
      ...base,
      type: 'TRANSFER',
      fromWarehouseId: m.toWarehouseId,
      toWarehouseId: m.fromWarehouseId,
      // Back from the batch the stock became at the destination.
      lines: lines.map((l) => ({ ...l, lotId: l.toLotId ?? null })),
    };
  }
  // An adjustment is undone by the opposite one; decreases carry negative quantities.
  const wasDecrease = m.lines.some((l) => l.quantity < 0);
  return {
    ...base,
    type: 'ADJUSTMENT',
    reason: 'DATA_CORRECTION',
    fromWarehouseId: wasDecrease ? null : m.toWarehouseId,
    toWarehouseId: wasDecrease ? m.fromWarehouseId : null,
    lines: lines.map((l) => ({ ...l, quantity: wasDecrease ? l.quantity : -l.quantity })),
  };
}

/**
 * Puts back the stock a posted movement changed, by posting the opposite movement. Resolves to the
 * id of that opposite movement (so it can be hidden from the lists), or null when the movement
 * changed no stock. Rejects, changing nothing, if the stock can't be put back, e.g. goods
 * received earlier have since been issued.
 */
export function useReturnMovementStock() {
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: async (movement: StockMovement) => {
      if (movement.kind) return null;
      const { batchId } = await postMovement(counterMovement(movement));
      return batchId;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.movements });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.balances });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.variantBalances });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.lots });
    },
  });
  return { returnStock: m.mutateAsync, isPending: m.isPending };
}
