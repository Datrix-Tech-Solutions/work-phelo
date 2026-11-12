import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, inventoryKeys, toNumber } from '@/hooks/inventory/inventoryApi';

export type PurchaseOrderStatus =
  /** Approved, waiting for the supplier's invoice. */
  | 'ORDERED'
  /** Invoiced, nothing received yet. */
  | 'INVOICED'
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
  /** The average unit cost invoiced so far; goods are received at it. Null until invoiced. */
  unitCost: number | null;
  /** Units the supplier has invoiced, and what they come to. */
  invoicedQuantity: number;
  invoicedValue: number;
  /** The units received, at the unit cost. */
  receivedValue: number;
  /** Units of the order that have arrived. */
  receivedQuantity: number;
  /** Free units received on top of the order: stocked and valued, but not paid for. */
  extraQuantity: number;
  /** Units that arrived damaged: not stocked and not counted as received. */
  damagedQuantity: number;
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
  /** The payment this is a share of; one payment can cover several orders. */
  paymentId: string;
  /** What this payment put toward this order. */
  amount: number;
  /** ISO date paid. */
  date: string;
  method: SupplierPaymentMethod;
  reference: string | null;
  notes: string | null;
  /** User id of who recorded the payment, and when (ISO date-time). */
  recordedBy: string;
  recordedAt: string;
}

export interface PurchaseInvoice {
  id: string;
  /** The supplier's invoice number. */
  number: string;
  date: string;
  dueDate: string | null;
  notes: string | null;
  /** Void once the order is cancelled. */
  void: boolean;
  /** User id of who recorded it, and when (ISO date-time). */
  recordedBy: string;
  recordedAt: string;
  lines: { lineId: string; quantity: number; unitCost: number }[];
  total: number;
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
  /** The supplier's invoices for this order, oldest first. */
  invoices: PurchaseInvoice[];
  status: PurchaseOrderStatus;
  /** User ids; approvedBy is empty for orders placed before approvals existed. */
  createdBy: string;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
}

export const PURCHASE_ORDER_STATUS_BADGE: Record<
  PurchaseOrderStatus,
  { label: string; variant: 'success' | 'warning' | 'neutral' | 'info' | 'danger' }
> = {
  ORDERED: { label: 'Awaiting Invoice', variant: 'info' },
  INVOICED: { label: 'Invoiced', variant: 'info' },
  PARTIALLY_RECEIVED: { label: 'Partially Received', variant: 'warning' },
  RECEIVED: { label: 'Received', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
  CLOSED: { label: 'Closed', variant: 'success' },
  PENDING_APPROVAL: { label: 'Pending Approval', variant: 'warning' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
};

export const purchaseOrderQuantity = (po: PurchaseOrder) =>
  po.lines.reduce((sum, l) => sum + l.orderedQuantity, 0);

/** What the supplier has invoiced for the order (what it costs, as far as it is priced). */
export const purchaseOrderInvoiced = (po: PurchaseOrder) =>
  po.lines.reduce((sum, l) => sum + l.invoicedValue, 0);

/** Alias kept for the dashboard: an order is worth what has been invoiced for it. */
export const purchaseOrderValue = purchaseOrderInvoiced;

// Orders on these terms are paid when the goods arrive; on any other terms (in advance, net 30, no
// terms) they are paid against the invoice.
const PAID_ON_RECEIPT = ['due on receipt', 'cash on delivery'];

/** Whether the payment terms mean paying once the goods have arrived. */
export const termsPayOnReceipt = (terms: string | null) =>
  PAID_ON_RECEIPT.includes((terms ?? '').trim().toLowerCase());

/** Whether the order is paid for what has been received rather than what has been invoiced. A
 * closed order is: the part never delivered is not owed. */
export const paysOnReceipt = (po: PurchaseOrder) =>
  po.status === 'CLOSED' || termsPayOnReceipt(po.paymentTerms);

/** What can be paid to the supplier so far, by the order's payment terms. Extras are free. */
export const purchaseOrderAmountOwed = (po: PurchaseOrder) =>
  po.lines.reduce((sum, l) => sum + (paysOnReceipt(po) ? l.receivedValue : l.invoicedValue), 0);

/** Still owed to the supplier on this order: what was received, less what has been paid. */
export const purchaseOrderBalance = (po: PurchaseOrder) =>
  Math.max(0, purchaseOrderAmountOwed(po) - po.amountPaid);

/** A payment can be made once something received is still unpaid. */
export const canPay = (po: PurchaseOrder) =>
  po.status !== 'CANCELLED' && purchaseOrderBalance(po) >= 0.01;

export const isOpenOrder = (po: PurchaseOrder) =>
  po.status === 'ORDERED' || po.status === 'INVOICED' || po.status === 'PARTIALLY_RECEIVED';

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
    /** Invoiced but not yet delivered, at the invoiced unit costs. */
    pendingDeliveryValue: open.reduce(
      (sum, o) =>
        sum +
        o.lines.reduce(
          (s, l) => s + Math.max(0, l.invoicedQuantity - l.receivedQuantity) * (l.unitCost ?? 0),
          0,
        ),
      0,
    ),
    /** Payable but not paid yet, by each order's payment terms. */
    amountOwed: live.reduce(
      (sum, o) => sum + Math.max(0, purchaseOrderAmountOwed(o) - o.amountPaid),
      0,
    ),
    lastOrderDate: dates.length ? dates[dates.length - 1] : null,
  };
}

/** Goods can be received once they are invoiced, up to what is invoiced and not yet received. */
export const canReceive = (po: PurchaseOrder) =>
  (po.status === 'INVOICED' || po.status === 'PARTIALLY_RECEIVED') &&
  po.lines.some((l) => l.invoicedQuantity > l.receivedQuantity);

/** An approved order can be invoiced until everything ordered has been. */
export const canRecordInvoice = (po: PurchaseOrder) =>
  (po.status === 'ORDERED' || po.status === 'INVOICED' || po.status === 'PARTIALLY_RECEIVED') &&
  po.lines.some((l) => l.orderedQuantity > l.invoicedQuantity);

/** Part-delivered orders can be closed: the rest of the goods is no longer expected. */
export const canCloseOrder = (po: PurchaseOrder) => po.status === 'PARTIALLY_RECEIVED';

/** An order waiting for approval can be approved or rejected. */
export const canApproveOrder = (po: PurchaseOrder) => po.status === 'PENDING_APPROVAL';

/** Cancelling is possible until something is received or paid; after that, close the order. */
export const canCancelOrder = (po: PurchaseOrder) =>
  (po.status === 'PENDING_APPROVAL' || po.status === 'ORDERED' || po.status === 'INVOICED') &&
  po.amountPaid === 0 &&
  po.lines.every((l) => l.receivedQuantity === 0 && l.extraQuantity === 0);

interface ApiLine {
  id: string;
  itemId: string;
  variantName: string | null;
  orderedQuantity: string;
  unitCost: string | null;
  invoicedQuantity: string;
  invoicedValue: string;
  receivedValue: string;
  receivedQuantity: string;
  extraQuantity: string;
  damagedQuantity: string;
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
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  lines: ApiLine[];
  invoices?: {
    id: string;
    number: string;
    invoiceDate: string;
    dueDate: string | null;
    notes: string | null;
    status: 'ACTIVE' | 'VOID';
    createdBy: string;
    createdAt: string;
    lines: { purchaseOrderLineId: string; quantity: string; unitCost: string }[];
  }[];
  payments?: {
    id: string;
    paymentId: string;
    amount: string;
    payment: {
      paymentDate: string;
      method: SupplierPaymentMethod;
      reference: string | null;
      notes: string | null;
      createdBy: string;
      createdAt: string;
    };
  }[];
}

function fromApi(o: ApiPurchaseOrder): PurchaseOrder {
  const payments = (o.payments ?? []).map((p) => ({
    id: p.id,
    // An older API sends no paymentId: treat the share as its own payment.
    paymentId: p.paymentId ?? p.id,
    amount: toNumber(p.amount) ?? 0,
    date: p.payment.paymentDate.slice(0, 10),
    method: p.payment.method,
    reference: p.payment.reference,
    notes: p.payment.notes,
    recordedBy: p.payment.createdBy,
    recordedAt: p.payment.createdAt,
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
    invoices: (o.invoices ?? []).map((i) => {
      const lines = i.lines.map((l) => ({
        lineId: l.purchaseOrderLineId,
        quantity: toNumber(l.quantity) ?? 0,
        unitCost: toNumber(l.unitCost) ?? 0,
      }));
      return {
        id: i.id,
        number: i.number,
        date: i.invoiceDate.slice(0, 10),
        dueDate: i.dueDate?.slice(0, 10) ?? null,
        notes: i.notes,
        void: i.status === 'VOID',
        recordedBy: i.createdBy,
        recordedAt: i.createdAt,
        lines,
        total: lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0),
      };
    }),
    amountPaid: payments.reduce((sum, p) => sum + p.amount, 0),
    status: o.status,
    createdBy: o.createdBy,
    createdAt: o.createdAt,
    approvedBy: o.approvedBy,
    approvedAt: o.approvedAt,
    rejectedBy: o.rejectedBy,
    rejectedAt: o.rejectedAt,
    rejectionReason: o.rejectionReason,
    lines: o.lines.map((l) => ({
      id: l.id,
      itemId: l.itemId,
      variant: l.variantName,
      orderedQuantity: toNumber(l.orderedQuantity) ?? 0,
      unitCost: toNumber(l.unitCost),
      invoicedQuantity: toNumber(l.invoicedQuantity) ?? 0,
      invoicedValue: toNumber(l.invoicedValue) ?? 0,
      receivedValue: toNumber(l.receivedValue) ?? 0,
      receivedQuantity: toNumber(l.receivedQuantity) ?? 0,
      extraQuantity: toNumber(l.extraQuantity) ?? 0,
      damagedQuantity: toNumber(l.damagedQuantity) ?? 0,
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
  lines: { itemId: string; variant: string | null; quantity: number }[];
}

export interface NewPurchaseInvoice {
  number: string;
  invoiceDate: string;
  dueDate: string | null;
  notes: string | null;
  lines: { lineId: string; quantity: number; unitCost: number }[];
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
    damagedQuantity: number;
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
          damagedQuantity: String(l.damagedQuantity),
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
  const invoiceMutation = useMutation({
    mutationFn: ({ id, invoice }: { id: string; invoice: NewPurchaseInvoice }) =>
      inventoryApi.post<ApiPurchaseOrder>(`/purchase-orders/${id}/invoices`, {
        number: invoice.number,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        notes: invoice.notes,
        lines: invoice.lines.map((l) => ({
          lineId: l.lineId,
          quantity: String(l.quantity),
          unitCost: l.unitCost.toFixed(4),
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
    recordPurchaseInvoice: (id: string, invoice: NewPurchaseInvoice) =>
      invoiceMutation.mutateAsync({ id, invoice }),
    isInvoicing: invoiceMutation.isPending,
    approvePurchaseOrder: approve.mutateAsync,
    isApproving: approve.isPending,
    rejectPurchaseOrder: (id: string, reason: string) => reject.mutateAsync({ id, reason }),
    isRejecting: reject.isPending,
    closePurchaseOrder: close.mutateAsync,
    isClosing: close.isPending,
  };
}
