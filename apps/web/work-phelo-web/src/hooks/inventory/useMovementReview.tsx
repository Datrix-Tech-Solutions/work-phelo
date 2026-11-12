'use client';

import { useState } from 'react';
import { RejectModal } from '@/components/organisms/inventory/RejectModal';
import { useCanApprove } from '@/hooks/inventory/useApprovalAccess';
import { useMovementApproval, type StockMovement } from '@/hooks/inventory/useStockMovements';
import { extractError } from '@/lib/extractError';
import { useToast } from '@/hooks/useToast';

/** A movement waiting for approval can be approved or rejected. */
export const isAwaitingApproval = (m: StockMovement) => m.status === 'PENDING';

/**
 * Approve and reject for movements waiting for approval, shared by the table and details page.
 * Render `modals` once alongside whatever triggers these.
 */
export function useMovementReview({ onDone }: { onDone?: () => void } = {}) {
  const toast = useToast();
  const canApproveIn = useCanApprove('STOCK_IN');
  const canApproveOut = useCanApprove('STOCK_OUT');
  const canApproveTransfer = useCanApprove('TRANSFER');
  const canApproveAdjustment = useCanApprove('ADJUSTMENT');
  const { approveMovement, rejectMovement, isApproving, isRejecting } = useMovementApproval();
  const [rejectTarget, setRejectTarget] = useState<StockMovement | null>(null);

  const canReview = (m: StockMovement) =>
    isAwaitingApproval(m) &&
    {
      STOCK_IN: canApproveIn,
      STOCK_OUT: canApproveOut,
      TRANSFER: canApproveTransfer,
      ADJUSTMENT: canApproveAdjustment,
    }[m.type];

  const approve = async (m: StockMovement) => {
    try {
      await approveMovement(m.id);
      toast.success('Approved. Stock has been updated.');
      onDone?.();
    } catch (err) {
      toast.error(extractError(err, 'Could not approve it'));
    }
  };

  const confirmReject = async (reason: string) => {
    if (!rejectTarget) return;
    try {
      await rejectMovement(rejectTarget.id, reason);
      toast.success('Rejected');
      setRejectTarget(null);
    } catch (err) {
      toast.error(extractError(err, 'Could not reject it'));
    }
  };

  const modals = (
    <RejectModal
      isOpen={rejectTarget !== null}
      title="Reject Movement"
      description={`Reject ${rejectTarget?.reference ?? 'this movement'}? Stock is not changed.`}
      isLoading={isRejecting}
      onClose={() => setRejectTarget(null)}
      onConfirm={confirmReject}
    />
  );

  return { canReview, approve, isApproving, requestReject: setRejectTarget, modals };
}
