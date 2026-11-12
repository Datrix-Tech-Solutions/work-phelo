'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useCrumbs } from '@/hooks/inventory/useCrumbs';
import { ChevronRight } from 'lucide-react';

interface InventoryBreadcrumbProps {
  /** The list this kind of page belongs to, e.g. Purchase Orders. */
  root: { label: string; href: string };
  /** The page you are on. */
  current: ReactNode;
  currentClassName?: string;
}

/**
 * Breadcrumb for a details page. When the page was opened from another details page, that page
 * sits between the list and this page, so there is a way back to it.
 */
export function InventoryBreadcrumb({ root, current, currentClassName }: InventoryBreadcrumbProps) {
  const { from } = useCrumbs();
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-400">
      <Link href={root.href} className="hover:text-gray-700 transition-colors">
        {root.label}
      </Link>
      {from && (
        <>
          <ChevronRight className="w-4 h-4" />
          <Link href={from.path} className="hover:text-gray-700 transition-colors">
            {from.label}
          </Link>
        </>
      )}
      <ChevronRight className="w-4 h-4" />
      <span className={currentClassName ?? 'text-gray-700 font-medium'}>{current}</span>
    </nav>
  );
}
