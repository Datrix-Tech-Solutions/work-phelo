'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Stops unsaved work being lost when the person leaves the page.
 *
 * - Clicking a link to another page in the app calls `onBlocked` with a function that carries on
 *   to that page, so the caller can show its own pop-up first.
 * - Closing or reloading the tab uses the browser's own prompt, which can't be restyled.
 *
 * The browser's back and forward buttons aren't covered.
 */
export function useUnsavedChangesGuard(dirty: boolean, onBlocked: (proceed: () => void) => void) {
  const router = useRouter();
  const blocked = useRef(onBlocked);

  useEffect(() => {
    blocked.current = onBlocked;
  });

  useEffect(() => {
    if (!dirty) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page (for example a hash link) isn't leaving.
      if (url.pathname === window.location.pathname && url.search === window.location.search)
        return;

      event.preventDefault();
      event.stopPropagation();
      blocked.current(() => router.push(`${url.pathname}${url.search}${url.hash}`));
    };

    window.addEventListener('beforeunload', beforeUnload);
    // Capture phase, so this runs before the link's own navigation does.
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty, router]);
}
