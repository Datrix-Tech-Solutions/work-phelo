'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CancelPurchaseOrderModal } from '@/components/organisms/inventory/CancelPurchaseOrderModal';
import { ClosePurchaseOrderModal } from '@/components/organisms/inventory/ClosePurchaseOrderModal';
import { PurchaseOrdersTable } from '@/components/organisms/inventory/PurchaseOrdersTable';
import { ReceivePurchaseOrderPanel } from '@/components/organisms/inventory/ReceivePurchaseOrderPanel';
import type { PurchaseOrder } from '@/hooks/inventory/usePurchaseOrders';

interface PurchaseOrdersManagerProps {
  /** The orders to list; the Purchase Orders page passes all of them, a supplier's page its own. */
  purchaseOrders: PurchaseOrder[];
  isLoading?: boolean;
  actionButton?: { label: string; onClick: () => void };
  hideSupplier?: boolean;
}

/**
 * A purchase orders table with its Receive Items form and Cancel Order confirmation. Selecting a
 * row opens that order's details page.
 */
export function PurchaseOrdersManager({
  purchaseOrders,
  isLoading,
  actionButton,
  hideSupplier,
}: PurchaseOrdersManagerProps) {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [receiveId, setReceiveId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PurchaseOrder | null>(null);
  const [closeTarget, setCloseTarget] = useState<PurchaseOrder | null>(null);
  const receiveTarget = purchaseOrders.find((o) => o.id === receiveId) ?? null;

  return (
    <>
      <PurchaseOrdersTable
        purchaseOrders={purchaseOrders}
        isLoading={isLoading}
        actionButton={actionButton}
        hideSupplier={hideSupplier}
        onReceive={(o) => setReceiveId(o.id)}
        onCancel={setCancelTarget}
        onCloseOrder={setCloseTarget}
        onRowClick={(o) =>
          router.push(`/${tenantSlug}/operations/inventory/purchase-orders/${o.id}`)
        }
      />
      <ReceivePurchaseOrderPanel
        key={`receive-${receiveTarget?.id ?? 'none'}`}
        order={receiveTarget}
        onClose={() => setReceiveId(null)}
      />
      <ClosePurchaseOrderModal order={closeTarget} onClose={() => setCloseTarget(null)} />
      <CancelPurchaseOrderModal order={cancelTarget} onClose={() => setCancelTarget(null)} />
    </>
  );
}
