'use client';

import { use } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/atoms/Badge';
import { Icons } from '@/components/atoms/icons';
import { useBankReconciliation } from '@/hooks';
import { formatDate, formatJournalNumber } from '@/lib/formatters';
import { formatSourceEventDescription } from '@/config/reinsurance-event-catalog';
import { cardClass } from '@/lib/utils';

function money(value: number | string, currency: string) {
  return `${currency} ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Amount({ value, currency }: { value: number; currency: string }) {
  return value < 0 ? (
    <span className="text-red-600">({money(Math.abs(value), currency)})</span>
  ) : (
    <span>{money(value, currency)}</span>
  );
}

function SectionHeading({ label, count }: { label: string; count: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</h3>
      <span className="ml-auto text-xs text-gray-400">{count}</span>
    </div>
  );
}

/** One row on either side. The label is the debit or credit as that side's own document shows it. */
function Row({
  date,
  reference,
  description,
  amount,
  currency,
  label,
}: {
  date: string;
  reference: string;
  description: string;
  amount: number;
  currency: string;
  label: 'Dr' | 'Cr';
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="w-24 shrink-0">
        <p className="text-sm text-gray-900">{formatDate(date)}</p>
        <p className="text-xs text-gray-400 truncate">{reference}</p>
      </div>
      <p className="flex-1 min-w-0 text-sm text-gray-700 break-words">{description}</p>
      <p className="shrink-0 text-sm font-medium text-gray-900 text-right inline-flex items-baseline gap-1.5">
        <Amount value={amount} currency={currency} />
        <span className="w-4 text-left text-xs font-normal text-gray-400">{label}</span>
      </p>
    </div>
  );
}

export default function BankReconciliationDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; cashAccountId: string; reconciliationId: string }>;
}) {
  const { tenantSlug, cashAccountId, reconciliationId } = use(params);
  const { data: reconciliation, isLoading } = useBankReconciliation(reconciliationId);
  const base = `/${tenantSlug}/accounting/cashandbank`;

  const currency = reconciliation?.currency ?? '';
  const systemRows = (reconciliation?.reconciledEntries ?? []).map(
    ({ id, matchGroup, journalLine }) => ({
      id,
      // Records saved before groups existed have none; they count as group 0, like their bank rows.
      matchGroup: matchGroup ?? 0,
      date: journalLine.journalEntry.transactionDate,
      reference: formatJournalNumber(journalLine.journalEntry.journalNumber),
      description:
        formatSourceEventDescription(
          journalLine.description ?? journalLine.journalEntry.description,
        ) ?? '',
      // Money in is a debit on the cash account.
      amount: Number(journalLine.baseDebit) - Number(journalLine.baseCredit),
    }),
  );
  const bankRows = reconciliation?.statementLines ?? [];
  const unreconciledBank = bankRows.filter((row) => row.status !== 'MATCHED');

  // What was taken out together is shown together: one block per group, system beside bank.
  const groupNumbers = [
    ...new Set([
      ...systemRows.map((row) => row.matchGroup),
      ...bankRows.filter((row) => row.status === 'MATCHED').map((row) => row.matchGroup ?? 0),
    ]),
  ].sort((x, y) => x - y);
  const pairs = groupNumbers.map((number) => ({
    number,
    system: systemRows.filter((row) => row.matchGroup === number),
    bank: bankRows.filter((row) => row.status === 'MATCHED' && (row.matchGroup ?? 0) === number),
  }));

  return (
    <div className="flex flex-col gap-6 py-6 pr-6 pl-(--page-pl) min-h-0 overflow-y-auto flex-1">
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Cash and Bank
        </Link>
        <Icons.ChevronRight className="w-5 h-5" />
        <Link href={`${base}/${cashAccountId}`} className="hover:text-gray-700 transition-colors">
          {reconciliation?.cashAccount.name ?? '—'}
        </Link>
        <Icons.ChevronRight className="w-5 h-5" />
        <span className="text-gray-700 font-medium">Reconciliation</span>
      </nav>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
      ) : !reconciliation ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          Reconciliation not found.
        </div>
      ) : (
        <>
          <div className={cardClass('px-5 py-4 flex flex-col gap-4')}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-base font-semibold text-gray-900">
                {reconciliation.cashAccount.name}
              </h1>
              <span className="text-sm text-gray-400">
                {formatDate(reconciliation.statementStartDate)} –{' '}
                {formatDate(reconciliation.statementEndDate)}
              </span>
              <Badge
                label={reconciliation.status === 'COMPLETED' ? 'Reconciled' : reconciliation.status}
                variant={reconciliation.status === 'COMPLETED' ? 'success' : 'neutral'}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                ['Reference', reconciliation.statementReference],
                ['Opening Balance', money(reconciliation.openingBalance, currency)],
                ['Closing Balance', money(reconciliation.closingBalance, currency)],
                [
                  'Completed',
                  reconciliation.completedAt ? formatDate(reconciliation.completedAt) : '—',
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col">
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className="text-sm font-medium text-gray-900 break-words">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={cardClass('flex flex-col min-w-0')}>
            <div className="grid grid-cols-2 border-b border-gray-100 text-sm font-semibold text-gray-900">
              <h2 className="px-4 py-3">System</h2>
              <h2 className="px-4 py-3 border-l border-gray-100">Bank Statement</h2>
            </div>

            <SectionHeading
              label="Reconciled"
              count={`${pairs.length} ${pairs.length === 1 ? 'group' : 'groups'}`}
            />
            {pairs.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-sm text-gray-400">
                Nothing was reconciled
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {pairs.map((pair) => (
                  <li key={pair.number} className="grid grid-cols-2">
                    <div className="divide-y divide-gray-50 min-w-0">
                      {pair.system.map((row) => (
                        <Row
                          key={row.id}
                          date={row.date}
                          reference={row.reference}
                          description={row.description}
                          amount={row.amount}
                          currency={currency}
                          label={row.amount < 0 ? 'Cr' : 'Dr'}
                        />
                      ))}
                    </div>
                    <div className="divide-y divide-gray-50 min-w-0 border-l border-gray-100">
                      {pair.bank.map((row) => (
                        <Row
                          key={row.id}
                          date={row.transactionDate}
                          reference={row.bankReference ?? ''}
                          description={row.description ?? ''}
                          amount={Number(row.amount)}
                          currency={row.currency}
                          label={Number(row.amount) < 0 ? 'Dr' : 'Cr'}
                        />
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <SectionHeading label="Not reconciled" count={`${unreconciledBank.length} rows`} />
            {unreconciledBank.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-sm text-gray-400">
                Every statement row was reconciled
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {unreconciledBank.map((row) => (
                  <li key={row.id} className="grid grid-cols-2 bg-gray-50">
                    <div />
                    <div className="min-w-0 border-l border-gray-100">
                      <Row
                        date={row.transactionDate}
                        reference={row.bankReference ?? ''}
                        description={row.description ?? ''}
                        amount={Number(row.amount)}
                        currency={row.currency}
                        label={Number(row.amount) < 0 ? 'Dr' : 'Cr'}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
