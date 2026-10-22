'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { cn, popupClass } from '@/lib/utils';

interface Props {
  /** The tabs that aren't on yet; the button hides when there are none. */
  options: { value: string; label: string }[];
  onPick: (value: string) => void;
}

/** A "+" at the end of the tab bar: opens a short list of the tabs that aren't on yet. */
export function AddProjectTabMenu({ options, onPick }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
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

  if (options.length === 0) return null;

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label="Add a tab"
        aria-haspopup="menu"
        aria-expanded={!!pos}
        onClick={() => {
          if (pos) return setPos(null);
          const rect = ref.current?.getBoundingClientRect();
          if (rect) setPos({ top: rect.bottom + 4, left: rect.left });
        }}
        className={cn(
          'self-center ml-1 mb-1 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700',
          pos && 'bg-gray-100 text-gray-700',
        )}
      >
        <Plus className="h-4 w-4" />
      </button>

      {pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <ul
            ref={menuRef}
            role="menu"
            className={popupClass('fixed z-[70] p-1.5 flex flex-col gap-0.5 min-w-44')}
            style={{ top: pos.top, left: pos.left }}
          >
            {options.map((option) => (
              <li key={option.value} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setPos(null);
                    onPick(option.value);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-800 transition-colors hover:bg-gray-100"
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
