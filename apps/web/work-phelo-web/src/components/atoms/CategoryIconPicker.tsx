'use client';

import { createPortal } from 'react-dom';
import { useAnchoredMenu } from '@/hooks/useAnchoredMenu';
import {
  CATEGORY_ICONS,
  CategoryIconBadge,
  type CategoryIconKey,
} from '@/lib/inventoryCategoryIcons';
import { cn, popupClass } from '@/lib/utils';

interface Props {
  value: CategoryIconKey;
  onChange: (icon: CategoryIconKey) => void;
}

/** A box showing the chosen icon, which opens a grid of the others to pick from. */
export function CategoryIconPicker({ value, onChange }: Props) {
  const { triggerRef: ref, menuRef, pos, toggle, close } = useAnchoredMenu();

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label="Choose an icon"
        aria-haspopup="listbox"
        aria-expanded={!!pos}
        onClick={toggle}
        className="flex h-11 w-14 shrink-0 cursor-pointer items-center justify-center rounded-input border border-(--input-border,var(--color-gray-400)) bg-transparent transition-colors focus:outline-none focus:border-(--module-btn-bg,var(--color-brand)) focus:ring-2 focus:ring-(--module-btn-bg,var(--color-brand))/30"
      >
        <CategoryIconBadge icon={value} size="lg" />
      </button>

      {pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            className={popupClass('fixed z-[80] p-2 grid grid-cols-4 gap-1.5')}
            style={{ top: pos.top, left: pos.left }}
          >
            {(Object.keys(CATEGORY_ICONS) as CategoryIconKey[]).map((icon) => (
              <button
                key={icon}
                type="button"
                role="option"
                aria-selected={icon === value}
                title={CATEGORY_ICONS[icon].label}
                onClick={() => {
                  close();
                  onChange(icon);
                }}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-gray-100',
                  icon === value && 'bg-gray-100 ring-1 ring-gray-300',
                )}
              >
                <CategoryIconBadge icon={icon} size="lg" />
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
