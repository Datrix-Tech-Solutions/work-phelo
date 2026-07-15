'use client';

import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { FormField } from '@/components/molecules/shared/FormField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  useFacultatives,
  useAllReinsurerClaims,
  useAllReinsurerClaimPayments,
  useCreatePlacementPayment,
  useCurrencyOptions,
  RecoveryRow,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

const PAGE_SIZE = 10;

function fmtAmount(val: number, currency: string) {
  return `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface RecoveryTableRow extends RecoveryRow {
  paid: number;
  outstanding: number;
}

interface RecordPaymentValues {
  paymentType: string;
  chequeNumber: string;
  valueDate: string;
  paymentDate: string;
  amount: string;
  bankName: string;
  currency: string;
  rate: string;
}

const RECORD_PAYMENT_DEFAULTS: RecordPaymentValues = {
  paymentType: '',
  chequeNumber: '',
  valueDate: '',
  paymentDate: '',
  amount: '',
  bankName: '',
  currency: '',
  rate: '',
};

const PAYMENT_TYPE_OPTIONS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
];

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-gray-900">{label}</label>
      <div className="px-4 py-3 border border-gray-200 rounded-input bg-gray-50 text-sm text-gray-700">
        {value || '—'}
      </div>
    </div>
  );
}

function RecordRecoveryPaymentModal({
  row,
  onClose,
}: {
  row: RecoveryTableRow | null;
  onClose: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RecordPaymentValues>({ defaultValues: RECORD_PAYMENT_DEFAULTS });

  const createPayment = useCreatePlacementPayment();
  const { data: currencyOptions = [] } = useCurrencyOptions();
  const addToast = useToastStore((s) => s.addToast);

  const paymentType = useWatch({ control, name: 'paymentType' });
  const paymentCurrency = useWatch({ control, name: 'currency' });

  useEffect(() => {
    if (row) {
      reset({
        ...RECORD_PAYMENT_DEFAULTS,
        amount: row.outstanding > 0 ? String(row.outstanding) : '',
        currency: row.currency,
      });
    }
  }, [row, reset]);

  const handleClose = () => {
    reset(RECORD_PAYMENT_DEFAULTS);
    onClose();
  };

  const showRate = !!paymentCurrency && !!row?.currency && paymentCurrency !== row.currency;

  const onSubmit = async (values: RecordPaymentValues) => {
    if (!row) return;
    try {
      const resolvedDate = values.paymentType === 'cheque' ? values.valueDate : values.paymentDate;
      const rate = showRate ? parseFloat(values.rate) || 1 : 1;
      const amount = Math.round((parseFloat(values.amount) || 0) * rate * 100) / 100;

      const refParts: string[] = [];
      if (values.chequeNumber) refParts.push(values.chequeNumber);
      if (values.bankName) refParts.push(values.bankName);

      await createPayment.mutateAsync({
        placementId: row.placementId,
        type: 'CLAIM_SETTLEMENT',
        direction: 'INBOUND',
        counterpartyId: row.reinsurerId,
        amount,
        currency: row.currency,
        paymentDate: new Date(resolvedDate).toISOString(),
        reference: refParts.join(' — ') || undefined,
        notes: `Claim ${row.claimNumber}`,
      });
      addToast({ message: 'Recovery payment recorded', type: 'success' });
      handleClose();
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  const chequeFields = paymentType === 'cheque' && (
    <>
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3">
          <FormField
            label="Cheque Number"
            registration={register('chequeNumber', { required: 'Cheque number is required' })}
            placeholder="Enter cheque number…"
            error={errors.chequeNumber}
          />
        </div>
        <div className="col-span-2">
          <Controller
            name="valueDate"
            control={control}
            rules={{ required: 'Value date is required' }}
            render={({ field }) => (
              <DatePicker
                label="Value Date"
                value={field.value}
                onChange={field.onChange}
                error={errors.valueDate?.message}
                size="sm"
              />
            )}
          />
        </div>
      </div>

      <FormField
        label="Bank Name"
        registration={register('bankName', { required: 'Bank name is required' })}
        placeholder="Enter bank name…"
        error={errors.bankName}
      />

      <div className={showRate ? 'grid grid-cols-2 gap-4' : ''}>
        <Controller
          name="currency"
          control={control}
          rules={{ required: 'Currency is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Currency"
              placeholder="Select currency…"
              options={currencyOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.currency?.message}
              size="sm"
            />
          )}
        />
        {showRate && (
          <FormField
            label="Rate"
            registration={register('rate', { required: 'Rate is required' })}
            placeholder="0.00"
            type="number"
            step="any"
            error={errors.rate}
          />
        )}
      </div>

      <FormField
        label="Amount"
        registration={register('amount', { required: 'Amount is required' })}
        placeholder="0.00"
        type="number"
        step="any"
        error={errors.amount}
      />
    </>
  );

  const bankFields = paymentType === 'bank_transfer' && (
    <>
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
            size="sm"
          />
        )}
      />

      <FormField
        label="Bank Name"
        registration={register('bankName', { required: 'Bank name is required' })}
        placeholder="Enter bank name…"
        error={errors.bankName}
      />

      <div className={showRate ? 'grid grid-cols-2 gap-4' : ''}>
        <Controller
          name="currency"
          control={control}
          rules={{ required: 'Currency is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Currency"
              placeholder="Select currency…"
              options={currencyOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.currency?.message}
              size="sm"
            />
          )}
        />
        {showRate && (
          <FormField
            label="Rate"
            registration={register('rate', { required: 'Rate is required' })}
            placeholder="0.00"
            type="number"
            step="any"
            error={errors.rate}
          />
        )}
      </div>

      <FormField
        label="Amount"
        registration={register('amount', { required: 'Amount is required' })}
        placeholder="0.00"
        type="number"
        step="any"
        error={errors.amount}
      />
    </>
  );

  return (
    <SidePanel
      isOpen={!!row}
      onClose={handleClose}
      title="Record Recovery Payment"
      description={row ? `${row.reinsurerName} — ${row.claimNumber}` : undefined}
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="record-recovery-payment-form" isLoading={isSubmitting}>
            Record Payment
          </Button>
        </div>
      }
    >
      <form
        id="record-recovery-payment-form"
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        {row && (
          <div className="grid grid-cols-2 gap-3">
            <ReadOnlyField label="Policy Number" value={row.policyNumber} />
            <ReadOnlyField label="Reinsurer" value={row.reinsurerName} />
            <ReadOnlyField label="Claim Number" value={row.claimNumber} />
            <ReadOnlyField label="Outstanding" value={fmtAmount(row.outstanding, row.currency)} />
          </div>
        )}

        <Controller
          name="paymentType"
          control={control}
          rules={{ required: 'Payment type is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Payment Type"
              placeholder="Select payment type…"
              options={PAYMENT_TYPE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.paymentType?.message}
              size="sm"
            />
          )}
        />

        {chequeFields}
        {bankFields}
      </form>
    </SidePanel>
  );
}

export function RecoveriesTable() {
  const [search, setSearch] = useState('');
  const [reinsurerFilter, setReinsurerFilter] = useState('');
  const [page, setPage] = useState(1);
  const [paymentRow, setPaymentRow] = useState<RecoveryTableRow | null>(null);

  const { data: allPlacements = [], isLoading: loadingPlacements } = useFacultatives();

  const reinsuredPlacements = useMemo(
    () =>
      allPlacements.filter((p) =>
        p.participants.some((pt) => pt.status === 'ACCEPTED' || pt.status === 'CLOSED'),
      ),
    [allPlacements],
  );

  const { rows, isLoading: loadingClaims } = useAllReinsurerClaims(reinsuredPlacements);
  const { paidMap, isLoading: loadingPayments } = useAllReinsurerClaimPayments(reinsuredPlacements);

  const isLoading = loadingPlacements || loadingClaims || loadingPayments;

  const recoveryRows: RecoveryTableRow[] = useMemo(
    () =>
      rows.map((row) => {
        const paid = Math.min(
          paidMap.get(`${row.placementId}:${row.reinsurerId}`) ?? 0,
          row.recoveryAmount,
        );
        return { ...row, paid, outstanding: Math.max(0, row.recoveryAmount - paid) };
      }),
    [rows, paidMap],
  );

  const reinsurerOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of recoveryRows) seen.set(r.reinsurerId, r.reinsurerName);
    return Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [recoveryRows]);

  const filtered = useMemo(() => {
    let rows = recoveryRows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.policyNumber.toLowerCase().includes(q) ||
          r.insuredTitle.toLowerCase().includes(q) ||
          r.reinsurerName.toLowerCase().includes(q) ||
          r.claimNumber.toLowerCase().includes(q),
      );
    }
    if (reinsurerFilter) {
      rows = rows.filter((r) => r.reinsurerId === reinsurerFilter);
    }
    return rows;
  }, [recoveryRows, search, reinsurerFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<RecoveryTableRow>[] = [
    {
      key: 'policyNumber',
      label: 'Policy Number',
      width: 'minmax(150px, 1fr)',
      render: (row) => <EndorsedReferencePill id={row.placementId} reference={row.policyNumber} />,
    },
    {
      key: 'insuredTitle',
      label: 'Insured / Risk Type',
      width: 'minmax(150px, 1fr)',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-gray-900 leading-tight">{row.insuredTitle}</span>
          <span className="text-xs text-gray-400">{row.riskType ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'reinsurerName',
      label: 'Reinsurer',
      width: 'minmax(130px, 1fr)',
      render: (row) => <span className="text-gray-700">{row.reinsurerName}</span>,
    },
    {
      key: 'claimNumber',
      label: 'Claim Number',
      width: '140px',
      render: (row) => <span className="text-gray-700">{row.claimNumber}</span>,
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
      key: 'outstanding',
      label: 'Outstanding',
      width: '150px',
      render: (row) => (
        <span
          className={`font-medium ${row.outstanding > 0 ? 'text-orange-600' : 'text-gray-900'}`}
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
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search recoveries…"
        searchValue={search}
        noInternalScroll
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        extraFilters={
          <div>
            <SearchSelect
              size="sm"
              placeholder="Reinsurers"
              options={reinsurerOptions}
              value={reinsurerFilter}
              onChange={(v) => {
                setReinsurerFilter(v);
                setPage(1);
              }}
            />
          </div>
        }
        emptyMessage="No recoveries found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <RecordRecoveryPaymentModal row={paymentRow} onClose={() => setPaymentRow(null)} />
    </>
  );
}
