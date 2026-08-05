'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Icons } from '@/components/atoms/icons';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { useFacultativePlacement } from '@/hooks';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { BusinessPaymentSection } from '@/components/molecules/reinsurance/BusinessPaymentSection';
import { PaymentHistoryTab } from '@/components/molecules/reinsurance/tabs/PaymentHistoryTab';
import AddPaymentForm from '@/components/organisms/reinsurance/AddPaymentForm';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

type PaymentTab = 'overview' | 'history';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'history', label: 'Payment History' },
];

export default function PaymentDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const searchParams = useSearchParams();
  const fromClosing = searchParams.get('from') === 'closing';
  const {
    data: placement,
    isLoading: placementLoading,
    isError: placementError,
  } = useFacultativePlacement(id);
  const [activeTab, setActiveTab] = useState<PaymentTab>('overview');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageBreadcrumb} shrink-0 flex items-center justify-between`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          {fromClosing ? (
            <>
              <Link
                href={`/${tenantSlug}/operations/reinsurance/facultative`}
                className="hover:text-gray-700 transition-colors"
              >
                Facultative
              </Link>
              <Icons.ChevronRight className="w-5 h-5" />
              <Link
                href={`/${tenantSlug}/operations/reinsurance/facultative?tab=closing`}
                className="hover:text-gray-700 transition-colors"
              >
                Closings
              </Link>
            </>
          ) : (
            <Link
              href={`/${tenantSlug}/operations/reinsurance/payments`}
              className="hover:text-gray-700 transition-colors"
            >
              Payments
            </Link>
          )}
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">
            {displayPolicyNumber(placement?.policyNumber)}
          </span>
        </nav>

        {placement && <AddPaymentForm placementId={id} />}
      </div>

      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto`}>
        {placement ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col">
              <TabBar
                tabs={TABS}
                activeTab={activeTab}
                onTabChange={(t) => setActiveTab(t as PaymentTab)}
              />

              <div className="pt-5">
                {activeTab === 'overview' && <BusinessPaymentSection placement={placement} />}
                {activeTab === 'history' && (
                  <PaymentHistoryTab placementId={id} placement={placement} />
                )}
              </div>
            </div>
          </div>
        ) : placementError ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white/70 p-8 text-center">
            <div className="text-base font-semibold text-gray-900">Payment placement not found</div>
            <p className="max-w-md text-sm text-gray-500">
              This payment workspace is tied to a placement. The placement may no longer be
              available to this tenant, or the page may have been opened with the wrong record ID.
            </p>
            <Link
              href={`/${tenantSlug}/operations/reinsurance/payments`}
              className="text-sm font-semibold text-[var(--module-btn-bg,var(--color-brand))] hover:underline"
            >
              Back to payments
            </Link>
          </div>
        ) : placementLoading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Loading payment workspace…
          </div>
        ) : (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Select a placement from the payments list.
          </div>
        )}
      </div>
    </div>
  );
}
