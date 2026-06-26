'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/atoms/icons';
import { pageBreadcrumb, pageContent, pagePx } from '@/lib/layout';
import { NewInvoiceForm } from '@/components/organisms/accounting/forms/NewInvoiceForm';

export default function NewReceivableInvoicePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const router = useRouter();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageBreadcrumb} shrink-0 flex items-center`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link
            href={`/${tenantSlug}/accounting/accountsreceivable`}
            className="hover:text-gray-700 transition-colors"
          >
            Accounts Receivable
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">New Invoice</span>
        </nav>
      </div>

      <div className={`${pagePx} pt-4 pb-2 shrink-0`}>
        <h2 className="text-base font-semibold text-gray-900">New Customer Invoice</h2>
      </div>

      <div className={`${pageContent} flex-1 overflow-y-auto`}>
        <NewInvoiceForm
          vendorLabel="Customer"
          onCancel={() => router.push(`/${tenantSlug}/accounting/accountsreceivable`)}
        />
      </div>
    </div>
  );
}
