'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { extractError } from '@/lib/extractError';
import {
  useBalanceSheetReport,
  useGeneralLedgerReport,
  useIncomeStatementReport,
  useTrialBalanceReport,
} from '@/hooks/accounting/useFinancialReports';
import type { FinancialReportAccount } from '@/types/accounting';

type ReportKind = 'trial-balance' | 'income-statement' | 'balance-sheet' | 'general-ledger';
type Row = {
  id: string;
  account: FinancialReportAccount;
  debit?: string;
  credit?: string;
  amount?: string;
  journalDate?: string;
  journalNumber?: string;
  description?: string | null;
  runningBalance?: string;
};

const label: Record<ReportKind, string> = {
  'trial-balance': 'Trial Balance',
  'income-statement': 'Income Statement',
  'balance-sheet': 'Balance Sheet',
  'general-ledger': 'General Ledger',
};

const money = (value: string) =>
  Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const startOfYear = () => `${new Date().getFullYear()}-01-01`;

const statementColumns: Column<Row>[] = [
  {
    key: 'account',
    label: 'Account',
    render: (row) => `${row.account.code} — ${row.account.name}`,
  },
  {
    key: 'amount',
    label: 'Amount',
    width: '180px',
    render: (row) => (
      <span className="block text-right font-medium">{money(row.amount ?? '0')}</span>
    ),
  },
];
const trialColumns: Column<Row>[] = [
  {
    key: 'account',
    label: 'Account',
    render: (row) => `${row.account.code} — ${row.account.name}`,
  },
  {
    key: 'debit',
    label: 'Debit',
    width: '180px',
    render: (row) => <span className="block text-right">{money(row.debit ?? '0')}</span>,
  },
  {
    key: 'credit',
    label: 'Credit',
    width: '180px',
    render: (row) => <span className="block text-right">{money(row.credit ?? '0')}</span>,
  },
];
const ledgerColumns: Column<Row>[] = [
  {
    key: 'date',
    label: 'Date',
    width: '120px',
    render: (row) =>
      row.journalDate ? new Date(row.journalDate).toLocaleDateString('en-GB') : '—',
  },
  { key: 'journal', label: 'Journal', width: '140px', render: (row) => row.journalNumber ?? '—' },
  {
    key: 'account',
    label: 'Account',
    render: (row) => `${row.account.code} — ${row.account.name}`,
  },
  { key: 'description', label: 'Description', render: (row) => row.description ?? '—' },
  {
    key: 'debit',
    label: 'Debit',
    width: '140px',
    render: (row) => <span className="block text-right">{money(row.debit ?? '0')}</span>,
  },
  {
    key: 'credit',
    label: 'Credit',
    width: '140px',
    render: (row) => <span className="block text-right">{money(row.credit ?? '0')}</span>,
  },
  {
    key: 'balance',
    label: 'Balance',
    width: '150px',
    render: (row) => (
      <span className="block text-right font-medium">{money(row.runningBalance ?? '0')}</span>
    ),
  },
];

export function FinancialReportView({ kind }: { kind: ReportKind }) {
  const [fromDate, setFromDate] = useState(startOfYear);
  const [toDate, setToDate] = useState(today);
  const [asOfDate, setAsOfDate] = useState(today);
  const [generated, setGenerated] = useState(false);
  const [page, setPage] = useState(1);
  const [includeZeroBalances, setIncludeZeroBalances] = useState(false);

  const income = useIncomeStatementReport(
    { fromDate, toDate },
    generated && kind === 'income-statement',
  );
  const trial = useTrialBalanceReport(
    { asOfDate, includeZeroBalances },
    generated && kind === 'trial-balance',
  );
  const balance = useBalanceSheetReport({ asOfDate }, generated && kind === 'balance-sheet');
  const ledger = useGeneralLedgerReport(
    { fromDate, toDate },
    generated && kind === 'general-ledger',
  );
  const active =
    kind === 'income-statement'
      ? income
      : kind === 'trial-balance'
        ? trial
        : kind === 'balance-sheet'
          ? balance
          : ledger;

  const rows: Row[] =
    kind === 'trial-balance'
      ? Object.values(trial.data?.accounts ?? {})
          .flat()
          .map((entry) => ({
            id: entry.account.id,
            account: entry.account,
            debit: entry.debitBalance,
            credit: entry.creditBalance,
          }))
      : kind === 'income-statement'
        ? [...(income.data?.revenueAccounts ?? []), ...(income.data?.expenseAccounts ?? [])].map(
            (entry) => ({ id: entry.account.id, ...entry }),
          )
        : kind === 'balance-sheet'
          ? [
              ...(balance.data?.assets ?? []),
              ...(balance.data?.liabilities ?? []),
              ...(balance.data?.equity ?? []),
            ].map((entry) => ({ id: entry.account.id, ...entry }))
          : (ledger.data?.lines ?? []).map((entry, index) => ({
              id: `${entry.journalNumber}-${index}`,
              account: entry.account,
              debit: entry.debit,
              credit: entry.credit,
              journalDate: entry.journalDate,
              journalNumber: entry.journalNumber,
              description: entry.description,
              runningBalance: entry.runningBalance,
            }));
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const paged = rows.slice((page - 1) * pageSize, page * pageSize);
  const isDateRange = kind === 'income-statement' || kind === 'general-ledger';
  const totals =
    kind === 'trial-balance'
      ? `Debit ${money(trial.data?.totalDebit ?? '0')} · Credit ${money(trial.data?.totalCredit ?? '0')}`
      : kind === 'income-statement'
        ? `Revenue ${money(income.data?.totalRevenue ?? '0')} · Expenses ${money(income.data?.totalExpenses ?? '0')} · Net ${money(income.data?.netProfitOrLoss ?? '0')}`
        : kind === 'balance-sheet'
          ? `Assets ${money(balance.data?.totalAssets ?? '0')} · Liabilities ${money(balance.data?.totalLiabilities ?? '0')} · Equity ${money(balance.data?.totalEquity ?? '0')}`
          : `Opening ${money(ledger.data?.openingBalance ?? '0')} · Debit ${money(ledger.data?.totalDebit ?? '0')} · Credit ${money(ledger.data?.totalCredit ?? '0')} · Closing ${money(ledger.data?.closingBalance ?? '0')}`;

  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-4">
          {isDateRange ? (
            <>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                From date
                <input
                  className="rounded-lg border border-gray-300 px-3 py-2"
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                To date
                <input
                  className="rounded-lg border border-gray-300 px-3 py-2"
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </label>
            </>
          ) : (
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              As at date
              <input
                className="rounded-lg border border-gray-300 px-3 py-2"
                type="date"
                value={asOfDate}
                onChange={(event) => setAsOfDate(event.target.value)}
              />
            </label>
          )}
          {kind === 'trial-balance' && (
            <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={includeZeroBalances}
                onChange={(event) => setIncludeZeroBalances(event.target.checked)}
              />{' '}
              Include zero balances
            </label>
          )}
          <Button
            onClick={() => {
              setPage(1);
              setGenerated(true);
            }}
          >
            Generate Report
          </Button>
        </div>
      </div>
      {!generated ? (
        <p className="py-12 text-center text-sm text-gray-400">
          Choose report dates and generate the report.
        </p>
      ) : active.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Unable to load {label[kind].toLowerCase()}: {extractError(active.error)}
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{label[kind]}</h2>
            <p className="mt-1 text-sm text-gray-500">{totals}</p>
          </div>
          <DataTable
            columns={
              kind === 'general-ledger'
                ? ledgerColumns
                : kind === 'trial-balance'
                  ? trialColumns
                  : statementColumns
            }
            data={paged}
            isLoading={active.isLoading}
            emptyMessage="No posted accounting activity matches this report."
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            noInternalScroll
          />
        </>
      )}
    </section>
  );
}
