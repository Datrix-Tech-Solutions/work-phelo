'use client';

import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { usePurchaseOrders, type PurchaseOrder } from '@/hooks/inventory/usePurchaseOrders';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface CancelPurchaseOrderModalProps {
  /** The order to cancel; null while closed. */
  order: PurchaseOrder | null;
  onClose: () => void;
  /** Called after the order has been cancelled. */
  onCancelled?: () => void;
}

/** Confirms, then cancels, a purchase order nothing has been received on. */
export function CancelPurchaseOrderModal({
  order,
  onClose,
  onCancelled,
}: CancelPurchaseOrderModalProps) {
  const toast = useToast();
  const { cancelPurchaseOrder, isCancelling } = usePurchaseOrders();

  const confirm = async () => {
    if (!order) return;
    try {
      await cancelPurchaseOrder(order.id);
      toast.success('Purchase order cancelled');
      onClose();
      onCancelled?.();
    } catch (err) {
      toast.error(extractError(err, 'Could not cancel the order'));
    }
  };

  return (
    <Modal
      isOpen={order !== null}
      onClose={onClose}
      title="Cancel Purchase Order"
      description={`Cancel ${order?.reference ?? 'this order'}? Nothing has been received or paid on it, so stock is not affected. Any invoices recorded on it are voided and nothing is owed. This cannot be undone.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Keep Order
          </Button>
          <Button
            variant="danger"
            isLoading={isCancelling}
            loadingText="Cancelling..."
            onClick={confirm}
          >
            Cancel Order
          </Button>
        </div>
      }
    />
  );
}
