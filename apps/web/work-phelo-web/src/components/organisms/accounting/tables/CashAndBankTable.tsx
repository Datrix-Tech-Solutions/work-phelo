'use client';

import { useMemo } from 'react';
import { FinancialConfirmationQueue } from '@/components/organisms/accounting/tables/FinancialConfirmationQueue';
import {
  useConfirmClaimCedantSettlementBankPayment,
  useConfirmClaimRecoveryReceiptBankPayment,
  useConfirmReinsurerDisbursementBankPayment,
  useReinsuranceBankConfirmationWorkItems,
} from '@/hooks/accounting/useReinsuranceBankConfirmations';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import type {
  AccountingBankConfirmationWorkItem,
  ConfirmBankPaymentPayload,
} from '@/types/accountingIntegration';

export function CashAndBankTable() {
  const addToast = useToastStore((state) => state.addToast);
  const reinsuranceQueue = useReinsuranceBankConfirmationWorkItems();
  const confirmReinsurancePayment = useConfirmReinsurerDisbursementBankPayment();
  const confirmClaimRecoveryReceipt = useConfirmClaimRecoveryReceiptBankPayment();
  const confirmClaimCedantSettlement = useConfirmClaimCedantSettlementBankPayment();

  const queueItems = useMemo(() => reinsuranceQueue.data ?? [], [reinsuranceQueue.data]);
  const isConfirming =
    confirmReinsurancePayment.isPending ||
    confirmClaimRecoveryReceipt.isPending ||
    confirmClaimCedantSettlement.isPending;

  const confirmWorkItem = async (
    item: AccountingBankConfirmationWorkItem,
    payload: ConfirmBankPaymentPayload,
  ) => {
    try {
      if (item.sourceModule !== 'REINSURANCE') {
        throw new Error(`${item.sourceModule} confirmation is not supported yet.`);
      }

      if (item.sourceRecordType === 'PlacementClaimRecoveryReceipt') {
        const claimId = String(item.businessSnapshot?.claimId ?? item.metadata?.claimId ?? '');
        if (!claimId) throw new Error('Claim recovery receipt is missing its claim reference.');
        await confirmClaimRecoveryReceipt.mutateAsync({
          placementId: item.sourceParentId,
          claimId,
          receiptId: item.sourceRecordId,
          ...payload,
        });
      } else if (item.sourceRecordType === 'PlacementClaimCedantSettlement') {
        const claimId = String(item.businessSnapshot?.claimId ?? item.metadata?.claimId ?? '');
        if (!claimId) throw new Error('Cedant settlement is missing its claim reference.');
        await confirmClaimCedantSettlement.mutateAsync({
          placementId: item.sourceParentId,
          claimId,
          settlementId: item.sourceRecordId,
          ...payload,
        });
      } else {
        await confirmReinsurancePayment.mutateAsync({
          placementId: item.sourceParentId,
          paymentId: item.sourceRecordId,
          ...payload,
        });
      }

      addToast({
        type: 'success',
        message:
          item.direction === 'INBOUND'
            ? 'Receipt financially confirmed and sent to Accounting.'
            : 'Payment financially confirmed and sent to Accounting.',
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: extractError(error, 'Unable to confirm bank payment'),
      });
      throw error;
    }
  };

  return (
    <FinancialConfirmationQueue
      items={queueItems}
      isLoading={reinsuranceQueue.isLoading}
      isError={reinsuranceQueue.isError}
      isConfirming={isConfirming}
      onConfirm={confirmWorkItem}
    />
  );
}
