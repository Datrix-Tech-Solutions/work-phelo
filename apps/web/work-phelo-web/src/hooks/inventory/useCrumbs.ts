'use client';

import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Where a details page was opened from. A link to another details page carries the page it
 * starts on (`from`, its path with its own query) and that page's name (`fromLabel`), so the
 * breadcrumb can show the way back. Following the breadcrumb returns with the earlier page's
 * own `from` intact, so chains of pages keep working.
 */
export function useCrumbs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const search = params.toString();

  const fromPath = params.get('from');
  const fromLabel = params.get('fromLabel');
  // Only follow in-app paths.
  const from =
    fromPath && fromLabel && fromPath.startsWith('/') && !fromPath.startsWith('//')
      ? { path: fromPath, label: fromLabel }
      : null;

  /** `href` to another details page, remembering this page under `label`. */
  const link = (href: string, label: string) => {
    const here = search ? `${pathname}?${search}` : pathname;
    const sep = href.includes('?') ? '&' : '?';
    return `${href}${sep}from=${encodeURIComponent(here)}&fromLabel=${encodeURIComponent(label)}`;
  };

  return { from, link };
}
