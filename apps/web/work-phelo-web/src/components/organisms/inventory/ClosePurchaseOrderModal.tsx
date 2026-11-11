'use client';

import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { usePurchaseOrders, type PurchaseOrder } from '@/hooks/inventory/usePurchaseOrders';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface ClosePurchaseOrderModalProps {
  /** The order to close; null while closed. */
  order: PurchaseOrder | null;
  onClose: () => void;
}

/** Confirms, then closes, a part-delivered order. What was received stays in stock and owed. */
export function ClosePurchaseOrderModal({ order, onClose }: ClosePurchaseOrderModalProps) {
  const toast = useToast();
  const { closePurchaseOrder, isClosing } = usePurchaseOrders();

  const confirm = async () => {
    if (!order) return;
    try {
      await closePurchaseOrder(order.id);
      toast.success('Purchase order closed');
      onClose();
    } catch (err) {
      toast.error(extractError(err, 'Could not close the order'));
    }
  };

  return (
    <Modal
      isOpen={order !== null}
      onClose={onClose}
      title="Close Purchase Order"
      description={`Close ${order?.reference ?? 'this order'}? The items already received stay in stock and are still owed to the supplier, but the rest of the order will no longer be expected. This cannot be undone.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Keep Open
          </Button>
          <Button isLoading={isClosing} loadingText="Closing..." onClick={confirm}>
            Close Order
          </Button>
        </div>
      }
    />
  );
}
