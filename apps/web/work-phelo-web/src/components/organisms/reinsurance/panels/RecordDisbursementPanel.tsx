'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import {
  RecordDisbursementFormFields,
  RECORD_DISBURSEMENT_DEFAULTS,
  DisbursementFormValues,
  SettlementSource,
} from '@/components/molecules/reinsurance/forms/RecordDisbursementFormFields';
import { useCreatePlacementPayment, usePlacementClosings, usePlacementPayments } from '@/hooks';
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
  const addToast = useToastStore((s) => s.addToast);
  const { data: closings = [] } = usePlacementClosings(placement.id);
  const { data: payments = [] } = usePlacementPayments(placement.id);

  const form = useForm<DisbursementFormValues>({ defaultValues: RECORD_DISBURSEMENT_DEFAULTS });

  const sources = useMemo<SettlementSource[]>(() => {
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
          value: `placement:${closing.id}`,
          label: `Original Placement · ${closing.closingNumber}`,
          sublabel: `${fmt(Math.max(0, amount - paid), closing.currency)} outstanding`,
          closingId: closing.id,
          participantId: closing.participantId,
          amount,
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
            value: `endorsement:${adjustment.closingId}`,
            label: `Endorsement ${adjustment.endorsementNumber ?? 'Adjustment'}`,
            sublabel: `${fmt(Math.max(0, adjustment.amount - paid), adjustment.currency)} outstanding`,
            endorsementClosingId: adjustment.closingId,
            amount: adjustment.amount,
            outstanding: Math.max(0, adjustment.amount - paid),
            currency: adjustment.currency,
          };
        }) ?? [];

    return [...originalSources, ...endorsementSources].filter(
      (source) => source.outstanding > 0.0001,
    );
  }, [closings, financialPosition?.currency, target, payments, placement.currency]);

  useEffect(() => {
    if (!target) return;
    const firstSource = sources[0];
    form.reset({
      sourceId: firstSource?.value ?? '',
      settlementMethod: 'BANK_TRANSFER',
      amount: firstSource ? String(Math.min(target.outstanding, firstSource.outstanding)) : '',
      paymentDate: new Date().toISOString(),
      reference: '',
      notes: 'Operational reinsurer disbursement',
    });
  }, [form, target, sources]);

  const handleClose = () => {
    onClose();
    form.reset(RECORD_DISBURSEMENT_DEFAULTS);
  };

  const submitDisbursement = form.handleSubmit(async (values) => {
    if (!target) return;
    const source = sources.find((item) => item.value === values.sourceId);
    if (!source) {
      addToast({
        message: 'Select a confirmed closing source before recording payment.',
        type: 'error',
      });
      return;
    }
    try {
      await createPayment.mutateAsync({
        placementId: placement.id,
        type: 'REINSURER_DISBURSEMENT',
        direction: 'OUTBOUND',
        counterpartyId: target.counterpartyId,
        closingId: source.closingId,
        endorsementClosingId: source.endorsementClosingId,
        participantId: source.participantId,
        amount: parseMoney(values.amount),
        currency: source.currency,
        settlementMethod: values.settlementMethod,
        settlementCurrency: source.currency,
        paymentDate: new Date(values.paymentDate).toISOString(),
        reference: values.reference || undefined,
        notes: values.notes || undefined,
      });
      addToast({ message: 'Reinsurer disbursement recorded successfully', type: 'success' });
      handleClose();
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  });

  return (
    <SidePanel
      isOpen={!!target}
      onClose={handleClose}
      title="Record Reinsurer Disbursement"
      description="Record the operational payment made to the Reinsurer. Accounting will confirm the bank transaction separately."
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="record-disbursement-form" disabled={createPayment.isPending}>
            {createPayment.isPending ? 'Saving…' : 'Record Disbursement'}
          </Button>
        </div>
      }
    >
      <form
        id="record-disbursement-form"
        className="flex flex-col gap-4"
        onSubmit={submitDisbursement}
      >
        <RecordDisbursementFormFields form={form} sources={sources} />
      </form>
    </SidePanel>
  );
}
