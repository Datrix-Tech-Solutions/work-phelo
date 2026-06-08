'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  visual?: React.ReactNode;
  width?: string;
  height?: string;
  hideClose?: boolean;
  fullScreenMobile?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  visual,
  width = 'max-w-md',
  height = 'max-h-[80vh]',
  hideClose = false,
  fullScreenMobile = false,
}: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50',
        fullScreenMobile
          ? 'sm:flex sm:items-center sm:justify-center sm:p-4'
          : 'flex items-center justify-center p-4',
      )}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div
        className={cn(
          'z-10 bg-white shadow-2xl flex flex-col',
          fullScreenMobile
            ? cn(
                // mobile: truly full screen
                'fixed inset-0 w-full h-full rounded-none p-6',
                // desktop: float centred with provided (sm:-prefixed) dimensions
                'sm:inset-auto sm:relative sm:rounded-card',
                width,
                height,
              )
            : cn('relative w-full rounded-card p-6 max-h-[calc(100dvh-2rem)]', width, height),
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3 shrink-0">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          {!hideClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5 shrink-0"
              aria-label="Close"
            >
              <Icons.X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="relative flex-1 min-h-0 overflow-y-auto">
          {description && <p className="text-sm text-gray-500 leading-relaxed">{description}</p>}
          {children}

          {visual && <div className="absolute top-0 right-0">{visual}</div>}
        </div>

        {footer && (
          <div className="mt-auto pt-6 shrink-0 flex items-center justify-end gap-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
