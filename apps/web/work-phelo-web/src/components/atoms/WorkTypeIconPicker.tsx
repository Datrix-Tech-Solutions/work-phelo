'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WORK_TYPE_ICONS, WorkTypeIconBadge } from '@/lib/workTypeIcons';
import { cn, popupClass } from '@/lib/utils';
import type { WorkTypeIcon } from '@/types/hr';

interface Props {
  value: WorkTypeIcon;
  onChange: (icon: WorkTypeIcon) => void;
}

/** Just the icon: a small box showing the chosen icon, which opens a grid of the others to pick from. */
export function WorkTypeIconPicker({ value, onChange }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onPress = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onPress);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPress);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label="Choose an icon"
        aria-haspopup="listbox"
        aria-expanded={!!pos}
        onClick={() => {
          if (pos) return setPos(null);
          const rect = ref.current?.getBoundingClientRect();
          if (rect) setPos({ top: rect.bottom + 4, left: rect.left });
        }}
        // Not inputClass(): its `read-only:` styles match any non-editable element, buttons
        // included, which put the not-allowed cursor on this one.
        className="flex w-12 shrink-0 cursor-pointer items-center justify-center rounded-input border border-(--input-border,var(--color-gray-400)) bg-transparent py-2 transition-colors focus:outline-none focus:border-(--module-btn-bg,var(--color-brand)) focus:ring-2 focus:ring-(--module-btn-bg,var(--color-brand))/30"
      >
        <WorkTypeIconBadge icon={value} />
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
            {(Object.keys(WORK_TYPE_ICONS) as WorkTypeIcon[]).map((icon) => (
              <button
                key={icon}
                type="button"
                role="option"
                aria-selected={icon === value}
                // The name is only a hover hint, so the picker itself stays icon-only.
                title={WORK_TYPE_ICONS[icon].label}
                onClick={() => {
                  setPos(null);
                  onChange(icon);
                }}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-gray-100',
                  icon === value && 'bg-gray-100 ring-1 ring-gray-300',
                )}
              >
                <WorkTypeIconBadge icon={icon} size="lg" />
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
