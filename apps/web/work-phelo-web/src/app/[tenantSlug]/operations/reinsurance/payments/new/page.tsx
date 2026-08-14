'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { cardClass } from '@/lib/utils';
import { useFacultatives } from '@/hooks';
import { PaymentBreakdown } from '@/components/molecules/reinsurance/PaymentBreakdown';
import { BusinessPaymentSection } from '@/components/molecules/reinsurance/BusinessPaymentSection';
import AddPaymentForm from '@/components/organisms/reinsurance/AddPaymentForm';

export default function AddPaymentPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const { data: facultatives = [] } = useFacultatives();

  const [selectedPlacementIds, setSelectedPlacementIds] = useState<string[]>([]);

  const selectedPlacements = useMemo(
    () => selectedPlacementIds.map((id) => facultatives.find((f) => f.id === id)).filter(Boolean),
    [facultatives, selectedPlacementIds],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageBreadcrumb} shrink-0 flex items-center justify-between`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link
            href={`/${tenantSlug}/operations/reinsurance/payments`}
            className="hover:text-gray-700 transition-colors"
          >
            Payments
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">Receive Cedant Premium</span>
        </nav>

        <AddPaymentForm
          defaultOpen
          onPlacementsChange={(ids) => {
            setSelectedPlacementIds(ids);
          }}
        />
      </div>

      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto`}>
        {selectedPlacements.length > 0 ? (
          <div className="flex flex-col gap-6">
            {selectedPlacements.map((placement) => {
              return <BusinessPaymentSection key={placement!.id} placement={placement!} />;
            })}
          </div>
        ) : (
          <div className={cardClass('max-w-sm p-5')}>
            <PaymentBreakdown />
          </div>
        )}
      </div>
    </div>
  );
}
