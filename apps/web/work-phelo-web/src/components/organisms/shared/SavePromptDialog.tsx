'use client';

import { CheckmarkAnimation } from '@/components/atoms/CheckmarkAnimation';

export interface SavePromptDialogProps {
  title: string;
  message?: string;
  /** Called with no arguments; the caller handles any follow-up such as refocusing the form. */
  onContinue: () => void;
  onStop: () => void;
}

/** The Continue / Stop prompt raised after a save while a form is locked for multiple entries. */
export function SavePromptDialog({ title, message, onContinue, onStop }: SavePromptDialogProps) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onStop} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm bg-white rounded-card shadow-2xl p-8 flex flex-col items-center text-center gap-5"
      >
        <CheckmarkAnimation size={72} loop={false} />
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          {message && <p className="text-sm text-gray-500 leading-relaxed">{message}</p>}
        </div>
        <div className="flex w-full gap-3">
          <button
            onClick={onStop}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-input hover:bg-gray-50 transition-colors"
          >
            Stop
          </button>
          <button
            autoFocus
            onClick={onContinue}
            className="flex-1 py-2.5 bg-brand text-white text-sm font-semibold rounded-input hover:bg-brand-hover transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
