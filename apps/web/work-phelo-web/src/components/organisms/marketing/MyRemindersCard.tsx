'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Bell } from 'lucide-react';
import {
  TransportListCard,
  type TransportListItem,
} from '@/components/molecules/marketing/TransportListCard';
import { AddInteractionPanel } from '@/components/organisms/marketing/AddInteractionPanel';
import { useFollowUpWorklist } from '@/hooks/marketing/useFollowUps';
import { useProspect } from '@/hooks/marketing/useProspects';

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

/** The user's reminders that are overdue or coming up soon, earliest first. Opening one records the follow-up that completes it. */
export function MyRemindersCard({ userId, className }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data, isLoading, isError } = useFollowUpWorklist();
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  // Reminders without a record of their own are the automatic ones, listed by prospect.
  const selected = due.find((item) => (item.followUpId ?? item.prospectId) === selectedId);
  const { data: prospect } = useProspect(selected?.prospectId ?? '');
  const contact = prospect?.contacts.find((c) => c.isPrimary) ?? prospect?.contacts[0];

  return (
    <>
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
        onSelect={setSelectedId}
        className={className}
      />

      <AddInteractionPanel
        prospectId={selected?.prospectId}
        followUpId={selected?.followUpId}
        isOpen={!!selected}
        onClose={() => setSelectedId(null)}
        primaryContact={
          contact && {
            name: contact.name,
            phone: contact.phone,
            role: contact.decisionMaker?.name,
          }
        }
      />
    </>
  );
}
