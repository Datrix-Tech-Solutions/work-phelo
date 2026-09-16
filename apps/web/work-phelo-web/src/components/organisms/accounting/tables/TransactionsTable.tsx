'use client';

import { useMemo, useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { TypeChip } from '@/components/atoms/TypeChip';
import { TableButton } from '@/components/atoms/TableButton';
import { Icons } from '@/components/atoms/icons';
import { Modal } from '@/components/organisms/shared/Modal';
import {
  AccountingTradeDocument,
  AccountingTradeDocumentStatus,
  TransactionTypeDefinition,
} from '@/types/accounting';
import {
  usePayableBills,
  usePayableCreditNotes,
  useReceivableCreditNotes,
  useReceivableInvoices,
  useTransactionTypes,
} from '@/hooks';
import { TradeDocumentDetailPanel } from '@/components/organisms/accounting/panels/TradeDocumentDetailPanel';
import { NewTransactionPanel } from '@/components/organisms/accounting/panels/NewTransactionPanel';
import { MakePaymentPanel } from '@/components/organisms/accounting/panels/MakePaymentPanel';
import {
  TRANSACTION_TYPE_CATEGORY_CHIP_COLOR,
  TRANSACTION_TYPE_CATEGORY_LABEL,
} from '@/lib/accounting/transactionTypeCategory';

const PAGE_SIZE = 10;

const STATUS_VARIANT: Record<AccountingTradeDocumentStatus, 'success' | 'neutral' | 'danger'> = {
  DRAFT: 'neutral',
  POSTED: 'success',
  REVERSED: 'danger',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(amount: string, currency: string) {
  const value = Number(amount);
  return `${currency} ${Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : amount}`;
}

export function TransactionsTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detailTarget, setDetailTarget] = useState<AccountingTradeDocument | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<AccountingTradeDocument | null>(null);
  const [newTransactionOpen, setNewTransactionOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<TransactionTypeDefinition | null | undefined>(
    undefined,
  );

  const { data: transactionTypes = [], isLoading: isLoadingTransactionTypes } =
    useTransactionTypes();

  const invoices = useReceivableInvoices({ limit: 100 });
  const bills = usePayableBills({ limit: 100 });
  const receivableCreditNotes = useReceivableCreditNotes({ limit: 100 });
  const payableCreditNotes = usePayableCreditNotes({ limit: 100 });

  const isLoading =
    invoices.isLoading || bills.isLoading || receivableCreditNotes.isLoading ||
    payableCreditNotes.isLoading;

  const transactions = useMemo(() => {
    const all = [
      ...(invoices.data?.items ?? []),
      ...(bills.data?.items ?? []),
      ...(receivableCreditNotes.data?.items ?? []),
      ...(payableCreditNotes.data?.items ?? []),
    ];
    return all.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [invoices.data, bills.data, receivableCreditNotes.data, payableCreditNotes.data]);

  const filtered = useMemo(() => {
    if (!search) return transactions;
    const q = search.toLowerCase();
    return transactions.filter(
      (r) =>
        r.documentNumber.toLowerCase().includes(q) ||
        r.party.name.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q),
    );
  }, [search, transactions]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns = useMemo<Column<AccountingTradeDocument>[]>(
    () => [
      {
        key: 'documentNumber',
        label: 'Transaction ID',
        width: '120px',
        render: (row) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
            {row.documentNumber}
          </span>
        ),
      },
      {
        key: 'documentDate',
        label: 'Date',
        width: '80px',
        render: (row) => <span className="text-sm text-gray-700">{fmtDate(row.documentDate)}</span>,
      },
      {
        key: 'entity',
        label: 'Entity',
        width: 'minmax(120px, 1fr)',
        render: (row) => (
          <span className="text-sm text-gray-800 font-medium">{row.party.name}</span>
        ),
      },
      {
        key: 'subtotalAmount',
        label: 'Subtotal',
        width: '130px',
        className: 'text-right pr-6',
        render: (row) => (
          <span className="block text-right text-sm text-gray-700">
            {fmtAmount(row.subtotalAmount, row.currency)}
          </span>
        ),
      },
      {
        key: 'taxAmount',
        label: 'Tax',
        width: '90px',
        className: 'text-right pr-6',
        render: (row) => (
          <span className="block text-right text-sm text-gray-700">
            {fmtAmount(row.taxAmount, row.currency)}
          </span>
        ),
      },
      {
        key: 'totalAmount',
        label: 'Total',
        width: '130px',
        className: 'text-right pr-6',
        render: (row) => (
          <span className="block text-right text-sm font-medium text-gray-900">
            {fmtAmount(row.totalAmount, row.currency)}
          </span>
        ),
      },
      {
        key: 'side',
        label: 'Type',
        width: '90px',
        render: (row) => (
          <TypeChip
            label={TRANSACTION_TYPE_CATEGORY_LABEL[row.side]}
            color={TRANSACTION_TYPE_CATEGORY_CHIP_COLOR[row.side]}
          />
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: '70px',
        render: (row) => <Badge label={row.status} variant={STATUS_VARIANT[row.status]} />,
      },
      {
        key: 'actions',
        label: '',
        width: '170px',
        render: (row) => (
          <div className="flex items-center justify-end gap-3" onClick={(e) => e.stopPropagation()}>
            {row.status === 'DRAFT' ? (
              <TableButton variant="green" onClick={() => setDetailTarget(row)}>
                Post
              </TableButton>
            ) : row.status === 'POSTED' ? (
              <TableButton variant="green" onClick={() => setPaymentTarget(row)}>
                {row.side === 'RECEIVABLE' ? 'Receive Payment' : 'Make Payment'}
              </TableButton>
            ) : null}
            <TableButton variant="blue" tooltip="View Documents" onClick={() => setDetailTarget(row)}>
              <Icons.FileText className="w-3.5 h-3.5" />
            </TableButton>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search transactions…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        onRowClick={(row) => setDetailTarget(row)}
        actionButton={{ label: 'New Transaction', onClick: () => setNewTransactionOpen(true) }}
        emptyMessage="No transactions found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <Modal
        isOpen={newTransactionOpen}
        onClose={() => setNewTransactionOpen(false)}
        title="New Transaction"
        description="Choose a transaction type to record."
      >
        {isLoadingTransactionTypes ? (
          <p className="text-sm text-gray-500">Loading transaction types…</p>
        ) : transactionTypes.length === 0 ? (
          <p className="text-sm text-gray-500">
            No transaction types configured yet. Add one under Settings → Transaction Types.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {transactionTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => {
                  setNewTransactionOpen(false);
                  setSelectedType(type);
                }}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-gray-900">{type.name}</span>
                  {type.description && (
                    <span className="text-xs text-gray-500">{type.description}</span>
                  )}
                  {(type.category === 'RECEIVABLE' || type.category === 'PAYABLE') &&
                    type.rulesCount === 0 && (
                      <span className="text-xs text-orange-600">Rule required to use</span>
                    )}
                </div>
                <TypeChip
                  label={TRANSACTION_TYPE_CATEGORY_LABEL[type.category]}
                  color={TRANSACTION_TYPE_CATEGORY_CHIP_COLOR[type.category]}
                />
              </button>
            ))}
          </div>
        )}
      </Modal>

      <NewTransactionPanel
        transactionType={selectedType}
        onClose={() => setSelectedType(undefined)}
        onPostedForPayment={(document) => {
          setSelectedType(undefined);
          setPaymentTarget(document);
        }}
      />

      <TradeDocumentDetailPanel
        side={detailTarget?.side ?? 'RECEIVABLE'}
        document={detailTarget}
        documentKind={detailTarget?.documentType === 'CREDIT_NOTE' ? 'creditNote' : 'invoice'}
        onClose={() => setDetailTarget(null)}
        onPostedForPayment={(document) => {
          setDetailTarget(null);
          setPaymentTarget(document);
        }}
      />

      <MakePaymentPanel document={paymentTarget} onClose={() => setPaymentTarget(null)} />
    </>
  );
}
