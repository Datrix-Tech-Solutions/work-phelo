'use client';

import { useParams } from 'next/navigation';
import { Badge } from '@/components/atoms/Badge';
import { DashboardListCard } from '@/components/molecules/accounting/DashboardListCard';
import { useRecurringJournals } from '@/hooks/accounting/useRecurringJournals';
import { formatDay } from '@/lib/dashboardPeriod';

const SHOWN = 6;
/** Schedules whose next run falls within this many days are listed. */
const LOOKAHEAD_DAYS = 7;

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const FREQUENCY_LABELS = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  ANNUALLY: 'Annually',
} as const;

/** Active recurring journals that are due now or run in the next week, earliest first. */
export function DueRecurringJournalsCard({ className }: { className?: string }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data, isLoading, isError } = useRecurringJournals('ACTIVE');

  const now = new Date();
  const today = isoDay(now);
  const horizon = isoDay(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + LOOKAHEAD_DAYS),
  );

  const due = (data ?? [])
    .map((entry) => ({ entry, runDate: entry.nextRunDate.slice(0, 10) }))
    .filter(({ runDate }) => runDate <= horizon)
    .sort((a, b) => a.runDate.localeCompare(b.runDate));

  return (
    <DashboardListCard
      title="Recurring Journals"
      subtitle={`Due now or within ${LOOKAHEAD_DAYS} days`}
      className={className}
      sections={[
        {
          title: 'Due',
          count: data ? due.length : undefined,
          rows: due.slice(0, SHOWN).map(({ entry, runDate }) => ({
            key: entry.id,
            primary: entry.name,
            secondary: `${FREQUENCY_LABELS[entry.frequency]} · ${
              entry.onGeneration === 'AUTO_POST' ? 'posts automatically' : 'creates a draft'
            }`,
            trailing:
              runDate <= today ? (
                <Badge variant="warning" label={runDate < today ? 'Overdue' : 'Due today'} />
              ) : (
                formatDay(runDate)
              ),
          })),
          href: `/${tenantSlug}/accounting/journalentry/recurring`,
          isLoading,
          isError,
          emptyText: 'Nothing is due.',
        },
      ]}
    />
  );
}
