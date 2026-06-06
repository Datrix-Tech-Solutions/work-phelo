'use client';

import { use } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import AddPaymentForm from '@/components/organisms/reinsurance/AddPaymentForm';

export default function AddPaymentPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Breadcrumb */}
      <div className={`${pageBreadcrumb} shrink-0`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link
            href={`/${tenantSlug}/operations/reinsurance/payments`}
            className="hover:text-gray-700 transition-colors"
          >
            Payments
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">make Payment</span>
        </nav>
      </div>

      {/* Content */}
      <div className={`${pageContent} flex-1 overflow-y-auto`}>
        <div className="max-w-2xl">
          <AddPaymentForm />
        </div>
      </div>
    </div>
  );
}
