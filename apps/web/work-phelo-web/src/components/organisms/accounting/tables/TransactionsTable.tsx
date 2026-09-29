'use client';

import { useMemo, useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { TypeChip, TypeChipColor } from '@/components/atoms/TypeChip';
import { TableButton } from '@/components/atoms/TableButton';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { Icons } from '@/components/atoms/icons';
import { Modal } from '@/components/organisms/shared/Modal';
import {
  AccountingTradeDocument,
  AccountingTradeDocumentPaymentState,
  AccountingTradeDocumentStatus,
  CashbookTransaction,
  CashbookTransactionType,
  TransactionTypeDefinition,
} from '@/types/accounting';
import {
  useCashbookTransactions,
  usePayableBills,
  usePayableCreditNotes,
  useReceivableCreditNotes,
  useReceivableInvoices,
  useTransactionTypes,
} from '@/hooks';
import { TradeDocumentDetailPanel } from '@/components/organisms/accounting/panels/TradeDocumentDetailPanel';
import { CashbookTransactionDetailPanel } from '@/components/organisms/accounting/panels/CashbookTransactionDetailPanel';
import { NewTransactionPanel } from '@/components/organisms/accounting/panels/NewTransactionPanel';
import { MakePaymentPanel } from '@/components/organisms/accounting/panels/MakePaymentPanel';
import { BulkPaymentPanel } from '@/components/organisms/accounting/panels/BulkPaymentPanel';
import {
  TRANSACTION_TYPE_CATEGORY_CHIP_COLOR,
  TRANSACTION_TYPE_CATEGORY_LABEL,
} from '@/lib/accounting/transactionTypeCategory';

const PAGE_SIZE = 10;

// Documents and plain cashbook entries (Receipt/Payment/Charge/Adjustment/Transfer) share the
// exact same status enum (DRAFT/POSTED/REVERSED), so one map covers both.
const STATUS_VARIANT: Record<AccountingTradeDocumentStatus, 'success' | 'neutral' | 'danger'> = {
  DRAFT: 'neutral',
  POSTED: 'success',
  REVERSED: 'danger',
};

const STATUS_LABEL: Record<AccountingTradeDocumentStatus, string> = {
  DRAFT: 'PENDING',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
};

const PAYMENT_STATE_LABEL: Record<AccountingTradeDocumentPaymentState, string> = {
  DRAFT: 'Draft',
  REVERSED: 'Reversed',
  PAID: 'Paid',
  PARTIALLY_PAID: 'Partially Paid',
  OPEN: 'Unpaid',
};

// A credit/debit note is never "paid" — its state is how much of it has been applied
// against the invoice/bill it reduces.
const CREDIT_NOTE_STATE_LABEL: Record<AccountingTradeDocumentPaymentState, string> = {
  DRAFT: 'Draft',
  REVERSED: 'Reversed',
  PAID: 'Applied',
  PARTIALLY_PAID: 'Partly Applied',
  OPEN: 'Unapplied',
};

const CASHBOOK_TYPE_LABEL: Record<CashbookTransactionType, string> = {
  RECEIPT: 'Receipt',
  PAYMENT: 'Payment',
  TRANSFER: 'Transfer',
  CHARGE: 'Charge',
  ADJUSTMENT: 'Adjustment',
};

const CASHBOOK_TYPE_CHIP_COLOR: Record<CashbookTransactionType, TypeChipColor> = {
  RECEIPT: 'green',
  PAYMENT: 'red',
  TRANSFER: 'purple',
  CHARGE: 'amber',
  ADJUSTMENT: 'gray',
};

// A direct cashbook entry's "commit it" action reads as Receive Payment/Make Payment (money
// in/out), matching the same wording used for AP/AR documents — "Post" is only kept for a
// Transfer, which isn't a payment either way.
function cashbookActionLabel(direction: CashbookTransaction['direction']) {
  if (direction === 'INFLOW') return 'Receive Payment';
  if (direction === 'OUTFLOW') return 'Make Payment';
  return 'Post';
}

const STATUS_FILTER_OPTIONS: SearchSelectOption[] = [
  { value: 'DRAFT', label: 'Pending' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'REVERSED', label: 'Reversed' },
];

const TYPE_FILTER_OPTIONS: SearchSelectOption[] = [
  { value: 'RECEIVABLE', label: 'Receivable' },
  { value: 'PAYABLE', label: 'Payable' },
  { value: 'CASHBOOK', label: 'Cashbook' },
];

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

/** A row is either an AP/AR trade document or a plain cashbook entry — the two are
 *  conceptually different (a document tracks its own payment state; a cashbook entry's
 *  posting IS its settlement) but belong in one merged, sortable/filterable list since both
 *  are "transactions" to a tenant. Flattened to one shape so columns don't need to branch
 *  on kind for every field, only for the handful that genuinely differ. */
interface UnifiedTransactionRow {
  id: string;
  kind: 'document' | 'cashbook';
  transactionNumber: string;
  date: string;
  entityLabel: string;
  /** The original invoice/bill a credit/debit note reduces, when it has one. */
  linkedTo: string | null;
  subtotalAmount: string | null;
  taxAmount: string | null;
  totalAmount: string;
  currency: string;
  typeLabel: string;
  typeColor: TypeChipColor;
  filterSide: 'RECEIVABLE' | 'PAYABLE' | 'CASHBOOK';
  status: AccountingTradeDocumentStatus;
  paymentStateLabel: string | null;
  createdAt: string;
  document?: AccountingTradeDocument;
  cashbook?: CashbookTransaction;
}

/** Payment state for an invoice/bill, or "applied" state for a credit/debit note. An invoice
 *  reduced only by credit notes reads "Credited" rather than "Partially Paid", since nothing
 *  was actually paid on it. */
function documentStateLabel(doc: AccountingTradeDocument): string | null {
  if (doc.status === 'DRAFT') return null;
  if (doc.documentType === 'CREDIT_NOTE') return CREDIT_NOTE_STATE_LABEL[doc.paymentState];
  const credited = Number(doc.creditedAmount ?? 0);
  const applied = Number(doc.totalAmount) - Number(doc.outstandingAmount ?? doc.totalAmount);
  const isCreditedOnly = credited > 0 && applied - credited <= 0;
  if (isCreditedOnly && doc.paymentState === 'PAID') return 'Credited';
  if (isCreditedOnly && doc.paymentState === 'PARTIALLY_PAID') return 'Partially Credited';
  return PAYMENT_STATE_LABEL[doc.paymentState];
}

function toDocumentRow(doc: AccountingTradeDocument): UnifiedTransactionRow {
  return {
    id: doc.id,
    kind: 'document',
    transactionNumber: doc.documentNumber,
    date: doc.documentDate,
    entityLabel: doc.party.name,
    linkedTo: doc.originalDocument?.documentNumber ?? null,
    subtotalAmount: doc.subtotalAmount,
    taxAmount: doc.taxAmount,
    totalAmount: doc.totalAmount,
    currency: doc.currency,
    typeLabel: TRANSACTION_TYPE_CATEGORY_LABEL[doc.side],
    typeColor: TRANSACTION_TYPE_CATEGORY_CHIP_COLOR[doc.side],
    filterSide: doc.side,
    status: doc.status,
    paymentStateLabel: documentStateLabel(doc),
    createdAt: doc.createdAt,
    document: doc,
  };
}

function toCashbookRow(cb: CashbookTransaction): UnifiedTransactionRow {
  return {
    id: cb.id,
    kind: 'cashbook',
    transactionNumber: cb.transactionNumber || cb.reference || cb.id.slice(0, 8).toUpperCase(),
    date: cb.transactionDate,
    entityLabel: cb.description,
    linkedTo: null,
    // Direct cashbook entries have no tax field yet — subtotal is the full entered amount
    // and tax is a fixed 0 until that's built, so total = subtotal (+ 0) still adds up.
    subtotalAmount: cb.amount,
    taxAmount: '0',
    totalAmount: cb.amount,
    currency: cb.currency,
    typeLabel: CASHBOOK_TYPE_LABEL[cb.transactionType],
    typeColor: CASHBOOK_TYPE_CHIP_COLOR[cb.transactionType],
    filterSide: 'CASHBOOK',
    status: cb.status,
    paymentStateLabel: null,
    createdAt: cb.createdAt,
    cashbook: cb,
  };
}

export function TransactionsTable({ partyId }: { partyId?: string } = {}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [detailTarget, setDetailTarget] = useState<AccountingTradeDocument | null>(null);
  const [cashbookDetailTarget, setCashbookDetailTarget] = useState<CashbookTransaction | null>(
    null,
  );
  const [paymentTarget, setPaymentTarget] = useState<AccountingTradeDocument | null>(null);
  const [newTransactionOpen, setNewTransactionOpen] = useState(false);
  const [bulkPaymentOpen, setBulkPaymentOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<TransactionTypeDefinition | null | undefined>(
    undefined,
  );

  const { data: transactionTypes = [], isLoading: isLoadingTransactionTypes } =
    useTransactionTypes();
  const selectableTypes = useMemo(
    () => transactionTypes.filter((t) => t.category === 'RECEIVABLE' || t.category === 'PAYABLE'),
    [transactionTypes],
  );

  const invoices = useReceivableInvoices({ limit: 100, partyId });
  const bills = usePayableBills({ limit: 100, partyId });
  const receivableCreditNotes = useReceivableCreditNotes({ limit: 100, partyId });
  const payableCreditNotes = usePayableCreditNotes({ limit: 100, partyId });
  // An entity's own page only ever shows its AP/AR documents — cashbook entries aren't
  // resolved against a party the same way, so they're fetched but left out of that scoped
  // view's merged list below.
  const cashbookTransactions = useCashbookTransactions({ limit: 100 });

  const isLoading =
    invoices.isLoading ||
    bills.isLoading ||
    receivableCreditNotes.isLoading ||
    payableCreditNotes.isLoading ||
    (!partyId && cashbookTransactions.isLoading);

  const transactions = useMemo<UnifiedTransactionRow[]>(() => {
    const all = [
      ...(invoices.data?.items ?? []).map(toDocumentRow),
      ...(bills.data?.items ?? []).map(toDocumentRow),
      ...(receivableCreditNotes.data?.items ?? []).map(toDocumentRow),
      ...(payableCreditNotes.data?.items ?? []).map(toDocumentRow),
      ...(!partyId
        ? (cashbookTransactions.data?.items ?? [])
            .filter((cb) => cb.sourceModule !== 'ACCOUNTING')
            .map(toCashbookRow)
        : []),
    ];
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [
    invoices.data,
    bills.data,
    receivableCreditNotes.data,
    payableCreditNotes.data,
    cashbookTransactions.data,
    partyId,
  ]);

  // On an entity's page, "New Transaction" doesn't make sense — offer the payment
  // action for whichever side actually has documents here instead.
  const bulkPaymentSide = useMemo(() => {
    const payableCount = transactions.filter((t) => t.filterSide === 'PAYABLE').length;
    const receivableCount = transactions.filter((t) => t.filterSide === 'RECEIVABLE').length;
    return payableCount > receivableCount ? 'PAYABLE' : 'RECEIVABLE';
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (typeFilter && r.filterSide !== typeFilter) return false;
      if (!q) return true;
      return (
        r.transactionNumber.toLowerCase().includes(q) ||
        r.entityLabel.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    });
  }, [search, statusFilter, typeFilter, transactions]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns = useMemo<Column<UnifiedTransactionRow>[]>(
    () => [
      {
        key: 'transactionNumber',
        label: 'Transaction ID',
        width: '160px',
        render: (row) => (
          <div className="flex flex-col items-start gap-0.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
              {row.transactionNumber}
            </span>
            {row.linkedTo && (
              <span className="max-w-full truncate text-xs text-gray-500">
                Linked to {row.linkedTo}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'date',
        label: 'Date',
        width: '80px',
        render: (row) => <span className="text-sm text-gray-700">{fmtDate(row.date)}</span>,
      },
      {
        key: 'entity',
        label: 'Entity',
        width: 'minmax(120px, 1fr)',
        render: (row) => (
          <span className="text-sm text-gray-800 font-medium truncate">{row.entityLabel}</span>
        ),
      },
      {
        key: 'subtotalAmount',
        label: 'Subtotal',
        width: '130px',
        className: 'text-right pr-6',
        render: (row) => (
          <span className="block text-right text-sm text-gray-700">
            {row.subtotalAmount === null ? '—' : fmtAmount(row.subtotalAmount, row.currency)}
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
            {row.taxAmount === null ? '—' : fmtAmount(row.taxAmount, row.currency)}
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
        key: 'type',
        label: 'Type',
        width: '90px',
        render: (row) => <TypeChip label={row.typeLabel} color={row.typeColor} />,
      },
      {
        key: 'status',
        label: 'Status',
        width: '90px',
        render: (row) => (
          <div className="flex flex-col gap-0.5">
            <Badge label={STATUS_LABEL[row.status]} variant={STATUS_VARIANT[row.status]} />
            {row.paymentStateLabel && (
              <span className="font-semibold text-xs text-gray-500">{row.paymentStateLabel}</span>
            )}
          </div>
        ),
      },
      {
        key: 'actions',
        label: '',
        width: '170px',
        render: (row) => (
          <div className="flex items-center justify-end gap-3" onClick={(e) => e.stopPropagation()}>
            {row.kind === 'document' ? (
              row.document!.status === 'DRAFT' ? (
                <TableButton variant="green" onClick={() => setDetailTarget(row.document!)}>
                  Post
                </TableButton>
              ) : row.document!.status === 'POSTED' &&
                row.document!.documentType !== 'CREDIT_NOTE' &&
                row.document!.paymentState !== 'PAID' ? (
                <TableButton variant="green" onClick={() => setPaymentTarget(row.document!)}>
                  {row.document!.side === 'RECEIVABLE' ? 'Receive Payment' : 'Make Payment'}
                </TableButton>
              ) : null
            ) : row.cashbook!.status === 'DRAFT' ? (
              <TableButton variant="green" onClick={() => setCashbookDetailTarget(row.cashbook!)}>
                {cashbookActionLabel(row.cashbook!.direction)}
              </TableButton>
            ) : null}
            <TableButton
              variant="blue"
              tooltip="View Details"
              onClick={() =>
                row.kind === 'document'
                  ? setDetailTarget(row.document!)
                  : setCashbookDetailTarget(row.cashbook!)
              }
            >
              <Icons.FileText className="w-3.5 h-3.5" />
            </TableButton>
          </div>
        ),
      },
    ],
    [],
  );

  const extraFilters = (
    <>
      <SearchSelect
        size="sm"
        placeholder="Status"
        options={STATUS_FILTER_OPTIONS}
        value={statusFilter}
        showAllOption
        onChange={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
      />
      <SearchSelect
        size="sm"
        placeholder="Type"
        options={TYPE_FILTER_OPTIONS}
        value={typeFilter}
        showAllOption
        onChange={(v) => {
          setTypeFilter(v);
          setPage(1);
        }}
      />
    </>
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
        extraFilters={extraFilters}
        onRowClick={(row) =>
          row.kind === 'document'
            ? setDetailTarget(row.document!)
            : setCashbookDetailTarget(row.cashbook!)
        }
        actionButton={
          partyId
            ? {
                label: bulkPaymentSide === 'PAYABLE' ? 'Make Payment' : 'Receive Payment',
                onClick: () => setBulkPaymentOpen(true),
              }
            : { label: 'New Transaction', onClick: () => setNewTransactionOpen(true) }
        }
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
        ) : selectableTypes.length === 0 ? (
          <p className="text-sm text-gray-500">
            No transaction types configured yet. Add one under Settings → Transaction Types.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {selectableTypes.map((type) => {
              // A rule and a source are each independently sufficient to use a type — applies
              // uniformly, including cashbook (Receipt/Payment/Charge/Adjustment) types: every
              // type must be deliberately configured with at least one before it's usable,
              // rather than falling back to ad hoc free-form account picking.
              const hasRule = type.rulesCount > 0;
              const hasSource = Boolean(type.sourceTypeId);
              const canSelect = hasRule || hasSource;
              return (
                <button
                  key={type.id}
                  type="button"
                  disabled={!canSelect}
                  onClick={() => {
                    if (!canSelect) return;
                    setNewTransactionOpen(false);
                    setSelectedType(type);
                  }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-gray-900">{type.name}</span>
                    {type.description && (
                      <span className="text-xs text-gray-500">{type.description}</span>
                    )}
                    {!canSelect && (
                      <span className="text-xs text-orange-600">
                        Rule or source required to use
                      </span>
                    )}
                  </div>
                  <TypeChip
                    label={TRANSACTION_TYPE_CATEGORY_LABEL[type.category]}
                    color={TRANSACTION_TYPE_CATEGORY_CHIP_COLOR[type.category]}
                  />
                </button>
              );
            })}
          </div>
        )}
      </Modal>

      <NewTransactionPanel
        transactionType={selectedType}
        onClose={() => setSelectedType(undefined)}
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

      <CashbookTransactionDetailPanel
        transaction={cashbookDetailTarget}
        onClose={() => setCashbookDetailTarget(null)}
      />

      {partyId && (
        <BulkPaymentPanel
          isOpen={bulkPaymentOpen}
          onClose={() => setBulkPaymentOpen(false)}
          side={bulkPaymentSide}
          partyId={partyId}
        />
      )}
    </>
  );
}
