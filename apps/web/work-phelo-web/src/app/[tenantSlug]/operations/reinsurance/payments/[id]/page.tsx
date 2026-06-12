'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { useFacultativePlacement, usePlacementPayments } from '@/hooks';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { BusinessPaymentSection } from '@/components/molecules/reinsurance/BusinessPaymentSection';
import { PaymentHistoryTab } from '@/components/molecules/reinsurance/tabs/PaymentHistoryTab';
import AddPaymentForm from '@/components/organisms/reinsurance/AddPaymentForm';

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
  const { data: placement } = useFacultativePlacement(id);
  const { data: payments = [] } = usePlacementPayments(id);
  const [activeTab, setActiveTab] = useState<PaymentTab>('overview');

  const paidAmount = useMemo(
    () =>
      payments
        .filter((p) => p.status === 'RECORDED')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0),
    [payments],
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
          <span className="text-gray-700 font-medium">{placement?.reference ?? '—'}</span>
        </nav>

        {placement && <AddPaymentForm placementId={id} />}
      </div>

      <div className={`${pageContent} flex-1 overflow-y-auto`}>
        {placement ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col">
              <TabBar
                tabs={TABS}
                activeTab={activeTab}
                onTabChange={(t) => setActiveTab(t as PaymentTab)}
              />

              <div className="pt-5">
                {activeTab === 'overview' && (
                  <BusinessPaymentSection placement={placement} paidAmount={paidAmount} />
                )}
                {activeTab === 'history' && (
                  <PaymentHistoryTab placementId={id} placement={placement} />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Loading…
          </div>
        )}
      </div>
    </div>
  );
}
