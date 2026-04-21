'use client';

import { Icons } from '@/components/atoms/icons';
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
          <Icons.CircleX />
        </div>
      ) : (
        <div className="shrink-0 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
          <Icons.CircleCheck />
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
        <Icons.X />
      </button>
    </div>
  );
}
