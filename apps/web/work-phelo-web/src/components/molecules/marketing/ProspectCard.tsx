'use client';

import { CalendarClock, Package, Phone, Target, UserCheck } from 'lucide-react';
import { DataCard } from '@/components/organisms/shared/DataCard';
import { TypeChip, type TypeChipColor } from '@/components/atoms/TypeChip';
import { getInitials, pickAvatarColor } from '@/components/atoms/Avatar';
import { cn, frostedAvatarStyle } from '@/lib/utils';
import type { Prospect } from '@/components/molecules/marketing/AllProspectsTable';

export function stageColor(progress: number): TypeChipColor {
  if (progress >= 100) return 'green';
  if (progress >= 75) return 'blue';
  if (progress >= 50) return 'purple';
  if (progress >= 25) return 'amber';
  if (progress > 0) return 'gray';
  return 'red';
}

/** Icon + value only, in the style of the client card's contact rows. */
function InfoRow({
  icon: Icon,
  iconClass,
  value,
}: {
  icon: typeof Package;
  iconClass: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <Icon size={14} className={cn('shrink-0', iconClass)} />
      <span className="truncate" title={value}>
        {value || '—'}
      </span>
    </div>
  );
}

interface Props {
  prospect: Prospect;
  onClick: () => void;
  onEdit: () => void;
  onUpdateStage: () => void;
  /** Omit to hide the action. */
  onConvertToClient?: () => void;
}

export function ProspectCard({
  prospect,
  onClick,
  onEdit,
  onUpdateStage,
  onConvertToClient,
}: Props) {
  const lastInteraction = prospect.lastInteraction
    ? new Date(prospect.lastInteraction).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <DataCard
      surface="card"
      onClick={onClick}
      icon={
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/30 text-sm font-semibold text-white"
          style={frostedAvatarStyle(pickAvatarColor(prospect.prospectName))}
        >
          {getInitials(prospect.prospectName)}
        </div>
      }
      title={prospect.prospectName}
      subtitle={prospect.businessType || undefined}
      badge={
        <TypeChip label={prospect.salesStage} color={stageColor(prospect.salesStageProgress)} />
      }
      note={
        <div className="flex flex-col gap-1.5">
          <InfoRow icon={Target} iconClass="text-blue-500" value={prospect.expectedRevenue} />
          <InfoRow icon={Package} iconClass="text-violet-500" value={prospect.product} />
          <InfoRow icon={Phone} iconClass="text-emerald-500" value={prospect.contactNo} />
          <InfoRow icon={CalendarClock} iconClass="text-orange-500" value={lastInteraction} />
          <InfoRow icon={UserCheck} iconClass="text-rose-500" value={prospect.assignedTo} />
        </div>
      }
      actions={[
        ...(prospect.salesStageProgress >= 100 && onConvertToClient
          ? [
              {
                label: 'Convert to Client',
                onClick: onConvertToClient,
                className: 'bg-green-50 text-green-700 hover:bg-green-100',
              },
            ]
          : []),
        {
          label: 'Update Stage',
          onClick: onUpdateStage,
          className: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
        },
        {
          label: 'Edit',
          onClick: onEdit,
          className: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
        },
      ]}
    />
  );
}
