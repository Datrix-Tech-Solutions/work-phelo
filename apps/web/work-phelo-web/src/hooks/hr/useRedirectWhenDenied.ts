'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

/**
 * Sends the person elsewhere when they aren't allowed on a page. It waits until the signed-in
 * user has loaded: until then every permission reads as "no", so redirecting straight away would
 * bounce anyone who refreshes the page.
 */
export function useRedirectWhenDenied(denied: boolean, href: string) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user && denied) router.replace(href);
  }, [user, denied, href, router]);
}
