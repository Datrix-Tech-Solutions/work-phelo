'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/atoms/icons';
import { Button } from '@/components/atoms/Button';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { MakeClaimPanel } from '@/components/organisms/reinsurance/panels/MakeClaimPanel';
import { ClaimSummary } from '@/components/molecules/reinsurance/ClaimSummary';
import { Facultative } from '@/types/reinsurance';

export default function NewClaimPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();

  const [panelOpen, setPanelOpen] = useState(true);
  const [placement, setPlacement] = useState<Facultative | null>(null);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageBreadcrumb} shrink-0 flex items-center justify-between gap-4`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400 shrink-0">
          <Link
            href={`/${tenantSlug}/operations/reinsurance/claims`}
            className="hover:text-gray-700 transition-colors"
          >
            Claims
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">Add New Claim</span>
        </nav>

        <Button onClick={() => setPanelOpen(true)}>Make Claim</Button>
      </div>

      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto`}>
        <div className="max-w-sm">
          <ClaimSummary placement={placement} />
        </div>
      </div>

      <MakeClaimPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onPlacementResolved={setPlacement}
        onSuccess={(claim) =>
          router.push(
            `/${tenantSlug}/operations/reinsurance/claims/${claim.id}?placementId=${claim.placementId}`,
          )
        }
      />
    </div>
  );
}
