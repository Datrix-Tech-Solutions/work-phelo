'use client';

import { useParams, usePathname } from 'next/navigation';
import { pageHeader } from '@/lib/layout';

export default function ClientsLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const pathname = usePathname();
  // The title belongs to the list only — detail pages have their own breadcrumb header.
  const showTitle = pathname === `/${tenantSlug}/marketing/clients`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {showTitle && (
        <div className="shrink-0">
          <div className={pageHeader}>
            <h1 className="text-xl font-semibold text-gray-900">Clients</h1>
          </div>
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">{children}</main>
    </div>
  );
}
