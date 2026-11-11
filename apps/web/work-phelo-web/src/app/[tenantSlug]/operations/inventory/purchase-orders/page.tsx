'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { OrderPanel } from '@/components/organisms/inventory/OrderPanel';
import { PurchaseOrdersTable } from '@/components/organisms/inventory/PurchaseOrdersTable';
import { ReceivePurchaseOrderPanel } from '@/components/organisms/inventory/ReceivePurchaseOrderPanel';
import { usePurchaseOrders, type PurchaseOrder } from '@/hooks/inventory/usePurchaseOrders';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { pageContent, pageHeader } from '@/lib/layout';

export default function PurchaseOrdersPage() {
  const toast = useToast();
  const { purchaseOrders, isLoading, cancelPurchaseOrder, isCancelling } = usePurchaseOrders();
  const [formOpen, setFormOpen] = useState(false);
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
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-semibold text-gray-900">Purchase Orders</h1>
      </div>

      <div className={`${pageContent} flex flex-col`}>
        <PurchaseOrdersTable
          purchaseOrders={purchaseOrders}
          isLoading={isLoading}
          actionButton={{ label: 'New Purchase Order', onClick: () => setFormOpen(true) }}
          onReceive={(o) => setReceiveId(o.id)}
          onCancel={setCancelTarget}
        />
      </div>

      <OrderPanel kind="PURCHASE" isOpen={formOpen} onClose={() => setFormOpen(false)} />
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
