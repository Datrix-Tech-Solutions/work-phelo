'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { cn, inputClass, popupClass } from '@/lib/utils';

interface Props {
  /** The tabs that aren't on yet; the button hides when there are none. */
  options: { value: string; label: string }[];
  /** `name` is what the person called the tab; it starts as the tab's usual name. */
  onPick: (value: string, name: string) => void;
}

/**
 * A "+" at the end of the tab bar: opens a short list of the tabs that aren't on yet. Choosing one
 * asks what to call it, starting from its usual name.
 */
export function AddProjectTabMenu({ options, onPick }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [chosen, setChosen] = useState<{ value: string; name: string } | null>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => {
      setPos(null);
      setChosen(null);
    };
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
          if (pos) {
            setPos(null);
            return setChosen(null);
          }
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
            {chosen ? (
              <li role="none" className="p-1.5 flex flex-col gap-2">
                <label htmlFor="new-tab-name" className="text-xs text-gray-500">
                  Tab name
                </label>
                <input
                  id="new-tab-name"
                  autoFocus
                  value={chosen.name}
                  maxLength={40}
                  onChange={(e) => setChosen({ ...chosen, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || !chosen.name.trim()) return;
                    onPick(chosen.value, chosen.name.trim());
                    setPos(null);
                    setChosen(null);
                  }}
                  className={inputClass()}
                />
                <button
                  type="button"
                  disabled={!chosen.name.trim()}
                  onClick={() => {
                    onPick(chosen.value, chosen.name.trim());
                    setPos(null);
                    setChosen(null);
                  }}
                  className="rounded-lg px-3 py-2 text-sm text-gray-800 transition-colors hover:bg-gray-100 disabled:opacity-40"
                >
                  Add tab
                </button>
              </li>
            ) : (
              options.map((option) => (
                <li key={option.value} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => setChosen({ value: option.value, name: option.label })}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-800 transition-colors hover:bg-gray-100"
                  >
                    {option.label}
                  </button>
                </li>
              ))
            )}
          </ul>,
          document.body,
        )}
    </>
  );
}
