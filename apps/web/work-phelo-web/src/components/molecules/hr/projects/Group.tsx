'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cardClass } from '@/lib/utils';

/** A card with a heading that opens and closes it; closed until clicked. */
export function Group({
  title,
  hasError,
  children,
}: {
  title: string;
  /** Opens the group so a validation message inside it can't go unseen. */
  hasError?: boolean;
  children: React.ReactNode;
}) {
  const [picked, setOpen] = useState(false);
  const open = picked || !!hasError;
  return (
    <section className={cardClass('p-5 flex flex-col gap-3')}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center justify-between text-left"
      >
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <ChevronDown
          className={`w-5 h-5 text-gray-600 transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && children}
    </section>
  );
}
