'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { PurchaseOrdersTable } from '@/components/organisms/inventory/PurchaseOrdersTable';
import { ReceivePurchaseOrderPanel } from '@/components/organisms/inventory/ReceivePurchaseOrderPanel';
import { usePurchaseOrders, type PurchaseOrder } from '@/hooks/inventory/usePurchaseOrders';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface PurchaseOrdersManagerProps {
  /** The orders to list; the Purchase Orders page passes all of them, a supplier's page its own. */
  purchaseOrders: PurchaseOrder[];
  isLoading?: boolean;
  actionButton?: { label: string; onClick: () => void };
  hideSupplier?: boolean;
}

/** A purchase orders table with its Receive Items form and Cancel Order confirmation. */
export function PurchaseOrdersManager({
  purchaseOrders,
  isLoading,
  actionButton,
  hideSupplier,
}: PurchaseOrdersManagerProps) {
  const toast = useToast();
  const { cancelPurchaseOrder, isCancelling } = usePurchaseOrders();
  const [receiveId, setReceiveId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PurchaseOrder | null>(null);
  const receiveTarget = purchaseOrders.find((o) => o.id === receiveId) ?? null;

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelPurchaseOrder(cancelTarget.id);
      toast.success('Purchase order cancelled');
      setCancelTarget(null);
    } catch (err) {
      toast.error(extractError(err, 'Could not cancel the order'));
    }
  };

  return (
    <>
      <PurchaseOrdersTable
        purchaseOrders={purchaseOrders}
        isLoading={isLoading}
        actionButton={actionButton}
        hideSupplier={hideSupplier}
        onReceive={(o) => setReceiveId(o.id)}
        onCancel={setCancelTarget}
      />
      <ReceivePurchaseOrderPanel
        key={`receive-${receiveTarget?.id ?? 'none'}`}
        order={receiveTarget}
        onClose={() => setReceiveId(null)}
      />
      <Modal
        isOpen={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Cancel Purchase Order"
        description={`Cancel ${cancelTarget?.reference ?? 'this order'}? Nothing has been received on it, so stock is not affected. This cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Keep Order
            </Button>
            <Button
              variant="danger"
              isLoading={isCancelling}
              loadingText="Cancelling..."
              onClick={confirmCancel}
            >
              Cancel Order
            </Button>
          </div>
        }
      />
    </>
  );
}
