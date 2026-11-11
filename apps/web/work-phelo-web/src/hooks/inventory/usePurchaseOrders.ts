import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, inventoryKeys, toNumber } from '@/hooks/inventory/inventoryApi';

export type PurchaseOrderStatus = 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderLine {
  id: string;
  itemId: string;
  variant: string | null;
  orderedQuantity: number;
  unitCost: number;
  /** Units of the order that have arrived: what the supplier is paid for. */
  receivedQuantity: number;
  /** Free units received on top of the order: stocked and valued, but not paid for. */
  extraQuantity: number;
}

export interface PurchaseOrder {
  id: string;
  reference: string;
  /** ISO date the order was placed. */
  date: string;
  expectedDate: string | null;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  paymentTerms: string | null;
  notes: string | null;
  lines: PurchaseOrderLine[];
  /** Payments aren't recorded yet, so this is always 0. */
  amountPaid: number;
  status: PurchaseOrderStatus;
}

export const PURCHASE_ORDER_STATUS_BADGE: Record<
  PurchaseOrderStatus,
  { label: string; variant: 'success' | 'warning' | 'neutral' | 'info' | 'danger' }
> = {
  ORDERED: { label: 'Ordered', variant: 'info' },
  PARTIALLY_RECEIVED: { label: 'Partially Received', variant: 'warning' },
  RECEIVED: { label: 'Received', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
};

export const purchaseOrderQuantity = (po: PurchaseOrder) =>
  po.lines.reduce((sum, l) => sum + l.orderedQuantity, 0);

/** What the whole order costs at its unit costs. */
export const purchaseOrderValue = (po: PurchaseOrder) =>
  po.lines.reduce((sum, l) => sum + l.orderedQuantity * l.unitCost, 0);

/** What is owed to the supplier so far: units received at their unit cost. Extras are free. */
export const purchaseOrderAmountOwed = (po: PurchaseOrder) =>
  po.lines.reduce((sum, l) => sum + l.receivedQuantity * l.unitCost, 0);

export const isOpenOrder = (po: PurchaseOrder) =>
  po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED';

/** Figures for a set of purchase orders (e.g. one supplier's). Cancelled orders are left out of
 * every figure except the order count. */
export function summarizePurchaseOrders(orders: PurchaseOrder[]) {
  const live = orders.filter((o) => o.status !== 'CANCELLED');
  const open = live.filter(isOpenOrder);
  const dates = live.map((o) => o.date).sort();
  return {
    totalOrders: orders.length,
    pendingOrders: open.length,
    receivedOrders: live.filter((o) => o.status === 'RECEIVED').length,
    totalOrdered: live.reduce((sum, o) => sum + purchaseOrderValue(o), 0),
    /** Ordered but not yet delivered, at the order's unit costs. */
    pendingDeliveryValue: open.reduce(
      (sum, o) =>
        sum +
        o.lines.reduce(
          (s, l) => s + Math.max(0, l.orderedQuantity - l.receivedQuantity) * l.unitCost,
          0,
        ),
      0,
    ),
    /** Received but not paid for yet: units received at their unit cost, less payments. */
    amountOwed: live.reduce(
      (sum, o) => sum + Math.max(0, purchaseOrderAmountOwed(o) - o.amountPaid),
      0,
    ),
    lastOrderDate: dates.length ? dates[dates.length - 1] : null,
  };
}

export const canReceive = (po: PurchaseOrder) =>
  po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED';

export const canCancelOrder = (po: PurchaseOrder) =>
  po.status === 'ORDERED' &&
  po.lines.every((l) => l.receivedQuantity === 0 && l.extraQuantity === 0);

interface ApiLine {
  id: string;
  itemId: string;
  variantName: string | null;
  orderedQuantity: string;
  unitCost: string;
  receivedQuantity: string;
  extraQuantity: string;
}

interface ApiPurchaseOrder {
  id: string;
  reference: string;
  orderDate: string;
  expectedDate: string | null;
  supplierId: string;
  supplier: { name: string };
  locationId: string;
  paymentTerms: string | null;
  notes: string | null;
  status: PurchaseOrderStatus;
  lines: ApiLine[];
}

function fromApi(o: ApiPurchaseOrder): PurchaseOrder {
  return {
    id: o.id,
    reference: o.reference,
    date: o.orderDate.slice(0, 10),
    expectedDate: o.expectedDate?.slice(0, 10) ?? null,
    supplierId: o.supplierId,
    supplierName: o.supplier.name,
    warehouseId: o.locationId,
    paymentTerms: o.paymentTerms,
    notes: o.notes,
    amountPaid: 0,
    status: o.status,
    lines: o.lines.map((l) => ({
      id: l.id,
      itemId: l.itemId,
      variant: l.variantName,
      orderedQuantity: toNumber(l.orderedQuantity) ?? 0,
      unitCost: toNumber(l.unitCost) ?? 0,
      receivedQuantity: toNumber(l.receivedQuantity) ?? 0,
      extraQuantity: toNumber(l.extraQuantity) ?? 0,
    })),
  };
}

export interface NewPurchaseOrder {
  reference: string | null;
  orderDate: string;
  expectedDate: string | null;
  supplierId: string;
  warehouseId: string;
  paymentTerms: string | null;
  notes: string | null;
  lines: { itemId: string; variant: string | null; quantity: number; unitCost: number }[];
}

export interface PurchaseOrderReceipt {
  dateReceived: string;
  notes: string | null;
  lines: {
    lineId: string;
    receivedQuantity: number;
    extraQuantity: number;
    lotNumber: string | null;
    manufactureDate: string | null;
    expiryDate: string | null;
  }[];
}

/** Purchase orders from the inventory service, and the actions to place, receive or cancel one. */
export function usePurchaseOrders() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: inventoryKeys.purchaseOrders,
    queryFn: () => inventoryApi.get<ApiPurchaseOrder[]>('/purchase-orders'),
  });
  const purchaseOrders = useMemo(() => (data ?? []).map(fromApi), [data]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: inventoryKeys.purchaseOrders });
  const create = useMutation({
    mutationFn: (o: NewPurchaseOrder) =>
      inventoryApi.post<ApiPurchaseOrder>('/purchase-orders', {
        reference: o.reference,
        orderDate: o.orderDate,
        expectedDate: o.expectedDate,
        supplierId: o.supplierId,
        locationId: o.warehouseId,
        paymentTerms: o.paymentTerms,
        notes: o.notes,
        lines: o.lines.map((l) => ({
          itemId: l.itemId,
          variant: l.variant,
          quantity: String(l.quantity),
          unitCost: l.unitCost.toFixed(4),
        })),
      }),
    onSuccess: refresh,
  });
  // A receipt posts a stock in, so stock figures and batches change too.
  const receive = useMutation({
    mutationFn: ({ id, receipt }: { id: string; receipt: PurchaseOrderReceipt }) =>
      inventoryApi.post<ApiPurchaseOrder>(`/purchase-orders/${id}/receive`, {
        dateReceived: receipt.dateReceived,
        notes: receipt.notes,
        lines: receipt.lines.map((l) => ({
          lineId: l.lineId,
          receivedQuantity: String(l.receivedQuantity),
          extraQuantity: String(l.extraQuantity),
          lotNumber: l.lotNumber,
          manufactureDate: l.manufactureDate,
          expiryDate: l.expiryDate,
        })),
      }),
    onSettled: () => {
      refresh();
      for (const key of [
        inventoryKeys.movements,
        inventoryKeys.balances,
        inventoryKeys.variantBalances,
        inventoryKeys.lots,
        inventoryKeys.variants,
      ])
        queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const cancel = useMutation({
    mutationFn: (id: string) =>
      inventoryApi.post<ApiPurchaseOrder>(`/purchase-orders/${id}/cancel`, {}),
    onSuccess: refresh,
  });

  return {
    purchaseOrders,
    isLoading,
    createPurchaseOrder: create.mutateAsync,
    isCreating: create.isPending,
    receivePurchaseOrder: (id: string, receipt: PurchaseOrderReceipt) =>
      receive.mutateAsync({ id, receipt }),
    isReceiving: receive.isPending,
    cancelPurchaseOrder: cancel.mutateAsync,
    isCancelling: cancel.isPending,
  };
}
