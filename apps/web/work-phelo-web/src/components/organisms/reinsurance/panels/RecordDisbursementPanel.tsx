'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { NumberField } from '@/components/atoms/NumberField';
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
  const [amount, setAmount] = useState(0);

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

  const totalOutstanding = useMemo(
    () => sources.reduce((sum, source) => sum + source.outstanding, 0),
    [sources],
  );

  const cedantObligation = financialPosition?.cedant.currentObligation ?? 0;
  const cedantCollected = financialPosition?.cedant.netSettled ?? 0;
  const cedantCollectionRatio =
    cedantObligation > 0.0001 ? Math.min(1, cedantCollected / cedantObligation) : null;
  const suggestedAmount =
    target && cedantCollectionRatio != null && totalOutstanding > 0
      ? Math.max(
          0,
          Math.min(
            totalOutstanding,
            cedantCollectionRatio * target.currentEffectivePayable - target.netSettled,
          ),
        )
      : null;

  useEffect(() => {
    if (!target) return;
    const prefill = suggestedAmount ?? totalOutstanding;
    setAmount(prefill > 0 ? Math.round(prefill * 100) / 100 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, totalOutstanding]);

  const amountError =
    totalOutstanding <= 0
      ? null
      : amount <= 0
        ? 'Enter an amount greater than zero.'
        : amount > totalOutstanding + 0.0001
          ? 'Amount cannot exceed the outstanding balance.'
          : null;

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
    if (amountError || amount <= 0) return;

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();

      let remaining = amount;
      for (const source of sources) {
        if (remaining <= 0.0001) break;
        const portion = Math.min(source.outstanding, remaining);
        if (portion <= 0.0001) continue;

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
          amount: portion,
          currency: source.currency,
          settlementMethod: 'BANK_TRANSFER',
          settlementCurrency: source.currency,
          paymentDate: now,
          reference,
          notes: 'Bank transfer',
        });

        remaining -= portion;

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
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || !!amountError || amount <= 0}
          >
            {isSubmitting ? 'Recording…' : 'Confirm'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          Disburse to <span className="font-semibold text-gray-900">{target.counterpartyName}</span>
          , payable balance{' '}
          <span className="font-semibold text-gray-900">{fmt(amount, currency)}</span>, outstanding
          balance{' '}
          <span className="font-semibold text-gray-900">{fmt(target.outstanding, currency)}</span>.
        </p>

        <NumberField
          label={`Amount (${currency})`}
          value={amount}
          onChange={setAmount}
          error={amountError ?? undefined}
          disabled={isSubmitting}
          placeholder="0.00"
        />
      </div>
    </Modal>
  );
}
