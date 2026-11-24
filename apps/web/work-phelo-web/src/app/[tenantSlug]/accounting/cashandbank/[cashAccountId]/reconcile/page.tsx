'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';
import { cardClass, cn } from '@/lib/utils';
import { ReconcileList, type ReconcileItem } from '@/components/organisms/accounting/ReconcileList';
import { formatJournalNumber } from '@/lib/formatters';
import { formatSourceEventDescription } from '@/config/reinsurance-event-catalog';
import {
  useCashAccount,
  useCompleteBankReconciliation,
  useGLAccountLedger,
  useReconciledJournalLineIds,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { useBankStatementDraftStore } from '@/store/bankStatementDraft.store';
import { extractError } from '@/lib/extractError';

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('en-GB') : '—';
}

function parseAmount(value: string | null) {
  if (value === null || value.trim() === '') return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : undefined;
}

function formatAmount(value: number | undefined, currency: string) {
  if (value === undefined) return '—';
  return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ReconcileCashAccountPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; cashAccountId: string }>;
}) {
  const { tenantSlug, cashAccountId } = use(params);
  const searchParams = useSearchParams();
  const fromDate = searchParams.get('from');
  const toDate = searchParams.get('to');
  const bankOpening = parseAmount(searchParams.get('bankOpening'));
  const bankClosing = parseAmount(searchParams.get('bankClosing'));

  const router = useRouter();
  const toast = useToast();
  const { data: account, isLoading } = useCashAccount(cashAccountId);
  const { data: ledger } = useGLAccountLedger(account?.glAccountId ?? '');
  const { data: alreadyReconciled } = useReconciledJournalLineIds(cashAccountId);
  const { mutateAsync: completeReconciliation, isPending: isSaving } =
    useCompleteBankReconciliation();
  const statementRows = useBankStatementDraftStore((state) => state.rowsByAccount[cashAccountId]);
  const clearRows = useBankStatementDraftStore((state) => state.clearRows);
  const [selectedSystem, setSelectedSystem] = useState<Set<string>>(new Set());
  const [selectedBank, setSelectedBank] = useState<Set<string>>(new Set());
  // Rows the user has ticked off as reconciled on each side.
  const [reconciledSystem, setReconciledSystem] = useState<Set<string>>(new Set());
  const [reconciledBank, setReconciledBank] = useState<Set<string>>(new Set());
  // Each Remove reconciled click is one group: the rows taken out together, kept as a pair.
  const [groups, setGroups] = useState<{ systemIds: string[]; bankIds: string[] }[]>([]);
  const base = `/${tenantSlug}/accounting/cashandbank`;

  // Running balances are in the base currency, the same figures the ledger table shows.
  const { opening, closing, currency } = useMemo(() => {
    const entries = ledger?.entries ?? [];
    const day = (entry: (typeof entries)[number]) =>
      entry.journalEntry.transactionDate.slice(0, 10);
    const upTo = entries.filter((entry) => !toDate || day(entry) <= toDate);
    // An opening-balance journal dated on the first day is the opening position, not period activity.
    const isOpening = (entry: (typeof entries)[number]) =>
      !!fromDate &&
      (day(entry) < fromDate ||
        (day(entry) === fromDate && entry.journalEntry.entryType === 'OPENING'));
    let previous = 0;
    let openingBalance = 0;
    for (const entry of entries) {
      const running = Number(entry.runningBalance);
      if (isOpening(entry)) openingBalance += running - previous;
      previous = running;
    }
    const closingBalance = upTo.length ? Number(upTo[upTo.length - 1].runningBalance) : 0;
    return {
      opening: ledger ? openingBalance : undefined,
      closing: ledger ? closingBalance : undefined,
      currency: entries[0]?.journalEntry.baseCurrency ?? account?.currency ?? '',
    };
  }, [ledger, fromDate, toDate, account?.currency]);

  // Ledger entries inside the period. The opening-balance journal is the opening position, so it
  // is not listed here.
  const systemItems = useMemo<ReconcileItem[]>(
    () =>
      (ledger?.entries ?? [])
        .filter((entry) => {
          const day = entry.journalEntry.transactionDate.slice(0, 10);
          return (
            (!fromDate || day >= fromDate) &&
            (!toDate || day <= toDate) &&
            entry.journalEntry.entryType !== 'OPENING' &&
            // Entries an earlier reconciliation already covered are done with.
            !alreadyReconciled?.has(entry.id)
          );
        })
        .map((entry) => ({
          id: entry.id,
          date: entry.journalEntry.transactionDate,
          reference: formatJournalNumber(entry.journalEntry.journalNumber),
          description:
            formatSourceEventDescription(entry.description ?? entry.journalEntry.description) ?? '',
          currency: entry.journalEntry.baseCurrency,
          debit: Number(entry.baseDebit),
          credit: Number(entry.baseCredit),
        })),
    [ledger, fromDate, toDate, alreadyReconciled],
  );

  // The statement values brought from the uploaded sheet.
  const bankItems = useMemo<ReconcileItem[]>(
    () =>
      (statementRows ?? []).map((row) => ({
        id: row.id,
        date: row.date,
        reference: row.reference,
        description: row.description,
        currency: account?.currency ?? '',
        debit: row.moneyIn,
        credit: row.moneyOut,
      })),
    [statementRows, account?.currency],
  );

  // What the user has ticked off must agree on both sides before it can be saved.
  const net = (items: ReconcileItem[], ids: Set<string>) =>
    items.reduce((sum, item) => (ids.has(item.id) ? sum + item.debit - item.credit : sum), 0);
  // The rows ticked right now, before they are taken out as reconciled.
  const selectedSystemTotal = net(systemItems, selectedSystem);
  const selectedBankTotal = net(bankItems, selectedBank);
  const selectionDifference = selectedBankTotal - selectedSystemTotal;
  const selectionBalanced = Math.abs(selectionDifference) < 0.005;
  const bothSidesSelected = selectedSystem.size > 0 && selectedBank.size > 0;
  const oneSideSelected = selectedSystem.size > 0 !== selectedBank.size > 0;
  const canRemove = bothSidesSelected && selectionBalanced;
  const removeBlocker = !bothSidesSelected
    ? 'Tick a row on each side'
    : !selectionBalanced
      ? 'The two sides must agree. A system debit pairs with a bank credit, a system credit with a bank debit.'
      : null;

  const removeReconciled = () => {
    if (!canRemove) return;
    setReconciledSystem(new Set([...reconciledSystem, ...selectedSystem]));
    setReconciledBank(new Set([...reconciledBank, ...selectedBank]));
    setGroups([...groups, { systemIds: [...selectedSystem], bankIds: [...selectedBank] }]);
    setSelectedSystem(new Set());
    setSelectedBank(new Set());
  };

  // Bringing removed rows back undoes every group, so nothing is left half reconciled.
  const restoreAll = () => {
    setReconciledSystem(new Set());
    setReconciledBank(new Set());
    setGroups([]);
  };

  const reconciledSystemTotal = net(systemItems, reconciledSystem);
  const reconciledBankTotal = net(bankItems, reconciledBank);
  const reconciledDifference = reconciledBankTotal - reconciledSystemTotal;
  const reconciledBalanced = Math.abs(reconciledDifference) < 0.005;
  const hasReconciled = reconciledSystem.size > 0 || reconciledBank.size > 0;

  const canSave =
    !!account &&
    !!fromDate &&
    !!toDate &&
    bankOpening !== undefined &&
    bankClosing !== undefined &&
    bankItems.length > 0 &&
    hasReconciled &&
    reconciledBalanced;

  const saveBlocker = !statementRows
    ? 'Upload a bank statement to reconcile'
    : !hasReconciled
      ? 'Tick off the transactions you have checked'
      : !reconciledBalanced
        ? 'The reconciled bank and system totals must agree'
        : null;

  const groupOf = (id: string, side: 'systemIds' | 'bankIds') => {
    const index = groups.findIndex((group) => group[side].includes(id));
    return index === -1 ? undefined : index + 1;
  };

  const reconcile = async () => {
    if (!account || !canSave || bankOpening === undefined || bankClosing === undefined) return;
    try {
      const saved = await completeReconciliation({
        cashAccountId,
        statementStartDate: fromDate!,
        statementEndDate: toDate!,
        openingBalance: bankOpening,
        closingBalance: bankClosing,
        currency: account.currency,
        statementLines: (statementRows ?? []).map((row) => ({
          transactionDate: row.date,
          amount: Math.round((row.moneyIn - row.moneyOut) * 100) / 100,
          description: row.description || undefined,
          bankReference: row.reference || undefined,
          runningBalance: row.balance,
          matchGroup: groupOf(row.id, 'bankIds'),
        })),
        reconciledEntries: groups.flatMap((group, index) =>
          group.systemIds.map((journalLineId) => ({ journalLineId, matchGroup: index + 1 })),
        ),
      });
      clearRows(cashAccountId);
      toast.success('Account reconciled');
      router.push(`${base}/${cashAccountId}/reconciliations/${saved.id}`);
    } catch (error) {
      toast.error(extractError(error, 'Unable to reconcile this account'));
    }
  };

  // Bank less system: zero once the two agree.
  const difference = (bank: number | undefined, system: number | undefined) =>
    bank !== undefined && system !== undefined ? bank - system : undefined;
  const rows = [
    { label: 'Opening Balance', bank: bankOpening, system: opening },
    { label: 'Closing Balance', bank: bankClosing, system: closing },
  ];

  return (
    <div className="flex flex-col gap-6 py-6 pr-6 pl-(--page-pl) min-h-0 overflow-y-auto flex-1">
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Cash and Bank
        </Link>
        <Icons.ChevronRight className="w-5 h-5" />
        <Link href={`${base}/${cashAccountId}`} className="hover:text-gray-700 transition-colors">
          {account?.name ?? '—'}
        </Link>
        <Icons.ChevronRight className="w-5 h-5" />
        <span className="text-gray-700 font-medium">Reconcile</span>
      </nav>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
      ) : !account ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          Account not found.
        </div>
      ) : (
        <>
          <div className={cardClass('px-5 py-4 flex flex-col gap-4')}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-base font-semibold text-gray-900">{account.name}</h1>
              <span className="text-sm text-gray-400">
                {account.currency} · {formatDate(fromDate)} – {formatDate(toDate)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {rows.map((row) => {
                const diff = difference(row.bank, row.system);
                const balanced = diff !== undefined && Math.abs(diff) < 0.005;
                return (
                  <div
                    key={row.label}
                    className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-gray-50 px-4 py-3"
                  >
                    <div className="flex flex-col min-w-28">
                      <span className="text-xs font-semibold text-gray-500">{row.label}</span>
                      <span className="text-xs text-gray-400">Bank vs System</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400">Bank</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatAmount(row.bank, currency)}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400">System</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatAmount(row.system, currency)}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium',
                        diff === undefined
                          ? 'bg-gray-100 text-gray-500'
                          : balanced
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-700',
                      )}
                    >
                      {balanced ? 'Balanced' : `Diff ${formatAmount(diff, currency)}`}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-gray-50 px-4 py-3">
              <div className="flex flex-col min-w-28">
                <span className="text-xs font-semibold text-gray-500">Reconciled</span>
                <span className="text-xs text-gray-400">Ticked off so far</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-400">Bank</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatAmount(reconciledBankTotal, currency)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-400">System</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatAmount(reconciledSystemTotal, currency)}
                </span>
              </div>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  !hasReconciled
                    ? 'bg-gray-100 text-gray-500'
                    : reconciledBalanced
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700',
                )}
              >
                {!hasReconciled
                  ? 'Nothing ticked off'
                  : reconciledBalanced
                    ? 'Balanced'
                    : `Diff ${formatAmount(reconciledDifference, currency)}`}
              </span>
              <div className="ml-auto flex items-center gap-3">
                {saveBlocker && <span className="text-xs text-gray-400">{saveBlocker}</span>}
                <Button onClick={reconcile} disabled={!canSave} isLoading={isSaving}>
                  Reconcile
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-gray-100 px-4 py-3">
            <span className="text-xs font-semibold text-gray-500">Selected</span>
            <div className="flex flex-col">
              <span className="text-xs text-gray-400">Bank</span>
              <span className="text-sm font-medium text-gray-900">
                {formatAmount(selectedBankTotal, currency)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-400">System</span>
              <span className="text-sm font-medium text-gray-900">
                {formatAmount(selectedSystemTotal, currency)}
              </span>
            </div>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium',
                !bothSidesSelected
                  ? 'bg-gray-100 text-gray-500'
                  : selectionBalanced
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700',
              )}
            >
              {oneSideSelected
                ? 'Select the equivalent on the other side'
                : !bothSidesSelected
                  ? 'Nothing selected'
                  : selectionBalanced
                    ? 'Balanced'
                    : `Diff ${formatAmount(selectionDifference, currency)}`}
            </span>
            <div className="ml-auto flex items-center gap-3">
              {removeBlocker && bothSidesSelected && (
                <span className="max-w-sm text-xs text-gray-400">{removeBlocker}</span>
              )}
              <Button variant="secondary" onClick={removeReconciled} disabled={!canRemove}>
                Remove reconciled
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <ReconcileList
              title="System"
              perspective="ledger"
              items={systemItems}
              selectedIds={selectedSystem}
              onSelectionChange={setSelectedSystem}
              reconciledIds={reconciledSystem}
              onReconciledChange={restoreAll}
              dimUnselected={selectedSystem.size > 0 && selectedBank.size === 0}
              matched={canRemove}
              isLoading={!ledger}
              emptyMessage="No ledger entries in this period"
            />
            <ReconcileList
              title="Bank Statement"
              perspective="bank"
              items={bankItems}
              selectedIds={selectedBank}
              onSelectionChange={setSelectedBank}
              reconciledIds={reconciledBank}
              onReconciledChange={restoreAll}
              dimUnselected={selectedBank.size > 0 && selectedSystem.size === 0}
              matched={canRemove}
              emptyMessage="No bank statement uploaded — go back and upload one to reconcile"
            />
          </div>
        </>
      )}
    </div>
  );
}
