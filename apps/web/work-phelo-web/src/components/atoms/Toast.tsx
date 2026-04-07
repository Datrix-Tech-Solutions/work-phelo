'use client';

import { cn } from '@/lib/utils';
import { useToastStore, ToastItem } from '@/store/toast.store';

export function Toast({ id, message, type }: ToastItem) {
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-card shadow-sm min-w-70 max-w-sm',
        type === 'error' && 'bg-red-100',
        type === 'success' && 'bg-green-100',
      )}
    >
      {/* Icon */}
      {type === 'error' ? (
        <div className="shrink-0 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      ) : (
        <div className="shrink-0 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

      {/* Message */}
      <span className="flex-1 text-sm text-gray-700">{message}</span>

      {/* Dismiss */}
      <button
        onClick={() => removeToast(id)}
        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
