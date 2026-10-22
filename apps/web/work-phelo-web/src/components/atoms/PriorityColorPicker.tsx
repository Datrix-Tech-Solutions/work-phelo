'use client';

import { createPortal } from 'react-dom';
import { useAnchoredMenu } from '@/hooks/useAnchoredMenu';
import { PRIORITY_COLORS, PriorityDot } from '@/lib/priorityColors';
import { cn, popupClass } from '@/lib/utils';
import type { PriorityColor } from '@/types/hr';

interface Props {
  value: PriorityColor;
  onChange: (color: PriorityColor) => void;
}

/** The colour dot of a priority level; click it to pick another colour from a grid of swatches. */
export function PriorityColorPicker({ value, onChange }: Props) {
  const { triggerRef, menuRef, pos, toggle, close } = useAnchoredMenu();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Change colour"
        aria-haspopup="listbox"
        aria-expanded={!!pos}
        onClick={toggle}
        className="flex shrink-0 cursor-pointer items-center justify-center rounded p-1 transition-colors hover:bg-black/10"
      >
        <PriorityDot color={value} />
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
            {(Object.keys(PRIORITY_COLORS) as PriorityColor[]).map((color) => (
              <button
                key={color}
                type="button"
                role="option"
                aria-selected={color === value}
                title={PRIORITY_COLORS[color].label}
                onClick={() => {
                  close();
                  onChange(color);
                }}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-gray-100',
                  color === value && 'bg-gray-100 ring-1 ring-gray-300',
                )}
              >
                <PriorityDot color={color} className="w-4 h-4" />
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
