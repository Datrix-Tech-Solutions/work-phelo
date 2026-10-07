'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cardClass, cn, popupClass } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';
import { CheckmarkAnimation } from '@/components/atoms/CheckmarkAnimation';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  /** Translucent glass surface with the page behind the backdrop blurred, instead of the
   * default near-solid popup surface with a plain dimming overlay. Opt-in — leaves every
   * other SidePanel consumer unchanged. */
  glass?: boolean;
  /** Rendered at the end of the description line (only shown alongside a description). */
  descriptionAction?: React.ReactNode;
  /** Opt-in multi-entry lock (see useMultiEntryPanel). Shows a lock toggle in the header;
   * while locked, the backdrop and Escape no longer close the panel — only the X does. */
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

export function SidePanel({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'sm:w-[960px]',
  glass = false,
  descriptionAction,
  lock,
  savePrompt,
}: SidePanelProps) {
  // Portals need a browser DOM to render into — stay unmounted through SSR and the
  // initial client render so hydration sees the same (empty) output, then flip on.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const locked = !!lock?.locked;
  const contentRef = useRef<HTMLDivElement>(null);

  // Escape closes the panel — unless it's locked, and while the save prompt is up it
  // answers the prompt (Stop) instead.
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
      const content = contentRef.current;
      if (!content) return;
      content.scrollTo({ top: 0 });
      content
        .querySelector<HTMLElement>(
          'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
        )
        ?.focus();
    });
  };

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={() => {
          if (!locked) onClose();
        }}
        className={cn(
          'fixed inset-0 z-40 transition-opacity duration-600',
          glass ? 'bg-black/20' : 'bg-black/60',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />

      {/* Side Panel */}
      <div
        className={cn(
          (glass ? cardClass : popupClass)(
            cn(
              'fixed z-50 flex flex-col overflow-hidden',
              'transition-all duration-600 ease-out',
              // Full height, flush against the top, bottom and right edges, no rounding
              'inset-0 rounded-none',
              'sm:inset-auto sm:top-0 sm:bottom-0 sm:right-0',
            ),
          ),
          width,
          // Animation: slide fully in from / out to the right edge. The shadow is dropped
          // when closed so it can't bleed onto the screen while the panel is parked off-canvas.
          isOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full shadow-none pointer-events-none',
        )}
      >
        {/* Header */}
        <div className="shrink-0 px-3 sm:px-6 py-1 sm:py-2 border-b border-(--glass-border,rgba(255,255,255,0.55))">
          <div className="flex items-start justify-between gap-1">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-xl font-semibold text-gray-900 tracking-tight">
                {title}
              </h2>
              {description && (
                <div className="flex items-center justify-between gap-3 mt-1.5">
                  <p className="text-sm text-gray-500">{description}</p>
                  {descriptionAction}
                </div>
              )}
            </div>

            {lock && (
              <button
                type="button"
                onClick={lock.onToggle}
                aria-pressed={lock.locked}
                aria-label={lock.locked ? 'Unlock panel' : 'Keep panel open for multiple entries'}
                title={
                  lock.locked
                    ? 'Locked — stays open after saving. Click to unlock.'
                    : 'Lock to keep adding entries after saving'
                }
                className={cn(
                  'p-2 rounded-full transition-all',
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

            <button
              onClick={onClose}
              className="text-gray-700 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-all"
              aria-label="Close panel"
            >
              <Icons.X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto px-2 sm:px-6 py-2 sm:py-3">
          <div className="flex flex-col gap-6 h-full">{children}</div>
        </div>

        {/* Footer — just a divider within the panel's own glass surface, not a second one */}
        {footer && (
          <div className="shrink-0 px-3 sm:px-6 py-2 sm:py-2 border-t border-(--glass-border,rgba(255,255,255,0.55))">
            {footer}
          </div>
        )}
      </div>

      {/* Save prompt — above the panel (z-50) */}
      {savePrompt && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={savePrompt.onStop} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-sm bg-white rounded-card shadow-2xl p-8 flex flex-col items-center text-center gap-5"
          >
            <CheckmarkAnimation size={72} loop={false} />
            <div className="flex flex-col gap-1.5">
              <h2 className="text-lg font-bold text-gray-900">{savePrompt.title}</h2>
              {savePrompt.message && (
                <p className="text-sm text-gray-500 leading-relaxed">{savePrompt.message}</p>
              )}
            </div>
            <div className="flex w-full gap-3">
              <button
                onClick={savePrompt.onStop}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-input hover:bg-gray-50 transition-colors"
              >
                Stop
              </button>
              <button
                autoFocus
                onClick={continueEntry}
                className="flex-1 py-2.5 bg-brand text-white text-sm font-semibold rounded-input hover:bg-brand-hover transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
