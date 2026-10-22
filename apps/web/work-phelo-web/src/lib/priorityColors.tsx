import { TypeChipColor } from '@/components/atoms/TypeChip';
import { PriorityColor } from '@/types/hr';

/** Colours a priority level can use: `chip` for the pill, `dot` for the swatch. Written out in full so Tailwind keeps every class. */
export const PRIORITY_COLORS: Record<
  PriorityColor,
  { label: string; chip: string; dot: string; hex: string }
> = {
  GRAY: {
    label: 'Gray',
    chip: 'bg-gray-100 text-gray-700',
    dot: 'bg-gray-400',
    hex: '#9ca3af',
  },
  BLUE: {
    label: 'Blue',
    chip: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500',
    hex: '#3b82f6',
  },
  GREEN: {
    label: 'Green',
    chip: 'bg-green-100 text-green-700',
    dot: 'bg-green-500',
    hex: '#22c55e',
  },
  YELLOW: {
    label: 'Yellow',
    chip: 'bg-yellow-100 text-yellow-800',
    dot: 'bg-yellow-400',
    hex: '#eab308',
  },
  ORANGE: {
    label: 'Orange',
    chip: 'bg-orange-100 text-orange-700',
    dot: 'bg-orange-500',
    hex: '#f97316',
  },
  RED: { label: 'Red', chip: 'bg-red-100 text-red-700', dot: 'bg-red-500', hex: '#ef4444' },
  PURPLE: {
    label: 'Purple',
    chip: 'bg-purple-100 text-purple-700',
    dot: 'bg-purple-500',
    hex: '#8b5cf6',
  },
};

export function PriorityDot({ color, className }: { color: PriorityColor; className?: string }) {
  return (
    <span
      className={`w-3 h-3 rounded-full shrink-0 ${PRIORITY_COLORS[color].dot} ${className ?? ''}`}
    />
  );
}

export const PRIORITY_COLOR_OPTIONS = (Object.keys(PRIORITY_COLORS) as PriorityColor[]).map(
  (value) => ({
    value,
    label: PRIORITY_COLORS[value].label,
    icon: <PriorityDot color={value} />,
  }),
);

/** The nearest TypeChip colour for each priority colour, for tables that use TypeChip. */
export const PRIORITY_TYPE_CHIP_COLORS: Record<PriorityColor, TypeChipColor> = {
  GRAY: 'gray',
  BLUE: 'blue',
  GREEN: 'green',
  YELLOW: 'amber',
  ORANGE: 'amber',
  RED: 'red',
  PURPLE: 'purple',
};
