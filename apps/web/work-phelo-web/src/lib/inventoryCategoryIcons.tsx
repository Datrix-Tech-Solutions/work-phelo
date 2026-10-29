import {
  Package,
  Boxes,
  Shirt,
  Utensils,
  Wrench,
  Laptop,
  Pill,
  Car,
  Armchair,
  BookOpen,
  Gem,
  Paintbrush,
  Cpu,
  Hammer,
  Apple,
  Tag,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { pickAvatarColor } from '@/components/atoms/Avatar';
import { frostedAvatarStyle } from '@/lib/utils';

/** Icons an inventory category can use, keyed by the name stored with the category. */
export const CATEGORY_ICONS = {
  PACKAGE: { label: 'Package', Icon: Package },
  BOXES: { label: 'Boxes', Icon: Boxes },
  APPAREL: { label: 'Apparel', Icon: Shirt },
  FOOD: { label: 'Food', Icon: Utensils },
  PRODUCE: { label: 'Produce', Icon: Apple },
  TOOLS: { label: 'Tools', Icon: Wrench },
  HARDWARE: { label: 'Hardware', Icon: Hammer },
  ELECTRONICS: { label: 'Electronics', Icon: Laptop },
  COMPONENTS: { label: 'Components', Icon: Cpu },
  MEDICAL: { label: 'Medical', Icon: Pill },
  AUTOMOTIVE: { label: 'Automotive', Icon: Car },
  FURNITURE: { label: 'Furniture', Icon: Armchair },
  BOOKS: { label: 'Books', Icon: BookOpen },
  JEWELLERY: { label: 'Jewellery', Icon: Gem },
  PAINT: { label: 'Paint', Icon: Paintbrush },
  GENERAL: { label: 'General', Icon: Tag },
} satisfies Record<string, { label: string; Icon: LucideIcon }>;

export type CategoryIconKey = keyof typeof CATEGORY_ICONS;

export const DEFAULT_CATEGORY_ICON: CategoryIconKey = 'PACKAGE';

/**
 * A category's icon in a round chip. With a `name` it matches the table Avatar: the same frosted,
 * name-tinted circle at 32px with a white icon. Without one (e.g. in the icon picker) it is a
 * neutral gray tile.
 */
export function CategoryIconBadge({
  icon,
  name,
  size = 'sm',
}: {
  icon: CategoryIconKey;
  name?: string;
  size?: 'sm' | 'lg';
}) {
  const { Icon } = CATEGORY_ICONS[icon] ?? CATEGORY_ICONS[DEFAULT_CATEGORY_ICON];
  const iconSize = size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5';

  if (name) {
    return (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/30 text-white backdrop-blur-sm"
        style={frostedAvatarStyle(pickAvatarColor(name))}
      >
        <Icon className="h-4 w-4" />
      </span>
    );
  }

  return (
    <span
      className={
        size === 'lg'
          ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700'
          : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-700'
      }
    >
      <Icon className={iconSize} />
    </span>
  );
}
