'use client';

import { usePathname } from 'next/navigation';
import { useToastStore } from '@/store/toast.store';
import { Toast } from '@/components/atoms/Toast';

const LOGIN_PATHS = [
  '/login',
  '/forgot-password',
  '/forgot-password/verify',
  '/forgot-password/reset',
];

function isLoginPage(pathname: string): boolean {
  return LOGIN_PATHS.some((p) => pathname === p || pathname.endsWith(p));
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const pathname = usePathname();
  if (toasts.length === 0) return null;

  // On login pages: pin to top of the 42% form panel (left side on desktop, full-width on mobile)
  if (isLoginPage(pathname)) {
    return (
      <div className="fixed top-5 z-100 flex flex-col gap-2 left-0 w-full lg:w-[42%] items-center px-6">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
        ))}
      </div>
    );
  }

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-100 flex flex-col gap-2 items-center">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  );
}
