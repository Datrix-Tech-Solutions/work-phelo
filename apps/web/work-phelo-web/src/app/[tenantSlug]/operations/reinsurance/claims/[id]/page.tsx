'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { useFacultativePlacement } from '@/hooks';
import { ClaimOverviewSection } from '@/components/molecules/reinsurance/ClaimOverviewSection';
import { Button } from '@/components/atoms/Button';
import { MakeClaimPanel } from '@/components/organisms/reinsurance/panels/MakeClaimPanel';

export default function ClaimDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const { data: placement } = useFacultativePlacement(id);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hasClaim, setHasClaim] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageBreadcrumb} shrink-0 flex items-center justify-between`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link
            href={`/${tenantSlug}/operations/reinsurance/claims`}
            className="hover:text-gray-700 transition-colors"
          >
            Claims
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">{placement?.reference ?? '—'}</span>
        </nav>

        {placement && (
          <Button size="sm" onClick={() => setPanelOpen(true)}>
            {hasClaim ? 'Edit Claim' : 'Make Claim'}
          </Button>
        )}
      </div>

      <MakeClaimPanel
        isOpen={panelOpen}
        placement={placement}
        onClose={() => setPanelOpen(false)}
        onSuccess={() => setHasClaim(true)}
      />

      <div className={`${pageContent} flex-1 overflow-y-auto`}>
        {placement ? (
          <ClaimOverviewSection placement={placement} />
        ) : (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Loading…
          </div>
        )}
      </div>
    </div>
  );
}
