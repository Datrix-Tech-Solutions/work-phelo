'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn, popupClass } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';
import { SavePromptDialog } from '@/components/organisms/shared/SavePromptDialog';

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
  panelClassName?: string;
  titleClassName?: string;
  closeButtonClassName?: string;
  /** Opt-in multi-entry lock (see useMultiEntryPanel), as on SidePanel. Shows a lock toggle in
   * the header; while locked, the backdrop and Escape no longer close the modal — only the X does. */
  lock?: { locked: boolean; onToggle: () => void };
  /** Success prompt raised after a save while locked: Continue goes on to the next entry,
   * Stop closes. Escape or a backdrop click counts as Stop. */
  savePrompt?: {
    title: string;
    message?: string;
    onContinue: () => void;
    onStop: () => void;
  } | null;
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
  panelClassName = popupClass('shadow-2xl'),
  titleClassName = 'text-gray-800',
  closeButtonClassName = 'text-gray-400 hover:text-gray-600',
  lock,
  savePrompt,
}: ModalProps) {
  const locked = !!lock?.locked;
  const bodyRef = useRef<HTMLDivElement>(null);

  // Escape closes the modal — unless it's locked, and while the save prompt is up it answers
  // the prompt (Stop) instead.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (savePrompt) savePrompt.onStop();
      else if (!locked) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, locked, savePrompt]);

  // Continue: the form has been reset for the next entry — start back at the top, first field.
  const continueEntry = () => {
    savePrompt?.onContinue();
    requestAnimationFrame(() => {
      const body = bodyRef.current;
      if (!body) return;
      body.scrollTo({ top: 0 });
      body
        .querySelector<HTMLElement>(
          'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
        )
        ?.focus();
    });
  };

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50',
        fullScreenMobile
          ? 'sm:flex sm:items-center sm:justify-center sm:p-4'
          : 'flex items-center justify-center p-4',
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!locked) onClose();
        }}
      />

      {/* Dialog */}
      <div
        className={cn(
          'z-10 flex flex-col',
          panelClassName,
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
        <div className="flex items-start justify-between gap-2 shrink-0">
          <h2 className={cn('text-lg font-bold', titleClassName)}>{title}</h2>
          {lock && (
            <button
              type="button"
              onClick={lock.onToggle}
              aria-pressed={lock.locked}
              aria-label={lock.locked ? 'Unlock' : 'Keep open for multiple entries'}
              title={
                lock.locked
                  ? 'Locked — stays open after saving. Click to unlock.'
                  : 'Lock to keep adding entries after saving'
              }
              className={cn(
                'ml-auto -mt-0.5 p-2 rounded-full transition-all shrink-0',
                lock.locked
                  ? 'text-brand bg-brand/10 hover:bg-brand/20'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
              )}
            >
              {lock.locked ? (
                <Icons.Lock className="w-4 h-4" />
              ) : (
                <Icons.LockOpen className="w-4 h-4" />
              )}
            </button>
          )}
          {!hideClose && (
            <button
              onClick={onClose}
              className={cn('transition-colors mt-0.5 shrink-0', closeButtonClassName)}
              aria-label="Close"
            >
              <Icons.X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div ref={bodyRef} className="relative flex-1 min-h-0 overflow-y-auto">
          {description && <p className="text-sm text-gray-500 leading-relaxed">{description}</p>}
          {children}

          {visual && <div className="absolute top-0 right-0">{visual}</div>}
        </div>

        {footer && (
          <div className="mt-auto pt-3 shrink-0 flex items-center justify-end gap-3">{footer}</div>
        )}
      </div>

      {savePrompt && <SavePromptDialog {...savePrompt} onContinue={continueEntry} />}
    </div>,
    document.body,
  );
}
