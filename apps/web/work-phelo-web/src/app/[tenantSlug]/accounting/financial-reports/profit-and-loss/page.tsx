'use client';

import { use } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { ProfitAndLossView } from '@/components/organisms/accounting/ProfitAndLossView';

export default function ProfitAndLossPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const base = `/${tenantSlug}/accounting/financial-reports`;

  return (
    <div className="flex flex-col gap-6 py-6 pr-6 pl-(--page-pl) min-h-0 overflow-y-auto flex-1">
      <nav className="flex items-center gap-2 text-sm text-gray-400 shrink-0">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Financial Reports
        </Link>
        <Icons.ChevronRight className="w-5 h-5" />
        <span className="text-gray-700 font-medium">Profit &amp; Loss Statement</span>
      </nav>
      <ProfitAndLossView />
    </div>
  );
}
