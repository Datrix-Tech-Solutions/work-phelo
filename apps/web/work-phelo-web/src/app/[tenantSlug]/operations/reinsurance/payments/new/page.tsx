'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { useFacultatives } from '@/hooks';
import { PaymentBreakdown } from '@/components/molecules/reinsurance/PaymentBreakdown';
import { BusinessPaymentSection } from '@/components/molecules/reinsurance/BusinessPaymentSection';
import AddPaymentForm from '@/components/organisms/reinsurance/AddPaymentForm';

export default function AddPaymentPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const { data: facultatives = [] } = useFacultatives();

  const [selectedPlacementIds, setSelectedPlacementIds] = useState<string[]>([]);
  const [paidAmount, setPaidAmount] = useState<number | undefined>(undefined);
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  const selectedPlacements = useMemo(
    () => selectedPlacementIds.map((id) => facultatives.find((f) => f.id === id)).filter(Boolean),
    [facultatives, selectedPlacementIds],
  );

  const totalNetPremium = useMemo(
    () =>
      selectedPlacements.reduce((sum, p) => {
        if (!p) return sum;
        const facPremium = ((p.facultativeOffer ?? 0) / 100) * (p.premium ?? 0);
        return sum + facPremium * (1 - (p.commission ?? 0) / 100);
      }, 0),
    [selectedPlacements],
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
          <span className="text-gray-700 font-medium">Make New Payment</span>
        </nav>

        <AddPaymentForm
          defaultOpen
          onPlacementsChange={(ids) => {
            setSelectedPlacementIds(ids);
            setAllocations({});
          }}
          onPaymentRecorded={setPaidAmount}
          onAllocationsRecorded={setAllocations}
        />
      </div>

      <div className={`${pageContent} flex-1 overflow-y-auto`}>
        {selectedPlacements.length > 0 ? (
          <div className="flex flex-col gap-6">
            {selectedPlacements.map((placement) => {
              const hasManualAllocations = Object.keys(allocations).length > 0;

              const proportionalAmount =
                !hasManualAllocations && paidAmount !== undefined && totalNetPremium > 0
                  ? (() => {
                      const facPremium =
                        ((placement!.facultativeOffer ?? 0) / 100) * (placement!.premium ?? 0);
                      const netPremium = facPremium * (1 - (placement!.commission ?? 0) / 100);
                      return (netPremium / totalNetPremium) * paidAmount;
                    })()
                  : undefined;

              const displayAmount = hasManualAllocations
                ? (allocations[placement!.id] ?? 0)
                : proportionalAmount;

              return (
                <BusinessPaymentSection
                  key={placement!.id}
                  placement={placement!}
                  paidAmount={displayAmount}
                />
              );
            })}
          </div>
        ) : (
          <div className="max-w-sm">
            <PaymentBreakdown />
          </div>
        )}
      </div>
    </div>
  );
}
