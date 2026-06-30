'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { VendorOverview } from '@/components/molecules/accounting/VendorOverview';
import { AccountingContactsTab } from '@/components/molecules/accounting/AccountingContactsTab';
import { AccountTransactionsTable } from '@/components/organisms/accounting/tables/AccountTransactionsTable';
import { Vendor } from '@/types/accounting';

// TODO: replace with useVendor(vendorId) hook once API is ready
const MOCK_VENDORS: Vendor[] = [
  {
    id: '1',
    vendorCode: 'VND-001',
    vendorName: 'Acme Supplies Ltd',
    contactPerson: 'John Mensah',
    email: 'john.mensah@acmesupplies.com',
    phone: '+233 24 000 0001',
    outstandingBalance: 12500.0,
    currency: 'GHS',
    status: 'Active',
    contacts: [
      {
        id: 'c1',
        fullName: 'John Mensah',
        jobTitle: 'Sales Manager',
        email: 'john.mensah@acmesupplies.com',
        phone: '+233 24 000 0001',
        isPrimary: true,
      },
      {
        id: 'c2',
        fullName: 'Abena Owusu',
        jobTitle: 'Accounts Receivable',
        email: 'abena.owusu@acmesupplies.com',
        phone: '+233 24 000 0002',
        isPrimary: false,
      },
    ],
  },
];

type VendorTab = 'transactions' | 'contacts';

const TABS = [
  { key: 'transactions', label: 'Transactions' },
  { key: 'contacts', label: 'Contacts' },
];

export default function VendorDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; vendorId: string }>;
}) {
  const { tenantSlug, vendorId } = use(params);
  const [activeTab, setActiveTab] = useState<VendorTab>('transactions');

  const vendor = MOCK_VENDORS.find((v) => v.id === vendorId) ?? null;
  const base = `/${tenantSlug}/accounting/settings/vendors`;

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Vendors
        </Link>
        <Icons.ChevronRight className="w-5 h-5" />
        <span className="text-gray-700 font-medium">{vendor?.vendorName ?? '—'}</span>
      </nav>

      {!vendor ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          Vendor not found.
        </div>
      ) : (
        <>
          <VendorOverview vendor={vendor} />

          <div className="flex flex-col">
            <TabBar
              tabs={TABS}
              activeTab={activeTab}
              onTabChange={(t) => setActiveTab(t as VendorTab)}
            />
            <div className="pt-5">
              {activeTab === 'transactions' && <AccountTransactionsTable />}
              {activeTab === 'contacts' && <AccountingContactsTab contacts={vendor.contacts} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
