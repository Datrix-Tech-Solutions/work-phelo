'use client';

import type { ComponentType, ReactNode } from 'react';
import { CalendarDays, Clock, MessageSquare, UserCheck, X } from 'lucide-react';
import { DetailField } from '@/components/atoms/DetailField';
import { cardClass, frostedAvatarStyle } from '@/lib/utils';
import type { ProspectDetailInteraction } from '@/types/marketing';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** A detail field with a frosted icon circle, the same finish the avatars use. */
function IconField({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  color: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/30 text-white"
        style={frostedAvatarStyle(color)}
      >
        <Icon className="h-5 w-5" />
      </div>
      <DetailField label={label} value={value} />
    </div>
  );
}

export function ProspectInteractionDetails({
  interaction,
  onClose,
}: {
  interaction: ProspectDetailInteraction;
  onClose: () => void;
}) {
  return (
    <div className={cardClass('p-6 flex flex-col gap-5')}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-gray-900">Follow Up Details</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="rounded-lg p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
        <div className="flex flex-col gap-5">
          <IconField
            icon={CalendarDays}
            color="#3b82f6"
            label="Date Contacted"
            value={formatDate(interaction.occurredAt)}
          />
          <IconField
            icon={MessageSquare}
            color="#8b5cf6"
            label="Interaction Type"
            value={interaction.interactionMedium?.name}
          />
          <IconField
            icon={UserCheck}
            color="#10b981"
            label="Decision Maker Met"
            value={interaction.decisionMakerInvolved ? 'Yes' : 'No'}
          />
          {/* Duration isn't recorded yet — the field is a placeholder until it is. */}
          <IconField icon={Clock} color="#f97316" label="Duration" value={null} />
        </div>
        <div className="flex flex-col gap-5">
          {interaction.participants.length > 0 ? (
            interaction.participants.map((participant) => (
              <DetailField
                key={participant.id}
                label="Participant"
                value={`${participant.fullName} · ${participant.role} · ${participant.phone}`}
              />
            ))
          ) : (
            <DetailField label="Participant" value={null} />
          )}
          <DetailField
            label="Notes"
            value={
              interaction.notes ? (
                <span className="whitespace-pre-wrap">{interaction.notes}</span>
              ) : null
            }
          />
        </div>
      </div>
    </div>
  );
}
