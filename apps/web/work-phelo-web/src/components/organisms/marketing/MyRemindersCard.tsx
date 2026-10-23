'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Bell } from 'lucide-react';
import {
  TransportListCard,
  type TransportListItem,
} from '@/components/molecules/marketing/TransportListCard';
import { useFollowUpWorklist } from '@/hooks/marketing/useFollowUps';

const formatDue = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

interface Props {
  /** Whose reminders to list. */
  userId: string;
  className?: string;
}

/** The user's reminders that are overdue or coming up soon, earliest first. */
export function MyRemindersCard({ userId, className }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data, isLoading, isError } = useFollowUpWorklist();

  const due = useMemo(
    () =>
      (data ?? [])
        .filter((item) => item.assignedUserId === userId && item.urgency !== 'FUTURE')
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    [data, userId],
  );
  const items = useMemo<TransportListItem[]>(
    () =>
      due.map((item) => ({
        id: item.followUpId ?? item.prospectId,
        icon: Bell,
        color: item.urgency === 'OVERDUE' ? '#dc2626' : '#2a78d6',
        title: item.companyName,
        detail: item.note ?? undefined,
        trailing:
          item.urgency === 'OVERDUE' ? `Overdue · ${formatDue(item.dueAt)}` : formatDue(item.dueAt),
        trailingTone: item.urgency === 'OVERDUE' ? 'red' : undefined,
      })),
    [due],
  );

  return (
    <TransportListCard
      title="Reminders"
      subtitle="Overdue and coming up"
      count={due.filter((item) => item.urgency === 'OVERDUE').length}
      items={items}
      isLoading={isLoading}
      isError={isError}
      emptyText="No reminders are due."
      errorText="Reminders could not be loaded."
      action={{ href: `/${tenantSlug}/marketing/prospects/all`, label: 'Prospects' }}
      className={className}
    />
  );
}
