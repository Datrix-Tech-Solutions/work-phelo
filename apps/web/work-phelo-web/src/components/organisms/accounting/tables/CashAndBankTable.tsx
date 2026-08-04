'use client';

import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import {
  useConfirmReinsurerDisbursementBankPayment,
  useReinsuranceBankConfirmationWorkItems,
} from '@/hooks/accounting/useReinsuranceBankConfirmations';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import type {
  AccountingBankConfirmationWorkItem,
  ConfirmBankPaymentPayload,
} from '@/types/accountingIntegration';

const PAGE_SIZE = 10;

interface ConfirmationForm {
  bankConfirmedAt: string;
  bankReference: string;
  agreedExchangeRate: string;
  bankChargeAmount: string;
  withholdingTaxAmount: string;
  notes: string;
}

const INITIAL_FORM: ConfirmationForm = {
  bankConfirmedAt: '',
  bankReference: '',
  agreedExchangeRate: '',
  bankChargeAmount: '',
  withholdingTaxAmount: '',
  notes: '',
};

function fmtDate(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(amount: number | string, currency: string) {
  const numeric = Number(amount);
  return `${currency} ${numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toOptionalNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : undefined;
}

function defaultDateTimeLocal() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function CashAndBankTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<AccountingBankConfirmationWorkItem | null>(null);
  const [form, setForm] = useState<ConfirmationForm>(INITIAL_FORM);

  const addToast = useToastStore((state) => state.addToast);
  const pendingQuery = useReinsuranceBankConfirmationWorkItems();
  const confirmMutation = useConfirmReinsurerDisbursementBankPayment();

  const pendingPayments = useMemo(() => pendingQuery.data ?? [], [pendingQuery.data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pendingPayments;
    return pendingPayments.filter((item) => {
      return (
        item.sourceModule.toLowerCase().includes(q) ||
        item.counterpartyName.toLowerCase().includes(q) ||
        item.sourceReference.toLowerCase().includes(q) ||
        item.operationalReference?.toLowerCase().includes(q) ||
        item.settlementReference?.toLowerCase().includes(q) ||
        item.sourceDescription.toLowerCase().includes(q)
      );
    });
  }, [pendingPayments, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openConfirmModal = (item: AccountingBankConfirmationWorkItem) => {
    setSelectedItem(item);
    setForm({ ...INITIAL_FORM, bankConfirmedAt: defaultDateTimeLocal() });
  };

  const closeConfirmModal = () => {
    if (confirmMutation.isPending) return;
    setSelectedItem(null);
    setForm(INITIAL_FORM);
  };

  const updateForm = (key: keyof ConfirmationForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const updateFormFromInput =
    (key: keyof ConfirmationForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      updateForm(key, event.target.value);
    };

  const confirmWorkItem = async (
    item: AccountingBankConfirmationWorkItem,
    payload: ConfirmBankPaymentPayload,
  ) => {
    if (item.sourceModule !== 'REINSURANCE') {
      throw new Error(`${item.sourceModule} bank confirmation is not supported yet.`);
    }
    return confirmMutation.mutateAsync({
      placementId: item.sourceParentId,
      paymentId: item.sourceRecordId,
      ...payload,
    });
  };

  const submitConfirmation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedItem) return;
    try {
      await confirmWorkItem(selectedItem, {
        bankConfirmedAt: new Date(form.bankConfirmedAt).toISOString(),
        bankReference: form.bankReference.trim(),
        agreedExchangeRate: toOptionalNumber(form.agreedExchangeRate),
        bankChargeAmount: toOptionalNumber(form.bankChargeAmount),
        withholdingTaxAmount: toOptionalNumber(form.withholdingTaxAmount),
        notes: form.notes.trim() || undefined,
      });
      addToast({
        type: 'success',
        message: 'Bank payment confirmed and sent to Accounting.',
      });
      setSelectedItem(null);
      setForm(INITIAL_FORM);
    } catch (error) {
      addToast({
        type: 'error',
        message: extractError(error, 'Unable to confirm bank payment'),
      });
    }
  };

  const columns: Column<AccountingBankConfirmationWorkItem>[] = [
    {
      key: 'sourceModule',
      label: 'Source Module',
      width: '150px',
      render: (row) => (
        <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
          {row.sourceModule}
        </span>
      ),
    },
    {
      key: 'businessDate',
      label: 'Business Date',
      width: '140px',
      render: (row) => <span className="text-sm text-gray-700">{fmtDate(row.businessDate)}</span>,
    },
    {
      key: 'counterparty',
      label: 'Counterparty',
      width: 'minmax(180px, 1fr)',
      render: (row) => (
        <span className="text-sm font-medium text-gray-900">{row.counterpartyName}</span>
      ),
    },
    {
      key: 'source',
      label: 'Source',
      width: 'minmax(180px, 1fr)',
      render: (row) => <span className="text-sm text-gray-700">{row.sourceDescription}</span>,
    },
    {
      key: 'amount',
      label: 'Amount',
      width: '150px',
      render: (row) => (
        <span className="block text-right text-sm font-semibold text-gray-900">
          {fmtAmount(row.amount, row.currency)}
        </span>
      ),
    },
    {
      key: 'reference',
      label: 'Payment Ref',
      width: '150px',
      render: (row) => (
        <span className="text-sm text-gray-700">{row.operationalReference ?? '-'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '130px',
      render: (row) => (
        <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
          {row.status.replaceAll('_', ' ')}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
          <h3 className="text-sm font-semibold text-blue-950">Bank Confirmation Work Queue</h3>
          <p className="mt-1 text-sm text-blue-900">
            Source modules record operational payments. Accounting confirms bank completion here
            before recognition and posting begin. Reinsurance is the first connected source.
          </p>
        </div>

        <DataTable
          columns={columns}
          data={paged}
          isLoading={pendingQuery.isLoading}
          searchPlaceholder="Search source, counterparty or reference..."
          searchValue={search}
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          rowActions={(row) => [
            {
              label: 'Confirm Bank Payment',
              onClick: () => openConfirmModal(row),
              variant: 'success',
            },
          ]}
          emptyMessage={
            pendingQuery.isError
              ? 'Integration queue unavailable. Core Accounting remains available.'
              : 'No source-module payments are awaiting bank confirmation'
          }
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>

      <Modal
        isOpen={!!selectedItem}
        onClose={closeConfirmModal}
        title="Confirm Bank Payment"
        description="Capture the Accounting confirmation facts for this outbound reinsurer disbursement."
        width="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={closeConfirmModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="confirm-reinsurer-bank-payment-form"
              isLoading={confirmMutation.isPending}
              loadingText="Confirming..."
            >
              Confirm Bank Payment
            </Button>
          </>
        }
      >
        {selectedItem && (
          <form
            id="confirm-reinsurer-bank-payment-form"
            className="mt-5 space-y-4"
            onSubmit={submitConfirmation}
          >
            <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
              <div className="font-semibold text-gray-900">{selectedItem.counterpartyName}</div>
              <div className="mt-1">
                {selectedItem.sourceDescription} -{' '}
                {fmtAmount(selectedItem.amount, selectedItem.currency)}
              </div>
              <div className="mt-1">Source module: {selectedItem.sourceModule}</div>
              <div className="mt-1">
                Operational ref: {selectedItem.operationalReference ?? '-'}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Bank Confirmation Date"
                type="datetime-local"
                value={form.bankConfirmedAt}
                onChange={updateFormFromInput('bankConfirmedAt')}
                required
              />
              <Input
                label="Bank Reference"
                value={form.bankReference}
                onChange={updateFormFromInput('bankReference')}
                maxLength={100}
                required
              />
              <Input
                label="FX Rate"
                type="number"
                step="0.000001"
                min="0"
                value={form.agreedExchangeRate}
                onChange={updateFormFromInput('agreedExchangeRate')}
              />
              <Input
                label="Bank Charges"
                type="number"
                step="0.01"
                min="0"
                value={form.bankChargeAmount}
                onChange={updateFormFromInput('bankChargeAmount')}
              />
              <Input
                label="Withholding Tax"
                type="number"
                step="0.01"
                min="0"
                value={form.withholdingTaxAmount}
                onChange={updateFormFromInput('withholdingTaxAmount')}
              />
            </div>

            <Input
              label="Confirmation Notes"
              type="textarea"
              rows={4}
              value={form.notes}
              onChange={updateFormFromInput('notes')}
              maxLength={1000}
            />
          </form>
        )}
      </Modal>
    </>
  );
}
