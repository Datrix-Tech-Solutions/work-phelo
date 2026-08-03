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
  useCreateClaimRecoveryReceipt,
  useReverseClaimRecoveryReceipt,
  RecoveryRow,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

const PAGE_SIZE = 10;

function fmtAmount(val: number, currency: string) {
  return `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type RecoveryTableRow = RecoveryRow;

interface RecordPaymentValues {
  paymentType: string;
  chequeNumber: string;
  valueDate: string;
  paymentDate: string;
  amount: string;
  bankName: string;
  currency: string;
}

const RECORD_PAYMENT_DEFAULTS: RecordPaymentValues = {
  paymentType: '',
  chequeNumber: '',
  valueDate: '',
  paymentDate: '',
  amount: '',
  bankName: '',
  currency: '',
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
        {value || '-'}
      </div>
    </div>
  );
}

function RecordRecoveryReceiptModal({
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

  const createReceipt = useCreateClaimRecoveryReceipt();
  const reverseReceipt = useReverseClaimRecoveryReceipt();
  const addToast = useToastStore((s) => s.addToast);

  const paymentType = useWatch({ control, name: 'paymentType' });

  useEffect(() => {
    if (row) {
      reset({
        ...RECORD_PAYMENT_DEFAULTS,
        amount: row.outstandingAmount > 0 ? String(row.outstandingAmount) : '',
        currency: row.currency,
      });
    }
  }, [row, reset]);

  const handleClose = () => {
    reset(RECORD_PAYMENT_DEFAULTS);
    onClose();
  };

  const onSubmit = async (values: RecordPaymentValues) => {
    if (!row) return;
    try {
      const resolvedDate = values.paymentType === 'cheque' ? values.valueDate : values.paymentDate;
      const amount = Math.round((parseFloat(values.amount) || 0) * 100) / 100;

      const refParts: string[] = [];
      if (values.chequeNumber) refParts.push(values.chequeNumber);
      if (values.bankName) refParts.push(values.bankName);

      await createReceipt.mutateAsync({
        placementId: row.placementId,
        claimId: row.claimId,
        cashCallId: row.cashCallId,
        payload: {
          amount,
          currency: row.currency,
          paymentDate: new Date(resolvedDate).toISOString(),
          reference: refParts.join(' - ') || undefined,
          notes: values.bankName ? `Received via ${values.bankName}` : undefined,
        },
      });
      addToast({ message: 'Recovery receipt recorded', type: 'success' });
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
            placeholder="Enter cheque number..."
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
        placeholder="Enter bank name..."
        error={errors.bankName}
      />

      {row && <ReadOnlyField label="Currency" value={row.currency} />}

      <FormField
        label="Amount Received"
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
        placeholder="Enter bank name..."
        error={errors.bankName}
      />

      {row && <ReadOnlyField label="Currency" value={row.currency} />}

      <FormField
        label="Amount Received"
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
      title={row?.outstandingAmount ? 'Record Recovery Receipt' : 'Recovery Receipt History'}
      description={row ? `${row.reinsurerName} - ${row.claimNumber}` : undefined}
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          {!!row?.outstandingAmount && (
            <Button type="submit" form="record-recovery-receipt-form" isLoading={isSubmitting}>
              Record Recovery
            </Button>
          )}
        </div>
      }
    >
      <form
        id="record-recovery-receipt-form"
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        {row && (
          <div className="grid grid-cols-2 gap-3">
            <ReadOnlyField label="Policy Number" value={row.policyNumber} />
            <ReadOnlyField label="Reinsurer" value={row.reinsurerName} />
            <ReadOnlyField label="Claim Number" value={row.claimNumber} />
            <ReadOnlyField label="Cash Call" value={row.cashCallNumber} />
            <ReadOnlyField
              label="Outstanding Recovery"
              value={fmtAmount(row.outstandingAmount, row.currency)}
            />
          </div>
        )}

        {!!row?.outstandingAmount && (
          <>
            <Controller
              name="paymentType"
              control={control}
              rules={{ required: 'Payment type is required' }}
              render={({ field }) => (
                <SearchSelect
                  label="Payment Type"
                  placeholder="Select payment type..."
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
          </>
        )}

        {row && (
          <div className="flex flex-col gap-3">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Recovery Receipt History</h4>
              <p className="text-xs text-gray-500">
                Immutable Reinsurer to Broker receipts for this cash call.
              </p>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Amount</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Reference</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {row.receipts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                        No recovery receipts recorded yet.
                      </td>
                    </tr>
                  ) : (
                    row.receipts.map((receipt) => (
                      <tr key={receipt.id} className="border-t border-gray-100">
                        <td className="px-3 py-2">
                          {new Date(receipt.paymentDate).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2">
                          {fmtAmount(parseFloat(receipt.amount), receipt.currency)}
                        </td>
                        <td className="px-3 py-2">{receipt.status}</td>
                        <td className="px-3 py-2">{receipt.reference ?? '-'}</td>
                        <td className="px-3 py-2 text-right">
                          {receipt.status === 'RECORDED' && !receipt.reversalOfReceiptId ? (
                            <TableButton
                              variant="gray"
                              onClick={() =>
                                reverseReceipt.mutate(
                                  {
                                    placementId: row.placementId,
                                    claimId: row.claimId,
                                    receiptId: receipt.id,
                                    notes: 'Reversed from recovery history',
                                  },
                                  {
                                    onSuccess: () => {
                                      addToast({
                                        message: 'Recovery receipt reversed',
                                        type: 'success',
                                      });
                                      handleClose();
                                    },
                                    onError: (error) =>
                                      addToast({ message: extractError(error), type: 'error' }),
                                  },
                                )
                              }
                            >
                              Reverse
                            </TableButton>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
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

  const isLoading = loadingPlacements || loadingClaims;

  const recoveryRows: RecoveryTableRow[] = useMemo(() => rows, [rows]);

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
          <span className="text-xs text-gray-400">{row.riskType ?? '-'}</span>
        </div>
      ),
    },
    {
      key: 'reinsurerName',
      label: 'Reinsurer',
      width: 'minmax(130px, 1fr)',
      render: (row) => <span className="text-gray-700">{row.reinsurerName}</span>,
    },
    // {
    //   key: 'claimNumber',
    //   label: 'Claim Number',
    //   width: '140px',
    //   render: (row) => <span className="text-gray-700">{row.claimNumber}</span>,
    // },
    {
      key: 'cashCallNumber',
      label: 'Cash Call',
      width: '120px',
      className: 'text-center',
      render: (row) => (
        <span className="text-gray-600 block text-center">{row.cashCallNumber}</span>
      ),
    },
    {
      key: 'calledAmount',
      label: 'Called Amount',
      width: '150px',
      render: (row) => (
        <span className="font-medium text-gray-900 block">
          {fmtAmount(row.calledAmount, row.currency)}
        </span>
      ),
    },
    {
      key: 'recoveredAmount',
      label: 'Recovered',
      width: '150px',
      render: (row) => (
        <span className="text-gray-700 block">{fmtAmount(row.recoveredAmount, row.currency)}</span>
      ),
    },
    {
      key: 'outstandingAmount',
      label: 'Outstanding',
      width: '150px',
      render: (row) => (
        <span
          className={`font-medium ${
            row.outstandingAmount > 0 ? 'text-orange-600' : 'text-gray-900'
          }`}
        >
          {fmtAmount(row.outstandingAmount, row.currency)}
        </span>
      ),
    },
    {
      key: 'recoveryStatus',
      label: 'Status',
      width: '150px',
      render: (row) => <span className="text-gray-700">{row.recoveryStatus}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '150px',
      render: (row) => (
        <TableButton
          variant={row.outstandingAmount > 0 && row.cashCallStatus === 'ISSUED' ? 'blue' : 'gray'}
          disabled={row.cashCallStatus !== 'ISSUED'}
          tooltip={
            row.cashCallStatus === 'ISSUED'
              ? undefined
              : 'Only issued cash calls can receive recovery receipts.'
          }
          onClick={() => setPaymentRow(row)}
        >
          {row.outstandingAmount > 0 ? 'Record Recovery' : 'View History'}
        </TableButton>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search recoveries..."
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

      <RecordRecoveryReceiptModal row={paymentRow} onClose={() => setPaymentRow(null)} />
    </>
  );
}
