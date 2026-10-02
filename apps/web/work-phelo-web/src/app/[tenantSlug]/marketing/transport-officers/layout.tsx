'use client';

import { useParams } from 'next/navigation';
import { pageHeader, pagePx } from '@/lib/layout';
import { TransportOfficersTabs } from '@/components/molecules/marketing/TransportOfficersTabs';

export default function TransportOfficersLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/${tenantSlug}/marketing/transport-officers`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
        <div className={pageHeader}>
          <h1 className="text-xl font-semibold text-gray-900">Transport Officers</h1>
        </div>
        <TransportOfficersTabs base={base} className={pagePx} />
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">{children}</main>
    </div>
  );
}
