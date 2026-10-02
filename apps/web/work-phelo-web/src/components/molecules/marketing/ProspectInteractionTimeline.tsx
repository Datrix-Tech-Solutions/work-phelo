'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { ProspectInteractionDetails } from '@/components/molecules/marketing/ProspectInteractionDetails';
import { cardClass, cn } from '@/lib/utils';
import type { FollowUpWorklistItem, ProspectDetailInteraction } from '@/types/marketing';

interface Props {
  interactions: ProspectDetailInteraction[];
  onAdd: () => void;
  /** The prospect's next follow-up, shown after the last interaction. */
  upcoming?: FollowUpWorklistItem;
}

function dayName(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long' });
}

function fullDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Oldest to newest, left to right, scrolling sideways when the history outgrows the page. */
export function ProspectInteractionTimeline({ interactions, onAdd, upcoming }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = interactions.find((i) => i.id === selectedId);
  const sorted = [...interactions].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button icon={<Plus className="w-4 h-4" />} onClick={onAdd}>
          Add Follow ups
        </Button>
      </div>

      {sorted.length === 0 && !upcoming ? (
        <p className="text-sm text-gray-400 text-center py-8">No follow ups yet</p>
      ) : (
        <div className="overflow-x-auto pb-3">
          <ol className="relative flex w-max min-w-full gap-6 px-1 pb-2">
            {/* The line the dots sit on, running behind the whole row of cards. */}
            <div className="absolute left-0 right-0 bottom-3.5 h-0.5 bg-gray-200" aria-hidden />
            {sorted.map((interaction) => (
              <li
                key={interaction.id}
                className="relative flex w-56 shrink-0 flex-col items-center gap-4"
              >
                <button
                  type="button"
                  onClick={() =>
                    setSelectedId(interaction.id === selectedId ? null : interaction.id)
                  }
                  className={cardClass(
                    cn(
                      'flex w-full flex-col gap-1 p-4 text-left transition hover:border-(--module-btn-bg,var(--color-brand))',
                      interaction.id === selectedId &&
                        'border-(--module-btn-bg,var(--color-brand))',
                    ),
                  )}
                >
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    {dayName(interaction.occurredAt)}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {fullDate(interaction.occurredAt)}
                  </span>
                  <span className="text-sm text-gray-600">
                    {interaction.interactionMedium?.name ?? '—'}
                  </span>
                </button>
                <span className="relative z-10 h-3.5 w-3.5 rounded-full border-2 border-white bg-(--module-btn-bg,var(--color-brand)) ring-2 ring-(--module-btn-bg,var(--color-brand))/30" />
              </li>
            ))}
            {upcoming && (
              <li className="relative flex w-56 shrink-0 flex-col items-center gap-4">
                <div
                  className={cn(
                    'flex w-full flex-col gap-1 rounded-xl border border-dashed p-4',
                    upcoming.urgency === 'OVERDUE'
                      ? 'border-red-300 bg-red-50'
                      : cardClass('border-(--module-btn-bg,var(--color-brand))'),
                  )}
                >
                  <span
                    className={cn(
                      'text-xs font-medium uppercase tracking-wide',
                      upcoming.urgency === 'OVERDUE' ? 'text-red-500' : 'text-gray-400',
                    )}
                  >
                    {upcoming.urgency === 'OVERDUE' ? 'Overdue' : 'Upcoming'} ·{' '}
                    {dayName(upcoming.dueAt)}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {fullDate(upcoming.dueAt)}
                  </span>
                  <span className="text-sm text-gray-600">
                    {upcoming.note ||
                      (upcoming.followUpSource === 'DEFAULT' ? 'Automatic follow-up' : 'Follow-up')}
                  </span>
                </div>
                <span
                  className={cn(
                    'relative z-10 h-3.5 w-3.5 rounded-full border-2 bg-white',
                    upcoming.urgency === 'OVERDUE'
                      ? 'border-red-400'
                      : 'border-(--module-btn-bg,var(--color-brand))',
                  )}
                />
              </li>
            )}
          </ol>
        </div>
      )}

      {selected && (
        <ProspectInteractionDetails interaction={selected} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
