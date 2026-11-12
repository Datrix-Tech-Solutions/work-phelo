import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCancelledMovementStore } from '@/hooks/inventory/useCancelledMovements';
import { useDeletedMovementStore } from '@/hooks/inventory/useDeletedMovements';
import { revaluationToMovement, useRevaluationStore } from '@/hooks/inventory/useStockRevaluations';
import { useReversedMovementStore } from '@/hooks/inventory/useReversedMovements';
import { inventoryApi, inventoryKeys, toDecimal, toNumber } from '@/hooks/inventory/inventoryApi';
import { useInventoryItems } from '@/hooks/inventory/useInventoryItems';

export type StockMovementType = 'STOCK_IN' | 'STOCK_OUT' | 'TRANSFER' | 'ADJUSTMENT';
/** DRAFT movements exist in this browser only; the service has no draft stage. */
/** REVERSED is recorded in this browser only; see useReversedMovements. */
/** PENDING and REJECTED are movements waiting for, or refused, approval: no stock has changed. */
export type StockMovementStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REVERSED'
  | 'REJECTED';

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
  /** User ids: who recorded (or issued) the movement and who approved it. Unknown for drafts. */
  createdBy?: string | null;
  approvedBy?: string | null;
  /** Rejected requests only. */
  rejectedBy?: string | null;
  rejectionReason?: string | null;
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
  createdBy: string;
  approvedBy: string | null;
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
      createdBy: m.createdBy,
      approvedBy: m.approvedBy,
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

type RequestKind = StockMovementType;

interface ApiRequestLine {
  itemId: string;
  quantity: string;
  variant?: string | null;
  unitCost?: string | null;
  lotId?: string | null;
  lotNumber?: string | null;
  manufactureDate?: string | null;
  expiryDate?: string | null;
}

/** A movement waiting for approval (or rejected), as the service keeps it: the body it will post. */
interface ApiMovementRequest {
  id: string;
  kind: RequestKind;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reference: string | null;
  createdBy: string;
  decidedBy: string | null;
  rejectionReason: string | null;
  payload: {
    reference?: string | null;
    notes?: string | null;
    date?: string;
    dateReceived?: string;
    locationId?: string;
    sourceLocationId?: string;
    destinationLocationId?: string;
    source?: string | null;
    recipient?: string | null;
    purpose?: string | null;
    reason?: string | null;
    type?: 'INCREASE' | 'DECREASE';
    lines: ApiRequestLine[];
  };
}

/** Prices a request's lines would be valued at once posted, where the request doesn't say. */
type PriceOf = (itemId: string, kind: RequestKind) => number | null;

function requestToMovement(r: ApiMovementRequest, priceOf: PriceOf): StockMovement {
  const { payload: p, kind } = r;
  const decrease = kind === 'ADJUSTMENT' && p.type === 'DECREASE';
  const lines = p.lines.map((l) => ({
    itemId: l.itemId,
    quantity: decrease ? -(toNumber(l.quantity) ?? 0) : (toNumber(l.quantity) ?? 0),
    unitCost: toNumber(l.unitCost) ?? priceOf(l.itemId, kind),
    variant: l.variant ?? null,
    lotNumber: l.lotNumber ?? null,
    manufactureDate: l.manufactureDate ?? null,
    expiryDate: l.expiryDate ?? null,
    lotId: l.lotId ?? null,
  }));
  const reference = r.reference ?? `${REFERENCE_PREFIX[kind]}-${r.id.slice(0, 8).toUpperCase()}`;
  return {
    id: r.id,
    reference,
    date: p.dateReceived ?? p.date ?? '',
    type: kind,
    lines,
    fromWarehouseId:
      kind === 'STOCK_OUT'
        ? (p.locationId ?? null)
        : kind === 'TRANSFER'
          ? (p.sourceLocationId ?? null)
          : decrease
            ? (p.locationId ?? null)
            : null,
    toWarehouseId:
      kind === 'STOCK_IN'
        ? (p.locationId ?? null)
        : kind === 'TRANSFER'
          ? (p.destinationLocationId ?? null)
          : kind === 'ADJUSTMENT' && !decrease
            ? (p.locationId ?? null)
            : null,
    source:
      kind === 'STOCK_IN'
        ? (p.source ?? null)
        : kind === 'STOCK_OUT'
          ? (p.recipient ?? null)
          : null,
    notes: p.notes ?? null,
    reason: kind === 'ADJUSTMENT' ? (p.reason ?? null) : null,
    purpose: kind === 'STOCK_OUT' ? (p.purpose ?? null) : null,
    status: r.status === 'REJECTED' ? 'REJECTED' : 'PENDING',
    createdBy: r.createdBy,
    approvedBy: null,
    rejectedBy: r.status === 'REJECTED' ? r.decidedBy : null,
    rejectionReason: r.rejectionReason,
  };
}

export function useStockMovements() {
  const { data, isLoading } = useQuery({
    queryKey: inventoryKeys.movements,
    queryFn: () => inventoryApi.get<ApiStockMovement[]>('/stock-movements'),
  });
  const { data: requests, isLoading: isLoadingRequests } = useQuery({
    queryKey: inventoryKeys.movementRequests,
    queryFn: () => inventoryApi.get<ApiMovementRequest[]>('/stock-movement-requests'),
  });
  const { items } = useInventoryItems();
  const pending = useMemo(() => {
    const priceOf: PriceOf = (itemId, kind) => {
      const item = items.find((i) => i.id === itemId);
      // Issues are valued at selling price; transfers and adjustments at cost.
      return (kind === 'STOCK_OUT' ? item?.sellingPrice : item?.costPrice) ?? null;
    };
    return (requests ?? []).map((r) => requestToMovement(r, priceOf));
  }, [requests, items]);
  // The service returns newest first.
  const reversedIds = useReversedMovementStore((s) => s.ids);
  const cancelledIds = useCancelledMovementStore((s) => s.ids);
  const deletedIds = useDeletedMovementStore((s) => s.ids);
  const revaluations = useRevaluationStore((s) => s.entries);
  const movements = useMemo(
    () =>
      [
        ...pending,
        ...revaluations.map(revaluationToMovement),
        ...toMovements(data ?? []).map((m) => {
          if (cancelledIds.includes(m.id)) return { ...m, status: 'CANCELLED' as const };
          return reversedIds.includes(m.id) ? { ...m, status: 'REVERSED' as const } : m;
        }),
      ].filter((m) => !deletedIds.includes(m.id)),
    [data, pending, reversedIds, cancelledIds, revaluations, deletedIds],
  );
  return { movements, isLoading: isLoading || isLoadingRequests };
}

/** Where the service takes each kind of movement as a request for approval. */
const REQUEST_PATH: Record<string, string> = {
  '/stock-in-batches': '/stock-movement-requests/stock-in',
  '/stock-out-batches': '/stock-movement-requests/stock-out',
  '/stock-transfer-batches': '/stock-movement-requests/transfer',
  '/stock-adjustment-batches': '/stock-movement-requests/adjustment',
};

/**
 * Posts a movement as one batch request: every item is saved together under a shared batchId, or
 * none is, so a failure part-way never leaves half a movement behind. It changes stock at once;
 * new movements go through submitMovement instead, so that they are approved first.
 */
function postMovement(movement: NewStockMovement) {
  const { path, body } = movementBody(movement);
  return inventoryApi.post<{ batchId: string }>(path, body);
}

/** The service endpoint and body for a movement. */
function movementBody(movement: NewStockMovement): { path: string; body: object } {
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
    return {
      path: '/stock-in-batches',
      body: {
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
      },
    };
  }
  if (movement.type === 'STOCK_OUT') {
    if (!movement.fromWarehouseId) throw new Error('Choose a warehouse to issue stock from.');
    if (!movement.purpose) throw new Error('Choose a purpose for this issue.');
    return {
      path: '/stock-out-batches',
      body: {
        ...common,
        locationId: movement.fromWarehouseId,
        date: movement.date,
        purpose: movement.purpose,
        recipient: movement.source,
        lines: lotLines,
      },
    };
  }
  if (movement.type === 'TRANSFER') {
    if (!movement.fromWarehouseId || !movement.toWarehouseId)
      throw new Error('Choose the warehouses to transfer between.');
    return {
      path: '/stock-transfer-batches',
      body: {
        ...common,
        sourceLocationId: movement.fromWarehouseId,
        destinationLocationId: movement.toWarehouseId,
        date: movement.date,
        lines: lotLines,
      },
    };
  }
  // One adjustment is all increases or all decreases (the form has a single type).
  const decrease = movement.lines.some((l) => l.quantity < 0);
  const locationId = decrease ? movement.fromWarehouseId : movement.toWarehouseId;
  if (!locationId) throw new Error('Choose a warehouse to adjust.');
  if (!movement.reason) throw new Error('Choose a reason for this adjustment.');
  return {
    path: '/stock-adjustment-batches',
    body: {
      ...common,
      locationId,
      type: decrease ? 'DECREASE' : 'INCREASE',
      reason: movement.reason,
      date: movement.date,
      lines: lotLines,
    },
  };
}

const refreshStock = (queryClient: ReturnType<typeof useQueryClient>) => {
  for (const key of [
    inventoryKeys.movements,
    inventoryKeys.movementRequests,
    inventoryKeys.balances,
    inventoryKeys.variantBalances,
    inventoryKeys.lots,
    inventoryKeys.variants,
  ])
    queryClient.invalidateQueries({ queryKey: key });
};

/**
 * Saves a movement for approval. Stock does not change until it is approved, so a movement can be
 * checked before it takes effect. Resolves to the id of the request.
 */
export function useCreateStockMovement() {
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: async (movement: NewStockMovement) => {
      const { path, body } = movementBody(movement);
      const request = await inventoryApi.post<{ id: string }>(REQUEST_PATH[path], body);
      return request.id;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.movementRequests });
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

/** Approves or rejects a movement waiting for approval. Approving posts it to stock. */
export function useMovementApproval() {
  const queryClient = useQueryClient();
  const approve = useMutation({
    mutationFn: (id: string) =>
      inventoryApi.post<{ batchId: string }>(`/stock-movement-requests/${id}/approve`, {}),
    onSettled: () => refreshStock(queryClient),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      inventoryApi.post(`/stock-movement-requests/${id}/reject`, { reason }),
    onSettled: () => refreshStock(queryClient),
  });
  return {
    approveMovement: approve.mutateAsync,
    isApproving: approve.isPending,
    rejectMovement: (id: string, reason: string) => reject.mutateAsync({ id, reason }),
    isRejecting: reject.isPending,
  };
}
