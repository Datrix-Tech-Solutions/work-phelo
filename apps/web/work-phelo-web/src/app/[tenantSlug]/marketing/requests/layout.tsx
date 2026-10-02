'use client';

import { useParams } from 'next/navigation';
import { pageHeader, pagePx } from '@/lib/layout';
import { RequestsTabs } from '@/components/molecules/marketing/RequestsTabs';

export default function RequestsLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/${tenantSlug}/marketing/requests`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
        <div className={pageHeader}>
          <h1 className="text-xl font-semibold text-gray-900">Requests</h1>
        </div>
        <RequestsTabs base={base} className={pagePx} />
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">{children}</main>
    </div>
  );
}
