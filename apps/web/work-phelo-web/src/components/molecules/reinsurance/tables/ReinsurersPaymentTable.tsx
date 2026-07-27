'use client';

import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Facultative,
  PlacementFinancialPosition,
  PlacementReinsurerFinancialPosition,
} from '@/types/reinsurance';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { FormField } from '@/components/molecules/shared/FormField';
import { Modal } from '@/components/organisms/shared/Modal';
import { useCreatePlacementPayment, usePlacementPayments } from '@/hooks/reinsurance/usePayments';
import { usePlacementClosings } from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

interface ReinsurersPaymentTableProps {
  placement: Facultative;
  financialPosition?: PlacementFinancialPosition | null;
  paidAmount?: number;
  onTotalChange?: (total: number) => void;
}

type SettlementSource = {
  value: string;
  label: string;
  sublabel: string;
  closingId?: string;
  endorsementClosingId?: string;
  participantId?: string;
  amount: number;
  outstanding: number;
  currency: string;
};

type ReinsurerPositionRow = PlacementReinsurerFinancialPosition & {
  id: string;
};

type DisbursementFormValues = {
  sourceId: string;
  amount: string;
  paymentDate: string;
  reference: string;
  notes: string;
};

function fmt(val: number, currency: string | null) {
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseMoney(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function positionBadge(position: PlacementReinsurerFinancialPosition['position']) {
  if (position === 'SETTLED') return <Badge label="Settled" variant="success" />;
  if (position === 'CREDIT_BALANCE') return <Badge label="Credit" variant="warning" />;
  return <Badge label="Payable" variant="warning" />;
}

export function ReinsurersPaymentTable({
  placement,
  financialPosition,
  onTotalChange,
}: ReinsurersPaymentTableProps) {
  const [paymentTarget, setPaymentTarget] = useState<PlacementReinsurerFinancialPosition | null>(
    null,
  );
  const createPayment = useCreatePlacementPayment();
  const addToast = useToastStore((s) => s.addToast);
  const { data: closings = [] } = usePlacementClosings(placement.id);
  const { data: payments = [] } = usePlacementPayments(placement.id);

  const form = useForm<DisbursementFormValues>({
    defaultValues: {
      sourceId: '',
      amount: '',
      paymentDate: new Date().toISOString(),
      reference: '',
      notes: '',
    },
  });

  const rows = useMemo<ReinsurerPositionRow[]>(
    () =>
      financialPosition?.reinsurers.map((row) => ({
        ...row,
        id: row.counterpartyId,
      })) ?? [],
    [financialPosition?.reinsurers],
  );

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + row.currentEffectivePayable, 0),
    [rows],
  );

  useEffect(() => {
    onTotalChange?.(total);
  }, [total, onTotalChange]);

  const sources = useMemo<SettlementSource[]>(() => {
    if (!paymentTarget) return [];
    const originalSources = closings
      .filter(
        (closing) =>
          closing.status === 'CONFIRMED' &&
          closing.participant.counterpartyId === paymentTarget.counterpartyId,
      )
      .map((closing) => {
        const paid = payments
          .filter(
            (payment) =>
              payment.type === 'REINSURER_DISBURSEMENT' &&
              payment.status === 'RECORDED' &&
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
      paymentTarget.adjustments
        ?.filter((adjustment) => adjustment.amount > 0)
        .map((adjustment) => {
          const paid = payments
            .filter(
              (payment) =>
                payment.type === 'REINSURER_DISBURSEMENT' &&
                payment.status === 'RECORDED' &&
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
  }, [closings, financialPosition?.currency, paymentTarget, payments, placement.currency]);

  useEffect(() => {
    if (!paymentTarget) return;
    const firstSource = sources[0];
    form.reset({
      sourceId: firstSource?.value ?? '',
      amount: firstSource
        ? String(Math.min(paymentTarget.outstanding, firstSource.outstanding))
        : '',
      paymentDate: new Date().toISOString(),
      reference: '',
      notes: 'Reinsurer disbursement',
    });
  }, [form, paymentTarget, sources]);

  const closeModal = () => {
    setPaymentTarget(null);
    form.reset();
  };

  const submitDisbursement = form.handleSubmit(async (values) => {
    if (!paymentTarget) return;
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
        counterpartyId: paymentTarget.counterpartyId,
        closingId: source.closingId,
        endorsementClosingId: source.endorsementClosingId,
        participantId: source.participantId,
        amount: parseMoney(values.amount),
        currency: source.currency,
        paymentDate: new Date(values.paymentDate).toISOString(),
        reference: values.reference || undefined,
        notes: values.notes || undefined,
      });
      addToast({ message: 'Reinsurer payment recorded successfully', type: 'success' });
      closeModal();
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  });

  const columns: Column<ReinsurerPositionRow>[] = useMemo(
    () => [
      {
        key: 'counterpartyName',
        label: 'Reinsurer',
        render: (row) => <span className="font-medium text-gray-900">{row.counterpartyName}</span>,
      },
      {
        key: 'currentEffectivePayable',
        label: 'Current Payable',
        width: '150px',
        className: 'text-right',
        render: (row) => (
          <span className="text-gray-900 block text-right">
            {fmt(row.currentEffectivePayable, financialPosition?.currency ?? placement.currency)}
          </span>
        ),
      },
      {
        key: 'paid',
        label: 'Paid',
        width: '130px',
        className: 'text-right',
        render: (row) => (
          <span className="text-gray-700 block text-right">
            {fmt(row.netSettled, financialPosition?.currency ?? placement.currency)}
          </span>
        ),
      },
      {
        key: 'outstanding',
        label: 'Outstanding',
        width: '140px',
        className: 'text-right',
        render: (row) => (
          <span
            className={`block text-right font-medium ${
              row.outstanding > 0 ? 'text-orange-600' : 'text-gray-900'
            }`}
          >
            {fmt(Math.abs(row.outstanding), financialPosition?.currency ?? placement.currency)}
          </span>
        ),
      },
      {
        key: 'position',
        label: 'Status',
        width: '110px',
        render: (row) => positionBadge(row.position),
      },
      {
        key: 'counterpartyId',
        label: 'Actions',
        width: '120px',
        className: 'pr-6',
        render: (row) => (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={row.outstanding <= 0.0001}
            onClick={() => setPaymentTarget(row)}
          >
            Record
          </Button>
        ),
      },
    ],
    [financialPosition?.currency, placement.currency],
  );

  return (
    <div className="flex flex-col gap-0">
      <div className="px-4 pt-4 pb-2 bg-white rounded-t-xl border border-b-0 border-gray-200">
        <span className="text-sm font-bold text-gray-900">Reinsurer Settlement Position</span>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="No current reinsurer obligations"
        currentPage={1}
        totalPages={0}
        onPageChange={() => {}}
        noInternalScroll
      />

      <Modal
        isOpen={!!paymentTarget}
        onClose={closeModal}
        title="Record Reinsurer Payment"
        description="Record an outbound settlement against the selected confirmed closing source."
        footer={
          <>
            <Button variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={submitDisbursement} disabled={createPayment.isPending}>
              {createPayment.isPending ? 'Saving…' : 'Record Payment'}
            </Button>
          </>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={submitDisbursement}>
          <Controller
            name="sourceId"
            control={form.control}
            rules={{ required: 'Closing source is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Closing"
                placeholder="Select closing…"
                options={sources.map((source) => ({
                  value: source.value,
                  label: source.label,
                  sublabel: source.sublabel,
                }))}
                value={field.value}
                onChange={field.onChange}
                error={form.formState.errors.sourceId?.message}
              />
            )}
          />
          <FormField
            label="Amount"
            type="number"
            step="any"
            registration={form.register('amount', { required: 'Amount is required' })}
            error={form.formState.errors.amount}
          />
          <Controller
            name="paymentDate"
            control={form.control}
            rules={{ required: 'Payment date is required' }}
            render={({ field }) => (
              <DatePicker
                label="Payment Date"
                value={field.value}
                onChange={field.onChange}
                error={form.formState.errors.paymentDate?.message}
              />
            )}
          />
          <FormField
            label="Reference"
            registration={form.register('reference')}
            placeholder="Bank reference…"
            error={form.formState.errors.reference}
          />
          <FormField
            label="Notes"
            registration={form.register('notes')}
            placeholder="Payment notes…"
            error={form.formState.errors.notes}
          />
        </form>
      </Modal>
    </div>
  );
}
