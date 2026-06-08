'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { useFacultativePlacement } from '@/hooks';
import { PaymentBreakdown } from '@/components/molecules/reinsurance/PaymentBreakdown';
import { ReinsurersPaymentTable } from '@/components/molecules/reinsurance/ReinsurersPaymentTable';
import AddPaymentForm from '@/components/organisms/reinsurance/AddPaymentForm';

export default function PaymentDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const { data: placement } = useFacultativePlacement(id);
  const [paidAmount, setPaidAmount] = useState<number | undefined>(undefined);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Breadcrumb */}
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

        {placement && <AddPaymentForm placementId={id} onPaymentRecorded={setPaidAmount} />}
      </div>

      {/* Content */}
      <div className={`${pageContent} flex-1 overflow-y-auto`}>
        {placement ? (
          <div className="flex gap-4 items-start">
            <div className="flex-1 min-w-0">
              <PaymentBreakdown placement={placement} paidAmount={paidAmount} />
            </div>
            <div className="flex-2 min-w-0">
              <ReinsurersPaymentTable
                participants={placement.participants}
                grossPremium={placement.premium ?? 0}
                currency={placement.currency}
              />
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
