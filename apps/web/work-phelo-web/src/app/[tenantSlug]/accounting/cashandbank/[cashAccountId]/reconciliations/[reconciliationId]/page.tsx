'use client';

import { use } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/atoms/Badge';
import { Icons } from '@/components/atoms/icons';
import { useBankReconciliation } from '@/hooks';
import { formatDate, formatJournalNumber } from '@/lib/formatters';
import { formatSourceEventDescription } from '@/config/reinsurance-event-catalog';
import { cardClass, cn } from '@/lib/utils';

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

export default function BankReconciliationDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; cashAccountId: string; reconciliationId: string }>;
}) {
  const { tenantSlug, cashAccountId, reconciliationId } = use(params);
  const { data: reconciliation, isLoading } = useBankReconciliation(reconciliationId);
  const base = `/${tenantSlug}/accounting/cashandbank`;

  const currency = reconciliation?.currency ?? '';
  const systemRows = (reconciliation?.reconciledEntries ?? []).map(({ id, journalLine }) => ({
    id,
    date: journalLine.journalEntry.transactionDate,
    reference: formatJournalNumber(journalLine.journalEntry.journalNumber),
    description:
      formatSourceEventDescription(
        journalLine.description ?? journalLine.journalEntry.description,
      ) ?? '',
    // Money in is a debit on the cash account.
    amount: Number(journalLine.baseDebit) - Number(journalLine.baseCredit),
  }));
  const bankRows = reconciliation?.statementLines ?? [];
  const reconciledBankCount = bankRows.filter((row) => row.status === 'MATCHED').length;

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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div className={cardClass('flex flex-col min-w-0')}>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">System</h2>
                <span className="ml-auto text-xs text-gray-400">
                  {systemRows.length} reconciled
                </span>
              </div>
              {systemRows.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-sm text-gray-400">
                  No system entries were reconciled
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {systemRows.map((row) => (
                    <li key={row.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="w-24 shrink-0">
                        <p className="text-sm text-gray-900">{formatDate(row.date)}</p>
                        <p className="text-xs text-gray-400 truncate">{row.reference}</p>
                      </div>
                      <p className="flex-1 min-w-0 text-sm text-gray-700 break-words">
                        {row.description}
                      </p>
                      <p className="shrink-0 text-sm font-medium text-gray-900 text-right">
                        <Amount value={row.amount} currency={currency} />
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={cardClass('flex flex-col min-w-0')}>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Bank Statement</h2>
                <span className="ml-auto text-xs text-gray-400">
                  {reconciledBankCount} of {bankRows.length} reconciled
                </span>
              </div>
              {bankRows.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-sm text-gray-400">
                  No statement rows
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {bankRows.map((row) => (
                    <li
                      key={row.id}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3',
                        row.status !== 'MATCHED' && 'bg-gray-50',
                      )}
                    >
                      <div className="w-24 shrink-0">
                        <p className="text-sm text-gray-900">{formatDate(row.transactionDate)}</p>
                        <p className="text-xs text-gray-400 truncate">{row.bankReference ?? ''}</p>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <p className="text-sm text-gray-700 break-words">{row.description ?? ''}</p>
                        {row.status !== 'MATCHED' && (
                          <Badge label="Not reconciled" variant="warning" />
                        )}
                      </div>
                      <p className="shrink-0 text-sm font-medium text-gray-900 text-right">
                        <Amount value={Number(row.amount)} currency={row.currency} />
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
