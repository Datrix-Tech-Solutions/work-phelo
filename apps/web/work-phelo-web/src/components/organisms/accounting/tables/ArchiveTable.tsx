'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { TableButton } from '@/components/atoms/TableButton';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { CashbookTransactionDetailPanel } from '@/components/organisms/accounting/panels/CashbookTransactionDetailPanel';
import { JournalDetailPanel } from '@/components/organisms/accounting/panels/JournalDetailPanel';
import {
  DeleteArchivedEntryModal,
  DeleteArchivedTarget,
} from '@/components/organisms/accounting/panels/DeleteArchivedEntryModal';
import { TradeDocumentDetailPanel } from '@/components/organisms/accounting/panels/TradeDocumentDetailPanel';
import { TradeSettlementDetailPanel } from '@/components/organisms/accounting/panels/TradeSettlementDetailPanel';
import {
  useArchive,
  useCashbookTransaction,
  useJournal,
  usePayableBill,
  usePayableCreditNote,
  usePayablePayment,
  useReceivableCreditNote,
  useReceivableInvoice,
  useReceivableReceipt,
} from '@/hooks';
import type { ArchiveItem, ArchiveKind } from '@/types/accounting';

const PAGE_SIZE = 10;

const KIND_LABEL: Record<ArchiveKind, string> = {
  JOURNAL: 'Journal entry',
  CASHBOOK: 'Transaction',
  INVOICE: 'Invoice',
  CREDIT_NOTE: 'Credit note',
  RECEIPT: 'Receipt',
  BILL: 'Bill',
  DEBIT_NOTE: 'Debit note',
  PAYMENT: 'Payment',
};

const KIND_OPTIONS: SearchSelectOption[] = (Object.keys(KIND_LABEL) as ArchiveKind[]).map(
  (kind) => ({ value: kind, label: KIND_LABEL[kind] }),
);

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(amount: string | null, currency: string | null) {
  if (amount === null) return '—';
  const value = Number(amount);
  const formatted = Number.isFinite(value)
    ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : amount;
  return currency ? `${currency} ${formatted}` : formatted;
}

/** Every voided entry, newest void first. Opening one shows it as it was and, while its period is
 *  open, lets it be restored: a form to correct it first where there is one, or a plain confirm. */
export function ArchiveTable() {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  // The panel for a kind stays mounted after it closes, so the form it opens to restore an entry
  // outlives the panel itself.
  const [panelKind, setPanelKind] = useState<ArchiveKind | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<
    DeleteArchivedTarget | DeleteArchivedTarget[] | null
  >(null);
  // Entries ticked for a bulk delete, as `${kind}:${id}`.
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  const { data, isLoading } = useArchive({
    kind: (kind || undefined) as ArchiveKind | undefined,
    search: search.trim() || undefined,
    limit: 200,
  });
  const items = data?.items ?? [];
  const keyOf = (row: ArchiveItem) => `${row.kind}:${row.id}`;
  // Only what is still listed counts, so a filter can't leave hidden entries selected.
  const selectedItems = items.filter((row) => ticked.has(keyOf(row)));
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const paged = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const idFor = (k: ArchiveKind) => (panelKind === k ? selectedId : undefined);
  const journal = useJournal(idFor('JOURNAL'));
  const cashbook = useCashbookTransaction(idFor('CASHBOOK'));
  const invoice = useReceivableInvoice(idFor('INVOICE'));
  const creditNote = useReceivableCreditNote(idFor('CREDIT_NOTE'));
  const receipt = useReceivableReceipt(idFor('RECEIPT'));
  const bill = usePayableBill(idFor('BILL'));
  const debitNote = usePayableCreditNote(idFor('DEBIT_NOTE'));
  const payment = usePayablePayment(idFor('PAYMENT'));

  const close = () => setSelectedId(undefined);

  const open = (row: ArchiveItem) => {
    setPanelKind(row.kind);
    setSelectedId(row.id);
  };

  const askDelete = (row: ArchiveItem) => setDeleteTarget(toTarget(row));

  const toggleTick = (row: ArchiveItem) =>
    setTicked((prev) => {
      const next = new Set(prev);
      const key = keyOf(row);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const pageAllTicked = paged.length > 0 && paged.every((row) => ticked.has(keyOf(row)));
  const togglePage = () =>
    setTicked((prev) => {
      const next = new Set(prev);
      for (const row of paged) {
        if (pageAllTicked) next.delete(keyOf(row));
        else next.add(keyOf(row));
      }
      return next;
    });

  const toTarget = (row: ArchiveItem): DeleteArchivedTarget => ({
    kind: row.kind,
    id: row.id,
    subject: `${KIND_LABEL[row.kind]} ${row.number}`,
  });

  const columns: Column<ArchiveItem>[] = [
    {
      key: 'select',
      label: 'Select',
      headerRender: () => (
        <input
          type="checkbox"
          aria-label="Select all on this page"
          checked={pageAllTicked}
          onChange={togglePage}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      width: '40px',
      render: (row) => (
        <input
          type="checkbox"
          aria-label={`Select ${row.number}`}
          checked={ticked.has(keyOf(row))}
          onChange={() => toggleTick(row)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      key: 'number',
      label: 'Number',
      width: '170px',
      render: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
          {row.number}
        </span>
      ),
    },
    {
      key: 'kind',
      label: 'Type',
      width: '120px',
      render: (row) => <Badge label={KIND_LABEL[row.kind]} variant="neutral" />,
    },
    {
      key: 'date',
      label: 'Date',
      width: '110px',
      render: (row) => (
        <span className="font-semibold text-gray-700 text-sm">{fmtDate(row.date)}</span>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      width: 'minmax(120px, 1fr)',
      render: (row) => (
        <span className="flex flex-col text-sm text-gray-700" title={row.description ?? ''}>
          <span className="font-semibold truncate">{row.description ?? '—'}</span>
          {row.party && <span className="text-xs text-gray-500 truncate">{row.party}</span>}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      width: '150px',
      className: 'text-right',
      render: (row) => (
        <span className="block text-right text-sm font-medium text-gray-900">
          {fmtAmount(row.amount, row.currency)}
        </span>
      ),
    },
    {
      key: 'reason',
      label: 'Why it was voided',
      width: 'minmax(120px, 1fr)',
      render: (row) => (
        <span className="flex flex-col text-sm text-gray-700" title={row.voidReason ?? ''}>
          <span className="truncate">{row.voidReason ?? '—'}</span>
          <span className="text-xs text-gray-500">Voided {fmtDate(row.voidedAt)}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '170px',
      className: 'pr-6',
      render: (row) => (
        <div className="flex items-center gap-2">
          {/* Restoring may need a form to correct the entry first, so it opens the entry. */}
          {row.restorable && (
            <TableButton
              variant="green"
              onClick={(e) => {
                e.stopPropagation();
                open(row);
              }}
            >
              Restore
            </TableButton>
          )}
          <TableButton
            variant="red"
            onClick={(e) => {
              e.stopPropagation();
              askDelete(row);
            }}
          >
            Delete
          </TableButton>
        </div>
      ),
    },
  ];

  const extraFilters = (
    <SearchSelect
      size="sm"
      placeholder="Type"
      options={KIND_OPTIONS}
      value={kind}
      showAllOption
      onChange={(v) => {
        setKind(v);
        setPage(1);
        setTicked(new Set());
      }}
    />
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search the archive…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
          setTicked(new Set());
        }}
        extraFilters={extraFilters}
        actionButton={{
          label: selectedItems.length > 0 ? `Delete (${selectedItems.length})` : 'Delete',
          variant: 'danger',
          disabled: selectedItems.length === 0,
          title: selectedItems.length === 0 ? 'Tick entries to delete them together' : undefined,
          onClick: () => setDeleteTarget(selectedItems.map(toTarget)),
        }}
        onRowClick={open}
        emptyMessage="Nothing has been voided"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <DeleteArchivedEntryModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => setTicked(new Set())}
      />

      {panelKind === 'JOURNAL' && (
        <JournalDetailPanel journal={journal.data ?? null} onClose={close} />
      )}
      {panelKind === 'CASHBOOK' && (
        <CashbookTransactionDetailPanel transaction={cashbook.data ?? null} onClose={close} />
      )}
      {panelKind === 'INVOICE' && (
        <TradeDocumentDetailPanel
          side="RECEIVABLE"
          document={invoice.data ?? null}
          onClose={close}
        />
      )}
      {panelKind === 'CREDIT_NOTE' && (
        <TradeDocumentDetailPanel
          side="RECEIVABLE"
          documentKind="creditNote"
          document={creditNote.data ?? null}
          onClose={close}
        />
      )}
      {panelKind === 'BILL' && (
        <TradeDocumentDetailPanel side="PAYABLE" document={bill.data ?? null} onClose={close} />
      )}
      {panelKind === 'DEBIT_NOTE' && (
        <TradeDocumentDetailPanel
          side="PAYABLE"
          documentKind="creditNote"
          document={debitNote.data ?? null}
          onClose={close}
        />
      )}
      {panelKind === 'RECEIPT' && (
        <TradeSettlementDetailPanel
          side="RECEIVABLE"
          settlement={receipt.data ?? null}
          onClose={close}
        />
      )}
      {panelKind === 'PAYMENT' && (
        <TradeSettlementDetailPanel
          side="PAYABLE"
          settlement={payment.data ?? null}
          onClose={close}
        />
      )}
    </>
  );
}
