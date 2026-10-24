'use client';

import { Banknote, CalendarDays, FolderKanban, Receipt } from 'lucide-react';
import { TypeChip } from '@/components/atoms/TypeChip';
import { DataCard, type DataCardDetail } from '@/components/organisms/shared/DataCard';
import { formatMoney } from '@/lib/formatMoney';
import { BILLING_TYPE_LABELS } from '@/lib/projectTypes';
import { frostedAvatarStyle } from '@/lib/utils';
import type { ClientProject } from '@/hooks/hr/useClientProjects';

function row(
  Icon: typeof Banknote,
  label: string,
  value: string,
  iconColor: string,
): DataCardDetail {
  return {
    label: (
      <>
        <Icon className={`w-3 h-3 ${iconColor}`} /> {label}
      </>
    ),
    value: <span className="text-xs font-semibold text-gray-700">{value}</span>,
  };
}

/** A project started for the client, listed beside its products and services. */
export function ClientProjectCard({
  project,
  onOpen,
}: {
  project: ClientProject;
  onOpen: () => void;
}) {
  const details: DataCardDetail[] = [
    row(Banknote, 'Expected Revenue', formatMoney(project.expectedValue), 'text-blue-500'),
    row(
      Receipt,
      'Billing',
      project.pricing ? BILLING_TYPE_LABELS[project.pricing.type] : 'Not billable',
      'text-emerald-500',
    ),
    row(
      CalendarDays,
      'Added',
      new Date(project.createdAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      'text-rose-500',
    ),
  ];

  return (
    <DataCard
      icon={
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/30 text-white"
          style={frostedAvatarStyle('#0d9488')}
        >
          <FolderKanban className="h-5 w-5" />
        </div>
      }
      title={project.name}
      badge={<TypeChip label="Project" color="teal" />}
      details={details}
      surface="card"
      onClick={onOpen}
    />
  );
}
