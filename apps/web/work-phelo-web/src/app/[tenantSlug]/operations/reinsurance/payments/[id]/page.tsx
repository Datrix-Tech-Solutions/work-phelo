'use client';

import { use } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { pageBreadcrumb } from '@/lib/layout';
import { useFacultativePlacement } from '@/hooks';

export default function PaymentDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const { data: placement } = useFacultativePlacement(id);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageBreadcrumb} shrink-0`}>
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
      </div>
    </div>
  );
}
