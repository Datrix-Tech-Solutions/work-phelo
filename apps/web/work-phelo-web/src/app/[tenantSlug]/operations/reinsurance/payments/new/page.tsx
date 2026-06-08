'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { useFacultatives } from '@/hooks';
import { PaymentBreakdown } from '@/components/molecules/reinsurance/PaymentBreakdown';
import AddPaymentForm from '@/components/organisms/reinsurance/AddPaymentForm';

export default function AddPaymentPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const { data: facultatives = [] } = useFacultatives();

  const [selectedPlacementIds, setSelectedPlacementIds] = useState<string[]>([]);
  const [paidAmount, setPaidAmount] = useState<number | undefined>(undefined);

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
          <span className="text-gray-700 font-medium">Make Payment</span>
        </nav>

        <AddPaymentForm
          onPlacementsChange={setSelectedPlacementIds}
          onPaymentRecorded={setPaidAmount}
        />
      </div>

      <div className={`${pageContent} flex-1 overflow-y-auto`}>
        <div className="flex flex-col gap-4 max-w-lg">
          {selectedPlacements.length > 0 ? (
            selectedPlacements.map((placement) => (
              <PaymentBreakdown key={placement!.id} placement={placement} paidAmount={paidAmount} />
            ))
          ) : (
            <PaymentBreakdown />
          )}
        </div>
      </div>
    </div>
  );
}
