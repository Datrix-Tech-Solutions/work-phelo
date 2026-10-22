import { cn } from '@/lib/utils';

export type TypeChipColor = 'red' | 'green' | 'blue' | 'purple' | 'amber' | 'teal' | 'gray';

const COLOR_STYLES: Record<TypeChipColor, string> = {
  red: 'bg-rose-100 text-rose-800',
  green: 'bg-emerald-100 text-emerald-800',
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-indigo-100 text-indigo-800',
  amber: 'bg-amber-100 text-amber-800',
  teal: 'bg-teal-100 text-teal-800',
  gray: 'bg-gray-100 text-gray-600',
};

interface TypeChipProps {
  label: string;
  color?: TypeChipColor;
  /** Rendered inside the chip after the label, e.g. a dropdown chevron. */
  trailing?: React.ReactNode;
}

export function TypeChip({ label, color = 'gray', trailing }: TypeChipProps) {
  return (
    <span
      title={label}
      className={cn(
        // A long label is cut with an ellipsis (full text on hover) instead of spilling out of its cell.
        'inline-flex w-fit min-w-0 max-w-full items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide',
        COLOR_STYLES[color],
      )}
    >
      <span className="truncate whitespace-nowrap">{label}</span>
      {trailing}
    </span>
  );
}
