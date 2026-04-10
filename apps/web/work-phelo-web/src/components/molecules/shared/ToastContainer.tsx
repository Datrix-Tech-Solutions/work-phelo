'use client';

import { useToastStore } from '@/store/toast.store';
import { Toast } from '@/components/atoms/Toast';

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-100 flex flex-col gap-2 items-center">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  );
}
