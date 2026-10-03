'use client';

import { DataCard, DataCardAction, DataCardDetail } from '@/components/organisms/shared/DataCard';
import { Avatar } from '@/components/atoms/Avatar';
import { cn } from '@/lib/utils';
import type { TransportOfficer } from '@/types/marketing';

interface Props {
  officer: TransportOfficer;
  /** Omit to hide the action (e.g. when the user lacks the edit permission). */
  onToggleActive?: () => void;
}

const value = (text: string | null | undefined, className = 'text-gray-700') => (
  <span className={cn('text-xs font-semibold truncate max-w-[65%] text-right', className)}>
    {text ?? '—'}
  </span>
);

export function TransportOfficerCard({ officer, onToggleActive }: Props) {
  const badge = !officer.employeeActive
    ? { label: 'Left company', bg: 'bg-gray-100', text: 'text-gray-500' }
    : officer.isActive
      ? { label: 'Active', bg: 'bg-green-50', text: 'text-green-700' }
      : { label: 'Inactive', bg: 'bg-gray-100', text: 'text-gray-500' };

  const actions: DataCardAction[] = [];
  // Someone who left HR can't drive again, so only offer reactivating current employees.
  if (onToggleActive && (officer.isActive || officer.employeeActive)) {
    actions.push(
      officer.isActive
        ? {
            label: 'Deactivate',
            onClick: onToggleActive,
            className: 'bg-orange-50 text-orange-600 hover:bg-orange-100',
          }
        : {
            label: 'Reactivate',
            onClick: onToggleActive,
            className: 'bg-green-50 text-green-600 hover:bg-green-100',
          },
    );
  }

  const details: DataCardDetail[] = [
    { label: 'Department', value: value(officer.department) },
    { label: 'Email', value: value(officer.email) },
  ];

  return (
    <DataCard
      compact
      className={cn(!officer.isActive && 'opacity-80')}
      icon={<Avatar name={officer.name} size="md" />}
      title={officer.name}
      subtitle={officer.jobTitle ?? undefined}
      badge={
        <span
          className={cn(
            'px-2.5 py-1 rounded-full text-xs font-semibold shrink-0',
            badge.bg,
            badge.text,
          )}
        >
          {badge.label}
        </span>
      }
      details={details}
      actions={actions}
    />
  );
}
