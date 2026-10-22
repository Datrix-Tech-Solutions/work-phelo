import { Zap, BookOpen, CheckSquare, Bug, TrendingUp, Sparkles, ListChecks } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { WorkTypeIcon } from '@/types/hr';

/** Each icon a work type can use, with the colours it is drawn in. */
export const WORK_TYPE_ICONS: Record<
  WorkTypeIcon,
  { label: string; Icon: LucideIcon; className: string; chartColor: string }
> = {
  EPIC: {
    label: 'Epic',
    Icon: Zap,
    className: 'bg-purple-100 text-purple-700',
    chartColor: '#8b5cf6',
  },
  STORY: {
    label: 'Story',
    Icon: BookOpen,
    className: 'bg-green-100 text-green-700',
    chartColor: '#22c55e',
  },
  TASK: {
    label: 'Task',
    Icon: CheckSquare,
    className: 'bg-blue-100 text-blue-700',
    chartColor: '#3b82f6',
  },
  BUG: { label: 'Bug', Icon: Bug, className: 'bg-red-100 text-red-700', chartColor: '#ef4444' },
  IMPROVEMENT: {
    label: 'Improvement',
    Icon: TrendingUp,
    className: 'bg-teal-100 text-teal-700',
    chartColor: '#14b8a6',
  },
  FEATURE: {
    label: 'Feature',
    Icon: Sparkles,
    className: 'bg-amber-100 text-amber-700',
    chartColor: '#f59e0b',
  },
  SUBTASK: {
    label: 'Subtask',
    Icon: ListChecks,
    className: 'bg-gray-100 text-gray-700',
    chartColor: '#9ca3af',
  },
};

/** `sm` is the small badge used in fields and chips; `lg` matches the 32px avatars used in tables. */
export function WorkTypeIconBadge({
  icon,
  size = 'sm',
  className,
}: {
  icon: WorkTypeIcon;
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const { Icon, className: colors } = WORK_TYPE_ICONS[icon];
  return (
    <span
      className={`flex items-center justify-center shrink-0 ${
        size === 'lg' ? 'w-8 h-8 rounded-lg' : 'w-5 h-5 rounded'
      } ${colors} ${className ?? ''}`}
    >
      <Icon className={size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} />
    </span>
  );
}
