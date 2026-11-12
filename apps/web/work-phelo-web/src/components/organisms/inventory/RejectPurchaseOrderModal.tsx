'use client';

import { RejectModal } from '@/components/organisms/inventory/RejectModal';
import { usePurchaseOrders, type PurchaseOrder } from '@/hooks/inventory/usePurchaseOrders';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface RejectPurchaseOrderModalProps {
  /** The order to reject; null while closed. */
  order: PurchaseOrder | null;
  onClose: () => void;
}

/** Rejects an order waiting for approval, keeping the reason with it. */
export function RejectPurchaseOrderModal({ order, onClose }: RejectPurchaseOrderModalProps) {
  const toast = useToast();
  const { rejectPurchaseOrder, isRejecting } = usePurchaseOrders();

  const confirm = async (reason: string) => {
    if (!order) return;
    try {
      await rejectPurchaseOrder(order.id, reason);
      toast.success('Purchase order rejected');
      onClose();
    } catch (err) {
      toast.error(extractError(err, 'Could not reject the order'));
    }
  };

  return (
    <RejectModal
      isOpen={order !== null}
      title="Reject Purchase Order"
      description={`Reject ${order?.reference ?? 'this order'}? Nothing can be received against it.`}
      isLoading={isRejecting}
      onClose={onClose}
      onConfirm={confirm}
    />
  );
}
