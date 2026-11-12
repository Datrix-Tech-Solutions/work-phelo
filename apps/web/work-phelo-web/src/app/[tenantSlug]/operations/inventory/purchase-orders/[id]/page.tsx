'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DetailField } from '@/components/atoms/DetailField';
import { CancelPurchaseOrderModal } from '@/components/organisms/inventory/CancelPurchaseOrderModal';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { StockMovementsTable } from '@/components/organisms/inventory/StockMovementsTable';
import { SupplierPaymentPanel } from '@/components/organisms/inventory/SupplierPaymentPanel';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { PurchaseOrderTimeline } from '@/components/organisms/inventory/PurchaseOrderTimeline';
import { RecordInvoicePanel } from '@/components/organisms/inventory/RecordInvoicePanel';
import { RejectPurchaseOrderModal } from '@/components/organisms/inventory/RejectPurchaseOrderModal';
import { ClosePurchaseOrderModal } from '@/components/organisms/inventory/ClosePurchaseOrderModal';
import { ReceivePurchaseOrderPanel } from '@/components/organisms/inventory/ReceivePurchaseOrderPanel';
import { useCanApprove } from '@/hooks/inventory/useApprovalAccess';
import { useUserNames } from '@/hooks/inventory/useUserNames';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { useInventoryItems } from '@/hooks/inventory/useInventoryItems';
import { useStockMovements } from '@/hooks/inventory/useStockMovements';
import { useInventoryWarehouses } from '@/hooks/inventory/useInventoryWarehouses';
import {
  PURCHASE_ORDER_STATUS_BADGE,
  canApproveOrder,
  canCancelOrder,
  canCloseOrder,
  canRecordInvoice,
  purchaseOrderInvoiced,
  type PurchaseInvoice,
  canPay,
  PAYMENT_METHOD_LABEL,
  purchaseOrderBalance,
  canReceive,
  purchaseOrderAmountOwed,
  usePurchaseOrders,
  type PurchaseOrderLine,
  type PurchaseOrderPayment,
} from '@/hooks/inventory/usePurchaseOrders';
import { formatDate } from '@/lib/formatters';
import { formatInventoryValue } from '@/lib/inventoryCurrency';
import { pageContent, pageHeader } from '@/lib/layout';

const formatNumber = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });

export default function PurchaseOrderDetailsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const base = `/${tenantSlug}/operations/inventory`;
  const { purchaseOrders, isLoading, approvePurchaseOrder, isApproving } = usePurchaseOrders();
  const { items } = useInventoryItems();
  const { warehouses } = useInventoryWarehouses();
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const toast = useToast();
  const userName = useUserNames();
  const canApprove = useCanApprove('PURCHASE_ORDER');
  const [tab, setTab] = useState('items');
  const { movements } = useStockMovements();

  const order = purchaseOrders.find((o) => o.id === id);

  const approve = async () => {
    if (!order) return;
    try {
      await approvePurchaseOrder(order.id);
      toast.success('Purchase order approved');
    } catch (err) {
      toast.error(extractError(err, 'Could not approve the order'));
    }
  };

  // Stock ins posted when items were received against this order's lines.
  const receipts = useMemo(() => {
    const lineIds = new Set(order?.lines.map((l) => l.id));
    return movements.filter(
      (m) =>
        m.type === 'STOCK_IN' &&
        m.lines.some((l) => l.purchaseOrderLineId && lineIds.has(l.purchaseOrderLineId)),
    );
  }, [movements, order]);

  if (!isLoading && !order) {
    return (
      <div className={`${pageHeader} flex flex-col gap-3 text-sm text-gray-500`}>
        <span>Purchase order not found.</span>
        <Link href={`${base}/purchase-orders`} className="text-brand hover:underline w-fit">
          Back to purchase orders
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className={`${pageHeader} flex flex-col gap-6`}>
        <div className="h-5 w-64 bg-gray-100 rounded animate-pulse" />
        <div className="h-24 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  const { label, variant } = PURCHASE_ORDER_STATUS_BADGE[order.status];
  const itemName = (itemId: string) => items.find((i) => i.id === itemId)?.name ?? 'Item';
  const warehouseName = warehouses.find((w) => w.id === order.warehouseId)?.name ?? '—';
  const extraUnits = order.lines.reduce((sum, l) => sum + l.extraQuantity, 0);

  const money = (n: number) => (
    <span className="text-sm font-semibold text-gray-600">{formatInventoryValue(n)}</span>
  );
  const quantity = (n: number) => (
    <span className="text-sm font-semibold text-gray-500">{formatNumber(n)}</span>
  );
  const lineColumns: Column<PurchaseOrderLine>[] = [
    {
      key: 'item',
      label: 'Item',
      width: 'minmax(180px, 2fr)',
      render: (l) => (
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-bold text-gray-900">{itemName(l.itemId)}</span>
          {l.variant && <span className="truncate text-xs text-gray-500">{l.variant}</span>}
        </div>
      ),
    },
    { key: 'ordered', label: 'Ordered', width: '90px', render: (l) => quantity(l.orderedQuantity) },
    {
      key: 'received',
      label: 'Received',
      width: '90px',
      render: (l) => quantity(l.receivedQuantity),
    },
    {
      key: 'invoiced',
      label: 'Invoiced',
      width: '90px',
      render: (l) => quantity(l.invoicedQuantity),
    },
    { key: 'extra', label: 'Extra', width: '80px', render: (l) => quantity(l.extraQuantity) },
    {
      key: 'outstanding',
      label: 'Outstanding',
      width: '110px',
      render: (l) =>
        quantity(
          order.status === 'CANCELLED' || order.status === 'CLOSED'
            ? 0
            : Math.max(0, l.orderedQuantity - l.receivedQuantity),
        ),
    },
    {
      key: 'unitCost',
      label: 'Unit Cost',
      width: '130px',
      className: 'text-right pr-4',
      // The average invoiced: invoices for a line can be at different prices.
      render: (l) => (l.unitCost === null ? '—' : money(l.unitCost)),
    },
    {
      key: 'invoicedAmount',
      label: 'Invoiced Amount',
      width: '140px',
      className: 'text-right pr-4',
      render: (l) => money(l.invoicedValue),
    },
  ];

  const invoiceColumns: Column<PurchaseInvoice>[] = [
    {
      key: 'number',
      label: 'Invoice No.',
      width: 'minmax(130px, 1fr)',
      render: (i) => (
        <span className="font-mono text-sm font-medium text-gray-900">
          {i.number}
          {i.void && <span className="ml-2 text-xs font-semibold text-gray-400">Void</span>}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      width: '110px',
      render: (i) => (
        <span className="text-sm font-semibold text-gray-500">{formatDate(i.date)}</span>
      ),
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      width: '110px',
      render: (i) => (
        <span className="text-sm font-semibold text-gray-500">
          {i.dueDate ? formatDate(i.dueDate) : '—'}
        </span>
      ),
    },
    {
      key: 'items',
      label: 'Items',
      width: '80px',
      render: (i) => quantity(i.lines.length),
    },
    {
      key: 'notes',
      label: 'Notes',
      width: 'minmax(140px, 2fr)',
      render: (i) => <span className="truncate text-sm text-gray-600">{i.notes || '—'}</span>,
    },
    {
      key: 'recordedBy',
      label: 'Recorded By',
      width: 'minmax(120px, 1fr)',
      render: (i) => (
        <span className="truncate text-sm font-semibold text-gray-500">
          {userName(i.recordedBy)}
        </span>
      ),
    },
    {
      key: 'total',
      label: 'Amount',
      width: '140px',
      className: 'text-right pr-4',
      render: (i) => money(i.total),
    },
  ];

  const paymentColumns: Column<PurchaseOrderPayment>[] = [
    {
      key: 'date',
      label: 'Date',
      width: '110px',
      render: (p) => (
        <span className="text-sm font-semibold text-gray-500">{formatDate(p.date)}</span>
      ),
    },
    {
      key: 'method',
      label: 'Method',
      width: 'minmax(120px, 1fr)',
      render: (p) => (
        <span className="text-sm font-semibold text-gray-900">
          {PAYMENT_METHOD_LABEL[p.method]}
        </span>
      ),
    },
    {
      key: 'reference',
      label: 'Reference',
      width: 'minmax(120px, 1fr)',
      render: (p) => <span className="text-sm text-gray-600">{p.reference || '—'}</span>,
    },
    {
      key: 'notes',
      label: 'Notes',
      width: 'minmax(140px, 2fr)',
      render: (p) => <span className="truncate text-sm text-gray-600">{p.notes || '—'}</span>,
    },
    {
      key: 'recordedBy',
      label: 'Recorded By',
      width: 'minmax(120px, 1fr)',
      render: (p) => (
        <span className="truncate text-sm font-semibold text-gray-500">
          {userName(p.recordedBy)}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      width: '140px',
      className: 'text-right pr-4',
      render: (p) => money(p.amount),
    },
  ];

  return (
    <>
      <div className={`${pageHeader} shrink-0 flex flex-col gap-3`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={`${base}/purchase-orders`} className="hover:text-gray-700 transition-colors">
            Purchase Orders
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-700 font-medium font-mono">{order.reference}</span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900 font-mono">{order.reference}</h1>
            <Badge variant={variant} label={label} />
          </div>
          <div className="flex items-center gap-3">
            {canApprove && canApproveOrder(order) && (
              <>
                <Button
                  size="xs"
                  onClick={approve}
                  isLoading={isApproving}
                  loadingText="Approving..."
                >
                  Approve
                </Button>
                <Button size="xs" variant="outline" onClick={() => setRejectOpen(true)}>
                  Reject
                </Button>
              </>
            )}
            {canRecordInvoice(order) && (
              <Button size="xs" variant="outline" onClick={() => setInvoiceOpen(true)}>
                Record Invoice
              </Button>
            )}
            {canReceive(order) && (
              <Button size="xs" variant="outline" onClick={() => setReceiveOpen(true)}>
                Receive Items
              </Button>
            )}
            {canPay(order) && (
              <Button size="xs" onClick={() => setPayOpen(true)}>
                Make Payment
              </Button>
            )}
            {canCloseOrder(order) && (
              <Button size="xs" variant="outline" onClick={() => setCloseOpen(true)}>
                Close Order
              </Button>
            )}
            {canCancelOrder(order) && (
              <Button size="xs" variant="danger" onClick={() => setCancelOpen(true)}>
                Cancel Order
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className={`${pageContent} flex flex-col gap-6`}>
        <CollapsibleOverview title="Overview">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
            <DetailField
              label="Supplier"
              value={
                <Link
                  href={`${base}/suppliers-customers/${order.supplierId}`}
                  className="text-brand hover:underline"
                >
                  {order.supplierName}
                </Link>
              }
            />
            <DetailField label="Warehouse" value={warehouseName} />
            <DetailField label="Order Date" value={formatDate(order.date)} />
            <DetailField
              label="Expected Delivery"
              value={order.expectedDate ? formatDate(order.expectedDate) : '—'}
            />
            <DetailField label="Payment Terms" value={order.paymentTerms || '—'} />
            <DetailField
              label="Invoiced"
              value={formatInventoryValue(purchaseOrderInvoiced(order))}
            />
            <DetailField
              label="Payable So Far"
              value={formatInventoryValue(purchaseOrderAmountOwed(order))}
            />
            <DetailField label="Amount Paid" value={formatInventoryValue(order.amountPaid)} />
            <DetailField
              label="Balance Due"
              value={formatInventoryValue(purchaseOrderBalance(order))}
            />
            {extraUnits > 0 && (
              <DetailField label="Free Extra Units" value={formatNumber(extraUnits)} />
            )}
            <DetailField label="Created By" value={userName(order.createdBy)} />
            {order.status === 'REJECTED' ? (
              <>
                <DetailField label="Rejected By" value={userName(order.rejectedBy)} />
                <DetailField label="Reason" value={order.rejectionReason || '—'} />
              </>
            ) : (
              <DetailField
                label="Approved By"
                value={
                  order.status === 'PENDING_APPROVAL'
                    ? 'Awaiting approval'
                    : userName(order.approvedBy)
                }
              />
            )}
            <DetailField label="Notes" value={order.notes || '—'} />
          </div>
        </CollapsibleOverview>

        <PurchaseOrderTimeline order={order} receipts={receipts} />

        <div className="flex flex-col gap-2">
          <TabBar
            tabs={[
              { key: 'items', label: 'Items' },
              { key: 'invoices', label: 'Invoices' },
              { key: 'receipts', label: 'Receipts' },
              { key: 'payments', label: 'Payments' },
            ]}
            activeTab={tab}
            onTabChange={setTab}
            className="px-0 [--tab-first-pl:0px]"
          />
          {tab === 'invoices' ? (
            <DataTable
              columns={invoiceColumns}
              data={order.invoices}
              emptyMessage="No invoices recorded on this order"
              currentPage={1}
              totalPages={0}
              onPageChange={() => {}}
              noInternalScroll
            />
          ) : tab === 'receipts' ? (
            <StockMovementsTable movements={receipts} showVariant showRecordedBy />
          ) : tab === 'payments' ? (
            <DataTable
              columns={paymentColumns}
              data={order.payments}
              emptyMessage="No payments made on this order"
              currentPage={1}
              totalPages={0}
              onPageChange={() => {}}
              noInternalScroll
            />
          ) : (
            <DataTable
              columns={lineColumns}
              data={order.lines}
              emptyMessage="No items on this order"
              currentPage={1}
              totalPages={0}
              onPageChange={() => {}}
              noInternalScroll
            />
          )}
        </div>
      </div>

      <SupplierPaymentPanel
        key={`pay-${order.id}-${payOpen}`}
        isOpen={payOpen}
        onClose={() => setPayOpen(false)}
        supplierId={order.supplierId}
        supplierName={order.supplierName}
        orders={[order]}
        initialSelectedIds={[order.id]}
        layout="popup"
      />
      <RecordInvoicePanel
        key={`invoice-${order.id}-${invoiceOpen}`}
        order={invoiceOpen ? order : null}
        onClose={() => setInvoiceOpen(false)}
      />
      <ReceivePurchaseOrderPanel
        key={`receive-${order.id}-${receiveOpen}`}
        order={receiveOpen ? order : null}
        onClose={() => setReceiveOpen(false)}
      />
      <ClosePurchaseOrderModal
        order={closeOpen ? order : null}
        onClose={() => setCloseOpen(false)}
      />
      <RejectPurchaseOrderModal
        order={rejectOpen ? order : null}
        onClose={() => setRejectOpen(false)}
      />
      <CancelPurchaseOrderModal
        order={cancelOpen ? order : null}
        onClose={() => setCancelOpen(false)}
      />
    </>
  );
}
