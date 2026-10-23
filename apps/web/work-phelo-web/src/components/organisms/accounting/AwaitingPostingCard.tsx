'use client';

import { useParams } from 'next/navigation';
import {
  DashboardListCard,
  type DashboardListRow,
} from '@/components/molecules/accounting/DashboardListCard';
import { fullNumber } from '@/components/molecules/accounting/dashboardChartFormat';
import { useJournals } from '@/hooks/accounting/useJournals';
import { useTransactionsPage } from '@/hooks/accounting/useTransactionsPage';
import { formatDay } from '@/lib/dashboardPeriod';
import type { TransactionsPageItem } from '@/types/accounting';

const SHOWN = 5;

const day = (value: string) => formatDay(value.slice(0, 10));

/** The number, date and amount of a transaction, whichever kind of record it is. */
function transactionRow(item: TransactionsPageItem): DashboardListRow {
  if (item.kind === 'document') {
    const d = item.document;
    return {
      key: `document-${d.id}`,
      primary: d.documentNumber,
      secondary: d.description ?? d.party.name,
      trailing: `${d.currency} ${fullNumber(Number(d.totalAmount))}`,
    };
  }
  if (item.kind === 'settlement') {
    const s = item.settlement;
    return {
      key: `settlement-${s.id}`,
      primary: s.settlementNumber,
      secondary: s.party.name,
      trailing: `${s.currency} ${fullNumber(Number(s.amount))}`,
    };
  }
  const t = item.transaction;
  return {
    key: `cashbook-${t.id}`,
    primary: t.transactionNumber ?? 'Draft entry',
    secondary: t.description,
    trailing: `${t.currency} ${fullNumber(Number(t.amount))}`,
  };
}

/** Drafts that have been entered but not yet posted to the ledger. */
export function AwaitingPostingCard({ className }: { className?: string }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const transactions = useTransactionsPage({ status: 'DRAFT', limit: SHOWN });
  const journals = useJournals({ status: 'DRAFT' });

  const draftJournals = journals.data ?? [];

  return (
    <DashboardListCard
      title="Awaiting Posting"
      subtitle="Drafts not yet in the ledger"
      className={className}
      sections={[
        {
          title: 'Transactions',
          count: transactions.data?.total,
          rows: (transactions.data?.items ?? []).map(transactionRow),
          href: `/${tenantSlug}/accounting/transactions`,
          isLoading: transactions.isLoading,
          isError: transactions.isError,
          emptyText: 'No draft transactions.',
        },
        {
          title: 'Journals',
          count: journals.data ? draftJournals.length : undefined,
          rows: draftJournals.slice(0, SHOWN).map((journal) => ({
            key: journal.id,
            primary: journal.journalNumber,
            secondary: journal.description,
            trailing: day(journal.transactionDate),
          })),
          href: `/${tenantSlug}/accounting/journalentry`,
          isLoading: journals.isLoading,
          isError: journals.isError,
          emptyText: 'No draft journals.',
        },
      ]}
    />
  );
}
