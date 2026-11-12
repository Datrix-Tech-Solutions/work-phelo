import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, inventoryKeys, toNumber } from '@/hooks/inventory/inventoryApi';

export type PurchaseOrderStatus =
  | 'ORDERED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED'
  | 'CLOSED'
  /** Placed, waiting for someone to approve it; nothing can be received yet. */
  | 'PENDING_APPROVAL'
  | 'REJECTED';

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

export type SupplierPaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'CHEQUE' | 'OTHER';

export const PAYMENT_METHOD_LABEL: Record<SupplierPaymentMethod, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
  MOBILE_MONEY: 'Mobile Money',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
};

export interface PurchaseOrderPayment {
  id: string;
  /** What this payment put toward this order. */
  amount: number;
  /** ISO date paid. */
  date: string;
  method: SupplierPaymentMethod;
  reference: string | null;
  notes: string | null;
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
  /** Total paid to the supplier on this order so far. */
  amountPaid: number;
  /** Each payment (or share of one) made on this order, oldest first. */
  payments: PurchaseOrderPayment[];
  status: PurchaseOrderStatus;
  /** User ids; approvedBy is empty for orders placed before approvals existed. */
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
}

export const PURCHASE_ORDER_STATUS_BADGE: Record<
  PurchaseOrderStatus,
  { label: string; variant: 'success' | 'warning' | 'neutral' | 'info' | 'danger' }
> = {
  ORDERED: { label: 'Ordered', variant: 'info' },
  PARTIALLY_RECEIVED: { label: 'Partially Received', variant: 'warning' },
  RECEIVED: { label: 'Received', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
  CLOSED: { label: 'Closed', variant: 'success' },
  PENDING_APPROVAL: { label: 'Pending Approval', variant: 'warning' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
};

export const purchaseOrderQuantity = (po: PurchaseOrder) =>
  po.lines.reduce((sum, l) => sum + l.orderedQuantity, 0);

/** What the whole order costs at its unit costs. */
export const purchaseOrderValue = (po: PurchaseOrder) =>
  po.lines.reduce((sum, l) => sum + l.orderedQuantity * l.unitCost, 0);

/** What is owed to the supplier so far: units received at their unit cost. Extras are free. */
export const purchaseOrderAmountOwed = (po: PurchaseOrder) =>
  po.lines.reduce((sum, l) => sum + l.receivedQuantity * l.unitCost, 0);

/** Still owed to the supplier on this order: what was received, less what has been paid. */
export const purchaseOrderBalance = (po: PurchaseOrder) =>
  Math.max(0, purchaseOrderAmountOwed(po) - po.amountPaid);

/** A payment can be made once something received is still unpaid. */
export const canPay = (po: PurchaseOrder) =>
  po.status !== 'CANCELLED' && purchaseOrderBalance(po) >= 0.01;

export const isOpenOrder = (po: PurchaseOrder) =>
  po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED';

/** Figures for a set of purchase orders (e.g. one supplier's). Cancelled orders are left out of
 * every figure except the order count. */
export function summarizePurchaseOrders(orders: PurchaseOrder[]) {
  // Cancelled, rejected and not-yet-approved orders commit the business to nothing.
  const live = orders.filter(
    (o) => o.status !== 'CANCELLED' && o.status !== 'REJECTED' && o.status !== 'PENDING_APPROVAL',
  );
  const open = live.filter(isOpenOrder);
  const dates = live.map((o) => o.date).sort();
  return {
    totalOrders: orders.length,
    pendingOrders: open.length,
    receivedOrders: live.filter((o) => o.status === 'RECEIVED' || o.status === 'CLOSED').length,
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

/** Part-delivered orders can be closed: the rest of the goods is no longer expected. */
export const canCloseOrder = (po: PurchaseOrder) => po.status === 'PARTIALLY_RECEIVED';

/** An order waiting for approval can be approved or rejected. */
export const canApproveOrder = (po: PurchaseOrder) => po.status === 'PENDING_APPROVAL';

export const canCancelOrder = (po: PurchaseOrder) =>
  (po.status === 'PENDING_APPROVAL' || po.status === 'ORDERED') &&
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
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  lines: ApiLine[];
  payments?: {
    id: string;
    amount: string;
    payment: {
      paymentDate: string;
      method: SupplierPaymentMethod;
      reference: string | null;
      notes: string | null;
    };
  }[];
}

function fromApi(o: ApiPurchaseOrder): PurchaseOrder {
  const payments = (o.payments ?? []).map((p) => ({
    id: p.id,
    amount: toNumber(p.amount) ?? 0,
    date: p.payment.paymentDate.slice(0, 10),
    method: p.payment.method,
    reference: p.payment.reference,
    notes: p.payment.notes,
  }));
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
    payments,
    amountPaid: payments.reduce((sum, p) => sum + p.amount, 0),
    status: o.status,
    createdBy: o.createdBy,
    approvedBy: o.approvedBy,
    approvedAt: o.approvedAt,
    rejectedBy: o.rejectedBy,
    rejectionReason: o.rejectionReason,
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

export interface NewSupplierPayment {
  supplierId: string;
  paymentDate: string;
  method: SupplierPaymentMethod;
  reference: string | null;
  notes: string | null;
  /** How much of the payment goes to each order. */
  allocations: { purchaseOrderId: string; amount: number }[];
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

  const pay = useMutation({
    mutationFn: (p: NewSupplierPayment) =>
      inventoryApi.post<{ id: string }>('/supplier-payments', {
        supplierId: p.supplierId,
        paymentDate: p.paymentDate,
        method: p.method,
        reference: p.reference,
        notes: p.notes,
        allocations: p.allocations.map((a) => ({
          purchaseOrderId: a.purchaseOrderId,
          amount: a.amount.toFixed(4),
        })),
      }),
    onSettled: refresh,
  });
  const approve = useMutation({
    mutationFn: (id: string) =>
      inventoryApi.post<ApiPurchaseOrder>(`/purchase-orders/${id}/approve`, {}),
    onSettled: refresh,
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      inventoryApi.post<ApiPurchaseOrder>(`/purchase-orders/${id}/reject`, { reason }),
    onSettled: refresh,
  });
  const close = useMutation({
    mutationFn: (id: string) =>
      inventoryApi.post<ApiPurchaseOrder>(`/purchase-orders/${id}/close`, {}),
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
    makeSupplierPayment: pay.mutateAsync,
    isPaying: pay.isPending,
    approvePurchaseOrder: approve.mutateAsync,
    isApproving: approve.isPending,
    rejectPurchaseOrder: (id: string, reason: string) => reject.mutateAsync({ id, reason }),
    isRejecting: reject.isPending,
    closePurchaseOrder: close.mutateAsync,
    isClosing: close.isPending,
  };
}
