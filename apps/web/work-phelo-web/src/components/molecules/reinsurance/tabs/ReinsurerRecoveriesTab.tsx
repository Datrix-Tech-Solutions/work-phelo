'use client';

import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { FormField } from '@/components/molecules/shared/FormField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Facultative } from '@/types/reinsurance';
import {
  useReinsurerClaims,
  useReinsurerClaimPayments,
  useCreatePlacementPayment,
  ReinsurerClaimRow,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number, currency: string) {
  return `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface RecoveryRow extends ReinsurerClaimRow {
  paid: number;
  outstanding: number;
}

interface RecordPaymentValues {
  amount: string;
  paymentDate: string;
}

function RecordRecoveryPaymentModal({
  row,
  reinsurerId,
  onClose,
}: {
  row: RecoveryRow | null;
  reinsurerId: string;
  onClose: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RecordPaymentValues>({ defaultValues: { amount: '', paymentDate: '' } });

  const createPayment = useCreatePlacementPayment();
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    if (row) {
      reset({ amount: row.outstanding > 0 ? String(row.outstanding) : '', paymentDate: '' });
    }
  }, [row, reset]);

  const handleClose = () => {
    reset({ amount: '', paymentDate: '' });
    onClose();
  };

  const onSubmit = async (values: RecordPaymentValues) => {
    if (!row) return;
    try {
      await createPayment.mutateAsync({
        placementId: row.placementId,
        type: 'CLAIM_SETTLEMENT',
        direction: 'INBOUND',
        counterpartyId: reinsurerId,
        amount: parseFloat(values.amount),
        currency: row.currency,
        paymentDate: new Date(values.paymentDate).toISOString(),
        notes: `Claim ${row.claimNumber}`,
      });
      addToast({ message: 'Recovery payment recorded', type: 'success' });
      handleClose();
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  return (
    <Modal
      isOpen={!!row}
      onClose={handleClose}
      title="Record Recovery Payment"
      description={row ? `${row.placementReference} — ${row.claimNumber}` : undefined}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button isLoading={isSubmitting} onClick={handleSubmit(onSubmit)}>
            Record Payment
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Amount"
          registration={register('amount', { required: 'Amount is required' })}
          placeholder="0.00"
          type="number"
          step="any"
          error={errors.amount}
        />
        <Controller
          name="paymentDate"
          control={control}
          rules={{ required: 'Payment date is required' }}
          render={({ field }) => (
            <DatePicker
              label="Payment Date"
              value={field.value}
              onChange={field.onChange}
              error={errors.paymentDate?.message}
            />
          )}
        />
      </div>
    </Modal>
  );
}

interface ReinsurerRecoveriesTabProps {
  placements: Facultative[];
  reinsurerId: string;
}

export function ReinsurerRecoveriesTab({ placements, reinsurerId }: ReinsurerRecoveriesTabProps) {
  const { rows, isLoading } = useReinsurerClaims(placements, reinsurerId);
  const { paidByPlacementId } = useReinsurerClaimPayments(placements, reinsurerId);
  const [paymentRow, setPaymentRow] = useState<RecoveryRow | null>(null);

  const recoveryRows: RecoveryRow[] = rows.map((row) => {
    const paid = Math.min(paidByPlacementId.get(row.placementId) ?? 0, row.recoveryAmount);
    return { ...row, paid, outstanding: Math.max(0, row.recoveryAmount - paid) };
  });

  const columns: Column<RecoveryRow>[] = [
    {
      key: 'placementReference',
      label: 'Offer',
      width: 'minmax(190px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.placementReference}</span>,
    },
    {
      key: 'cedantName',
      label: 'Cedant',
      width: 'minmax(130px, 1fr)',
      render: (row) => <span className="text-gray-700">{row.cedantName}</span>,
    },
    {
      key: 'claimNumber',
      label: 'Claim Number',
      width: '130px',
      render: (row) => <span className="text-gray-700">{row.claimNumber}</span>,
    },
    {
      key: 'occurrenceDate',
      label: 'Occurrence Date',
      width: '160px',
      render: (row) => <span className="text-gray-700">{fmtDate(row.occurrenceDate)}</span>,
    },
    {
      key: 'sharePercent',
      label: 'Share (%)',
      width: '100px',
      className: 'text-center',
      render: (row) => <span className="text-gray-600 block text-center">{row.sharePercent}%</span>,
    },
    {
      key: 'recoveryAmount',
      label: 'Recovery Amount',
      width: '170px',
      render: (row) => (
        <span className="font-medium text-gray-900 block">
          {fmtAmount(row.recoveryAmount, row.currency)}
        </span>
      ),
    },
    {
      key: 'paid',
      label: 'Paid',
      width: '150px',
      render: (row) => (
        <span className="text-gray-700 block">{fmtAmount(row.paid, row.currency)}</span>
      ),
    },
    {
      key: 'outstanding',
      label: 'Outstanding',
      width: '150px',
      render: (row) => (
        <span
          className={` font-medium ${row.outstanding > 0 ? 'text-orange-600' : 'text-gray-900'}`}
        >
          {fmtAmount(row.outstanding, row.currency)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '160px',
      render: (row) => <TableButton onClick={() => setPaymentRow(row)}>Record Payment</TableButton>,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={recoveryRows}
        emptyMessage={isLoading ? 'Loading…' : 'No offers with claims yet'}
        currentPage={1}
        totalPages={0}
        onPageChange={() => {}}
        noInternalScroll
      />

      <RecordRecoveryPaymentModal
        row={paymentRow}
        reinsurerId={reinsurerId}
        onClose={() => setPaymentRow(null)}
      />
    </>
  );
}
