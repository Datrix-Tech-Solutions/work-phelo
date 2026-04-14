'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Icons } from '@/lib/icons';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

export function SidePanel({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'w-[520px]',
}: SidePanelProps) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          'fixed inset-0 bg-black/60 z-40 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />

      {/* Floating Side Panel */}
      <div
        className={cn(
          'fixed top-6 bottom-6 right-6 z-50 flex flex-col bg-white',
          'rounded-3xl overflow-hidden border border-gray-100 shadow-2xl',
          'transition-all duration-300 ease-out',
          width,
          // Animation: slide in from right with slight scale
          isOpen
            ? 'translate-x-0 scale-100 opacity-100'
            : 'translate-x-12 scale-95 opacity-0 pointer-events-none',
        )}
      >
        {/* Header */}
        <div className="shrink-0 px-8 pt-7 pb-5 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">{title}</h2>
              {description && <p className="text-sm text-gray-500 mt-1.5">{description}</p>}
            </div>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 p-2 rounded-full hover:bg-gray-100 transition-all"
              aria-label="Close panel"
            >
              <Icons.X />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 py-7">
          <div className="flex flex-col gap-6">{children}</div>
        </div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 px-8 py-5 border-t border-gray-100 bg-white">{footer}</div>
        )}
      </div>
    </>
  );
}
