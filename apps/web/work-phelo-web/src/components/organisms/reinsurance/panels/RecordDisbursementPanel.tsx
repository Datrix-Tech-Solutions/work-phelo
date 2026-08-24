'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import {
  useCreatePlacementPayment,
  useConfirmPlacementPaymentBank,
  usePlacementClosings,
  usePlacementPayments,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import {
  Facultative,
  PlacementFinancialPosition,
  PlacementReinsurerFinancialPosition,
} from '@/types/reinsurance';

function fmt(val: number, currency: string | null) {
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseMoney(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

type DisbursementSource = {
  closingId?: string;
  endorsementClosingId?: string;
  participantId?: string;
  outstanding: number;
  currency: string;
};

interface RecordDisbursementPanelProps {
  placement: Facultative;
  financialPosition?: PlacementFinancialPosition | null;
  target: PlacementReinsurerFinancialPosition | null;
  onClose: () => void;
}

/** Confirms the full outstanding shown for a reinsurer in `ReinsurersPaymentTable` — no manual
 * amount/method/date entry. Behind the scenes it still settles each outstanding source (the
 * original placement closing and any endorsement adjustments) with its own payment record, so
 * the reinsurer's share stays traceable per closing even though the user only sees one number. */
export function RecordDisbursementPanel({
  placement,
  financialPosition,
  target,
  onClose,
}: RecordDisbursementPanelProps) {
  const createPayment = useCreatePlacementPayment();
  const confirmPaymentBank = useConfirmPlacementPaymentBank();
  const addToast = useToastStore((s) => s.addToast);
  const { data: closings = [] } = usePlacementClosings(placement.id);
  const { data: payments = [] } = usePlacementPayments(placement.id);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sources = useMemo<DisbursementSource[]>(() => {
    if (!target) return [];
    const originalSources = closings
      .filter(
        (closing) =>
          closing.status === 'CONFIRMED' &&
          closing.participant.counterpartyId === target.counterpartyId,
      )
      .map((closing) => {
        const paid = payments
          .filter(
            (payment) =>
              payment.type === 'REINSURER_DISBURSEMENT' &&
              (payment.status === 'RECORDED' || payment.status === 'BANK_CONFIRMED') &&
              !payment.reversalOfPaymentId &&
              payment.closingId === closing.id,
          )
          .reduce((sum, payment) => sum + parseMoney(payment.amount), 0);
        const amount = parseMoney(closing.netPremium);
        return {
          closingId: closing.id,
          participantId: closing.participantId,
          outstanding: Math.max(0, amount - paid),
          currency: closing.currency ?? financialPosition?.currency ?? placement.currency ?? '',
        };
      });

    const endorsementSources =
      target.adjustments
        ?.filter((adjustment) => adjustment.amount > 0)
        .map((adjustment) => {
          const paid = payments
            .filter(
              (payment) =>
                payment.type === 'REINSURER_DISBURSEMENT' &&
                (payment.status === 'RECORDED' || payment.status === 'BANK_CONFIRMED') &&
                !payment.reversalOfPaymentId &&
                payment.endorsementClosingId === adjustment.closingId,
            )
            .reduce((sum, payment) => sum + parseMoney(payment.amount), 0);
          return {
            endorsementClosingId: adjustment.closingId,
            outstanding: Math.max(0, adjustment.amount - paid),
            currency: adjustment.currency,
          };
        }) ?? [];

    return [...originalSources, ...endorsementSources].filter(
      (source) => source.outstanding > 0.0001,
    );
  }, [closings, financialPosition?.currency, target, payments, placement.currency]);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleConfirm = async () => {
    if (!target) return;
    if (sources.length === 0) {
      addToast({
        message: 'No confirmed closing found to settle this outstanding amount against.',
        type: 'error',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      for (const source of sources) {
        // A closing/endorsement number to record as the payment's reference — the confirm
        // step below needs *some* reference on a BANK_TRANSFER payment, and this doubles as a
        // meaningful audit trail in Payment History instead of a placeholder value.
        const reference = source.closingId
          ? `Closing ${closings.find((c) => c.id === source.closingId)?.closingNumber ?? source.closingId}`
          : source.endorsementClosingId
            ? `Endorsement ${
                target.adjustments?.find((a) => a.closingId === source.endorsementClosingId)
                  ?.endorsementNumber ?? source.endorsementClosingId
              }`
            : undefined;

        const created = await createPayment.mutateAsync({
          placementId: placement.id,
          type: 'REINSURER_DISBURSEMENT',
          direction: 'OUTBOUND',
          counterpartyId: target.counterpartyId,
          closingId: source.closingId,
          endorsementClosingId: source.endorsementClosingId,
          participantId: source.participantId,
          amount: source.outstanding,
          currency: source.currency,
          settlementMethod: 'BANK_TRANSFER',
          settlementCurrency: source.currency,
          paymentDate: now,
          reference,
          // Same wording Payment History already uses for a bank-transfer premium receipt —
          // reads consistently across both payment types instead of a one-off description.
          notes: 'Bank transfer',
        });

        // Confirm right after recording — the settlement method/currency/reference above
        // already cover everything the confirm endpoint needs, so this needs no further
        // input and no separate trip through Accounting's confirmation queue.
        try {
          await confirmPaymentBank.mutateAsync({
            placementId: placement.id,
            paymentId: created.id,
            bankConfirmedAt: now,
          });
        } catch (confirmError) {
          addToast({
            message: `Disbursement recorded, but bank confirmation failed automatically: ${extractError(confirmError)}. It will remain pending until confirmed.`,
            type: 'error',
          });
        }
      }
      addToast({ message: 'Reinsurer disbursement recorded successfully', type: 'success' });
      onClose();
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!target) return null;

  const currency = financialPosition?.currency ?? placement.currency;

  return (
    <Modal
      isOpen={!!target}
      onClose={handleClose}
      title="Confirm Reinsurer Disbursement"
      footer={
        <>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Recording…' : 'Confirm'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-700 leading-relaxed">
        Disburse{' '}
        <span className="font-semibold text-gray-900">{fmt(target.outstanding, currency)}</span> to{' '}
        <span className="font-semibold text-gray-900">{target.counterpartyName}</span>?
      </p>
    </Modal>
  );
}
