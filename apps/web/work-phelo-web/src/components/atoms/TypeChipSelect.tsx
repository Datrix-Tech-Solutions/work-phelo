'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { TypeChip, TypeChipColor } from '@/components/atoms/TypeChip';
import { cn, popupClass } from '@/lib/utils';

export interface TypeChipOption {
  value: string;
  label: string;
  color: TypeChipColor;
}

interface Props {
  /** The current value's label and colour, shown as the chip. Leave `value` empty for "none". */
  value: string;
  options: TypeChipOption[];
  onChange: (value: string) => void;
  /** Shown as a plain gray chip when nothing is picked. */
  emptyLabel?: string;
  /** Renders the chip with no dropdown, e.g. for people who can't edit. */
  readOnly?: boolean;
}

/** A TypeChip you can click to pick one of the other options from a small list. */
export function TypeChipSelect({ value, options, onChange, emptyLabel = '—', readOnly }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    // A press on the chip itself is left to its own click, which toggles; closing here as well
    // would let that click open the list straight back up.
    const onPress = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    };
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

  if (readOnly) {
    return current ? (
      <TypeChip label={current.label} color={current.color} />
    ) : (
      <span className="text-gray-400">{emptyLabel}</span>
    );
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={!!pos}
        onClick={(e) => {
          e.stopPropagation();
          if (pos) return setPos(null);
          const rect = ref.current?.getBoundingClientRect();
          if (rect) setPos({ top: rect.bottom + 4, left: rect.left });
        }}
        className="inline-flex w-fit max-w-full min-w-0 justify-self-start rounded-md cursor-pointer hover:brightness-95 transition"
      >
        {/* The chevron lives inside the chip, so the whole chip reads as the dropdown. */}
        <TypeChip
          label={current ? current.label : emptyLabel}
          color={current?.color ?? 'gray'}
          trailing={<ChevronDown className="ml-1 w-3 h-3 shrink-0 opacity-60" />}
        />
      </button>

      {pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            // Stops the outside-click listener, and the row underneath, from seeing these clicks.
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className={popupClass(
              'fixed z-[70] p-1.5 flex flex-col gap-0.5 min-w-40 max-h-64 overflow-y-auto',
            )}
            style={{ top: pos.top, left: pos.left }}
          >
            {options.map((option) => (
              <li key={option.value} role="option" aria-selected={option.value === value}>
                <button
                  type="button"
                  onClick={() => {
                    setPos(null);
                    if (option.value !== value) onChange(option.value);
                  }}
                  className={cn(
                    'w-full flex items-center px-2 py-1.5 rounded-lg text-left transition-colors hover:bg-gray-100',
                    option.value === value && 'bg-gray-100',
                  )}
                >
                  <TypeChip label={option.label} color={option.color} />
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
