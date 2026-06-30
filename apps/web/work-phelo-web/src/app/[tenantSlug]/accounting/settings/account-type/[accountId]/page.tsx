'use client';

import { use } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { AccountTypeOverview } from '@/components/molecules/accounting/AccountTypeOverview';
import { AccountTransactionsTable } from '@/components/organisms/accounting/tables/AccountTransactionsTable';

// TODO: replace with useAccountType(accountId) hook once API is ready
const MOCK_ACCOUNTS = [
  {
    id: '1',
    accountName: 'Main Operating Account',
    accountType: 'Current',
    bankName: 'Ghana Commercial Bank',
    bankCode: 'GCB',
    bankBranch: 'Accra Main Branch',
    accountNumber: '1234567890',
    status: 'Active' as const,
  },
];

export default function AccountTypeDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; accountId: string }>;
}) {
  const { tenantSlug, accountId } = use(params);

  const account = MOCK_ACCOUNTS.find((a) => a.id === accountId) ?? null;
  const base = `/${tenantSlug}/accounting/settings/account-type`;

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Account Type
        </Link>
        <Icons.ChevronRight className="w-5 h-5" />
        <span className="text-gray-700 font-medium">{account?.accountName ?? '—'}</span>
      </nav>

      {!account ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          Account not found.
        </div>
      ) : (
        <>
          <AccountTypeOverview account={account} />
          <AccountTransactionsTable />
        </>
      )}
    </div>
  );
}
