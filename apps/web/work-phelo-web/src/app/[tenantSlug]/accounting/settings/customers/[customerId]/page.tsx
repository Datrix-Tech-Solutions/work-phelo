'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { CustomerOverview } from '@/components/molecules/accounting/CustomerOverview';
import { AccountingContactsTab } from '@/components/molecules/accounting/AccountingContactsTab';
import { AccountTransactionsTable } from '@/components/organisms/accounting/tables/AccountTransactionsTable';
import { Customer } from '@/types/accounting';

// TODO: replace with useCustomer(customerId) hook once API is ready
const MOCK_CUSTOMERS: Customer[] = [
  {
    id: '1',
    customerCode: 'CUS-001',
    customerName: 'Bright Future Co.',
    contactPerson: 'Kwame Asante',
    email: 'kwame.asante@brightfuture.com',
    phone: '+233 20 000 0001',
    outstandingBalance: 8750.0,
    currency: 'GHS',
    status: 'Active',
    contacts: [
      {
        id: 'c1',
        fullName: 'Kwame Asante',
        jobTitle: 'CEO',
        email: 'kwame.asante@brightfuture.com',
        phone: '+233 20 000 0001',
        isPrimary: true,
      },
      {
        id: 'c2',
        fullName: 'Efua Boateng',
        jobTitle: 'Finance Officer',
        email: 'efua.boateng@brightfuture.com',
        phone: '+233 20 000 0002',
        isPrimary: false,
      },
    ],
  },
];

type CustomerTab = 'transactions' | 'contacts';

const TABS = [
  { key: 'transactions', label: 'Transactions' },
  { key: 'contacts', label: 'Contacts' },
];

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; customerId: string }>;
}) {
  const { tenantSlug, customerId } = use(params);
  const [activeTab, setActiveTab] = useState<CustomerTab>('transactions');

  const customer = MOCK_CUSTOMERS.find((c) => c.id === customerId) ?? null;
  const base = `/${tenantSlug}/accounting/settings/customers`;

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Customers
        </Link>
        <Icons.ChevronRight className="w-5 h-5" />
        <span className="text-gray-700 font-medium">{customer?.customerName ?? '—'}</span>
      </nav>

      {!customer ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          Customer not found.
        </div>
      ) : (
        <>
          <CustomerOverview customer={customer} />

          <div className="flex flex-col">
            <TabBar
              tabs={TABS}
              activeTab={activeTab}
              onTabChange={(t) => setActiveTab(t as CustomerTab)}
            />
            <div className="pt-5">
              {activeTab === 'transactions' && <AccountTransactionsTable />}
              {activeTab === 'contacts' && <AccountingContactsTab contacts={customer.contacts} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
