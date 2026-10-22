'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '@/components/atoms/Avatar';
import { cn, popupClass } from '@/lib/utils';

export interface AvatarStackPerson {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface Props {
  people: AvatarStackPerson[];
  /** Avatar diameter in px. */
  size?: number;
  /** How many avatars to show before collapsing the rest into a "+N" bubble. */
  max?: number;
  className?: string;
}

/** Overlapping avatars for several people. Hovering shows a tooltip with everyone's name. */
export function AvatarStack({ people, size = 28, max = 3, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  if (people.length === 0) return null;

  const shown = people.slice(0, max);
  const extra = people.length - shown.length;

  const show = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 6, left: rect.left });
  };

  return (
    <div
      ref={ref}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
      onFocus={show}
      onBlur={() => setPos(null)}
      aria-label={people.map((p) => p.name).join(', ')}
      className={cn('flex items-center w-fit outline-none', className)}
    >
      {shown.map((person, i) => (
        <Avatar
          key={person.id}
          name={person.name}
          avatarUrl={person.avatarUrl}
          size={size}
          className={cn('ring-2 ring-white', i > 0 && '-ml-2')}
        />
      ))}
      {extra > 0 && (
        <span
          className="-ml-2 flex shrink-0 items-center justify-center rounded-full bg-gray-100 ring-2 ring-white text-[11px] font-semibold text-gray-600"
          style={{ width: size, height: size }}
        >
          +{extra}
        </span>
      )}

      {pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <ul
            role="tooltip"
            className={popupClass(
              'fixed z-[70] px-3 py-2 flex flex-col gap-1 text-xs text-gray-800 pointer-events-none',
            )}
            style={{ top: pos.top, left: pos.left }}
          >
            {people.map((person) => (
              <li key={person.id} className="whitespace-nowrap">
                {person.name}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}
