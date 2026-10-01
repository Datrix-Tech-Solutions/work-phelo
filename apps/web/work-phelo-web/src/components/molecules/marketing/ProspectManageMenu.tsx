'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { cn, popupClass } from '@/lib/utils';

export interface ManageMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export function ProspectManageMenu({ items }: { items: ManageMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        // icon={<Settings2 className="w-4 h-4" />}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">
          Manage
          <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
        </span>
      </Button>
      {open && (
        <div role="menu" className={popupClass('absolute right-0 top-full mt-2 w-52 z-30')}>
          <div className="py-1">
            {items.map((item) => (
              <button
                key={item.label}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={cn(
                  'w-full text-left px-4 py-2 text-sm hover:bg-(--surface-hover-subtle,var(--color-gray-50)) transition-colors',
                  item.danger ? 'text-red-600' : 'text-gray-700',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
