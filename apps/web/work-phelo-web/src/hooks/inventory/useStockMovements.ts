import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, inventoryKeys, toDecimal, toNumber } from '@/hooks/inventory/inventoryApi';

export type StockMovementType = 'STOCK_IN' | 'STOCK_OUT' | 'TRANSFER' | 'ADJUSTMENT';
export type StockMovementStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface StockMovementLine {
  itemId: string;
  quantity: number;
  unitCost: number | null;
}

export interface StockMovement {
  id: string;
  reference: string;
  /** ISO date of the movement. */
  date: string;
  type: StockMovementType;
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
  adjustmentReason: string | null;
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

/** Turns service rows into movements. A transfer is two rows sharing a transferId: one movement. */
function toMovements(rows: ApiStockMovement[]): StockMovement[] {
  const result: StockMovement[] = [];
  const transfers = new Map<string, StockMovement>();
  for (const m of rows) {
    const type = UI_TYPE[m.type];
    const quantity = toNumber(m.quantity) ?? 0;
    const base = {
      id: m.id,
      reference: m.reference ?? `${REFERENCE_PREFIX[type]}-${m.id.slice(0, 8).toUpperCase()}`,
      date: m.date,
      type,
      lines: [{ itemId: m.itemId, quantity, unitCost: toNumber(m.unitCost) }],
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
      if (m.type === 'TRANSFER_OUT') merged.fromWarehouseId = m.locationId;
      else merged.toWarehouseId = m.locationId;
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
  }
  return result;
}

export function useStockMovements() {
  const { data, isLoading } = useQuery({
    queryKey: inventoryKeys.movements,
    queryFn: () => inventoryApi.get<ApiStockMovement[]>('/stock-movements'),
  });
  // The service returns newest first.
  const movements = useMemo(() => toMovements(data ?? []), [data]);
  return { movements, isLoading };
}

/** Posts one movement. The service records one item per request, so each line is its own request. */
async function postLine(movement: NewStockMovement, line: StockMovementLine) {
  const common = {
    itemId: line.itemId,
    reference: movement.reference?.trim() || null,
    notes: movement.notes,
  };
  const quantity = toDecimal(Math.abs(line.quantity));
  if (movement.type === 'STOCK_IN') {
    if (!movement.toWarehouseId) throw new Error('Choose a warehouse to receive the stock.');
    return inventoryApi.post('/stock-in', {
      ...common,
      locationId: movement.toWarehouseId,
      quantity,
      dateReceived: movement.date,
      unitCost: toDecimal(line.unitCost),
      source: movement.source,
    });
  }
  if (movement.type === 'STOCK_OUT') {
    if (!movement.fromWarehouseId) throw new Error('Choose a warehouse to issue stock from.');
    if (!movement.purpose) throw new Error('Choose a purpose for this issue.');
    return inventoryApi.post('/stock-out', {
      ...common,
      locationId: movement.fromWarehouseId,
      quantity,
      date: movement.date,
      purpose: movement.purpose,
      recipient: movement.source,
    });
  }
  if (movement.type === 'TRANSFER') {
    if (!movement.fromWarehouseId || !movement.toWarehouseId)
      throw new Error('Choose the warehouses to transfer between.');
    return inventoryApi.post('/stock-transfers', {
      ...common,
      sourceLocationId: movement.fromWarehouseId,
      destinationLocationId: movement.toWarehouseId,
      quantity,
      date: movement.date,
    });
  }
  const decrease = line.quantity < 0;
  const locationId = decrease ? movement.fromWarehouseId : movement.toWarehouseId;
  if (!locationId) throw new Error('Choose a warehouse to adjust.');
  if (!movement.reason) throw new Error('Choose a reason for this adjustment.');
  return inventoryApi.post('/stock-adjustments', {
    ...common,
    locationId,
    type: decrease ? 'DECREASE' : 'INCREASE',
    quantity,
    reason: movement.reason,
    date: movement.date,
  });
}

export function useCreateStockMovement() {
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: async (movement: NewStockMovement) => {
      for (const line of movement.lines) await postLine(movement, line);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.movements });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.balances });
    },
  });
  return { createMovement: m.mutateAsync, isPending: m.isPending };
}
