'use client';

import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { pageHeader, pageContent, pagePx } from '@/lib/layout';
import { NavigateTabs } from '@/components/molecules/marketing/NavigateTabs';

export default function NavigateLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/${tenantSlug}/marketing/navigate`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 bg-white">
        <div className={pageHeader}>
          <h1 className="text-xl font-semibold text-gray-900">Navigate</h1>
        </div>
        <NavigateTabs base={base} className={pagePx} />
      </div>

      <main className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto bg-gray-50 flex flex-col')}>
        {children}
      </main>
    </div>
  );
}
