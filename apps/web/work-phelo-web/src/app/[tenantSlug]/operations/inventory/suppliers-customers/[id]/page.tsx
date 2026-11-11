'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DetailField } from '@/components/atoms/DetailField';
import { TypeChip } from '@/components/atoms/TypeChip';
import { DeleteInventoryRecordModal } from '@/components/organisms/inventory/DeleteInventoryRecordModal';
import { OrderPanel } from '@/components/organisms/inventory/OrderPanel';
import { PartyModal } from '@/components/organisms/inventory/PartyModal';
import { PurchaseOrdersManager } from '@/components/organisms/inventory/PurchaseOrdersManager';
import { SupplierPaymentPanel } from '@/components/organisms/inventory/SupplierPaymentPanel';
import { SupplierOrderStats } from '@/components/organisms/inventory/SupplierOrderStats';
import { StockMovementsTable } from '@/components/organisms/inventory/StockMovementsTable';
import { useInventoryParties, type PartyKind } from '@/hooks/inventory/useInventoryParties';
import { canPay, usePurchaseOrders } from '@/hooks/inventory/usePurchaseOrders';
import { useStockMovements } from '@/hooks/inventory/useStockMovements';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { pageContent, pageHeader } from '@/lib/layout';

const NOUN: Record<PartyKind, string> = { SUPPLIER: 'Supplier', CUSTOMER: 'Customer' };

export default function InventoryPartyDetailsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const base = `/${tenantSlug}/operations/inventory/suppliers-customers`;
  const router = useRouter();
  const toast = useToast();

  const suppliers = useInventoryParties('SUPPLIER');
  const customers = useInventoryParties('CUSTOMER');
  const { movements } = useStockMovements();
  const { purchaseOrders, isLoading: ordersLoading } = usePurchaseOrders();
  const [tab, setTab] = useState('orders');
  const [orderOpen, setOrderOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const party = [...suppliers.parties, ...customers.parties].find((p) => p.id === id);
  const isLoading = suppliers.isLoading || customers.isLoading;
  const kind = party?.kind ?? 'SUPPLIER';
  const noun = NOUN[kind];

  // Stock movements name a supplier (stock in) or a recipient (stock out) by name, so those are
  // matched on the name: what was received from a supplier, or issued to a customer.
  const partyMovements = useMemo(() => {
    if (!party) return [];
    const name = party.name.trim().toLowerCase();
    const type = party.kind === 'SUPPLIER' ? 'STOCK_IN' : 'STOCK_OUT';
    return movements.filter((m) => m.type === type && m.source?.trim().toLowerCase() === name);
  }, [movements, party]);

  const supplierOrders = useMemo(
    () => purchaseOrders.filter((o) => o.supplierId === id),
    [purchaseOrders, id],
  );

  if (!isLoading && !party) {
    return (
      <div className={`${pageHeader} flex flex-col gap-3 text-sm text-gray-500`}>
        <span>Supplier or customer not found.</span>
        <Link href={base} className="text-brand hover:underline w-fit">
          Back to suppliers &amp; customers
        </Link>
      </div>
    );
  }

  if (!party) {
    return (
      <div className={`${pageHeader} flex flex-col gap-6`}>
        <div className="h-5 w-64 bg-gray-100 rounded animate-pulse" />
        <div className="h-24 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  const handleDelete = async () => {
    try {
      await (kind === 'SUPPLIER' ? suppliers : customers).deleteParty(party.id);
    } catch (err) {
      toast.error(extractError(err, `Could not delete ${noun.toLowerCase()}`));
      return;
    }
    toast.success(`${noun} deleted successfully`);
    router.push(`${base}?tab=${kind}`);
  };

  return (
    <>
      <div className={`${pageHeader} shrink-0 flex flex-col gap-3`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={`${base}?tab=${kind}`} className="hover:text-gray-700 transition-colors">
            Suppliers &amp; Customers
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-700 font-medium">{party.name}</span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{party.name}</h1>
          <div className="flex items-center gap-3">
            <Button size="xs" variant="outline" onClick={() => setOrderOpen(true)}>
              {kind === 'SUPPLIER' ? 'Make Purchase Order' : 'Make Sales Order'}
            </Button>
            {kind === 'SUPPLIER' && (
              <Button
                size="xs"
                variant="outline"
                disabled={!supplierOrders.some(canPay)}
                title={supplierOrders.some(canPay) ? undefined : 'Nothing is owed on any order yet'}
                onClick={() => setPayOpen(true)}
              >
                Make Payment
              </Button>
            )}
            <Button size="xs" variant="outline" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button size="xs" variant="danger" onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className={`${pageContent} flex flex-col gap-6`}>
        <CollapsibleOverview
          title="Overview"
          headerExtra={
            <TypeChip
              label={party.status === 'ACTIVE' ? 'Active' : 'Inactive'}
              color={party.status === 'ACTIVE' ? 'green' : 'gray'}
            />
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
            <DetailField label={`${noun} Name`} value={party.name} />
            <DetailField label="Type" value={noun} />
            <DetailField label="Contact Person" value={party.contactPerson || '—'} />
            <DetailField label="Phone" value={party.phone || '—'} />
            <DetailField label="Email" value={party.email || '—'} />
            <DetailField label="Address" value={party.address || '—'} />
            <DetailField
              label={kind === 'SUPPLIER' ? 'Receipts' : 'Issues'}
              value={partyMovements.length}
            />
          </div>
        </CollapsibleOverview>

        {kind === 'SUPPLIER' ? (
          <>
            <SupplierOrderStats orders={supplierOrders} isLoading={ordersLoading} />
            <div className="flex flex-col gap-2">
              <TabBar
                tabs={[
                  { key: 'orders', label: 'Purchase Orders' },
                  { key: 'received', label: 'Stock Received' },
                ]}
                activeTab={tab}
                onTabChange={setTab}
                className="px-0 [--tab-first-pl:0px]"
              />
              {tab === 'received' ? (
                <StockMovementsTable movements={partyMovements} showVariant />
              ) : (
                <PurchaseOrdersManager
                  purchaseOrders={supplierOrders}
                  isLoading={ordersLoading}
                  hideSupplier
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-semibold text-gray-900">Stock Issued</h3>
            <StockMovementsTable movements={partyMovements} showVariant />
          </div>
        )}
      </div>

      <OrderPanel
        kind={kind === 'SUPPLIER' ? 'PURCHASE' : 'SALES'}
        isOpen={orderOpen}
        onClose={() => setOrderOpen(false)}
        partyName={party.name}
        partyId={party.id}
      />
      {kind === 'SUPPLIER' && (
        <SupplierPaymentPanel
          key={`pay-${payOpen}`}
          isOpen={payOpen}
          onClose={() => setPayOpen(false)}
          supplierId={party.id}
          supplierName={party.name}
          orders={supplierOrders}
        />
      )}
      <PartyModal
        kind={kind}
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        party={editOpen ? party : null}
      />
      <DeleteInventoryRecordModal
        kind={noun}
        name={deleteOpen ? party.name : null}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
