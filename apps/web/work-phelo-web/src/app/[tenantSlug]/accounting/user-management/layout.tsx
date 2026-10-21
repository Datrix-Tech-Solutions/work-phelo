'use client';

import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { pageHeader, pageContent, pagePx } from '@/lib/layout';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { useAccountingAccess } from '@/hooks/accounting/useAccountingAccess';

export default function UserManagementLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/${tenantSlug}/accounting/user-management`;

  const { canSeeTab } = useAccountingAccess();
  const allTabs = [
    { key: 'roles-permissions', label: 'Roles & Permissions', href: `${base}/roles-permissions` },
    { key: 'module-users', label: 'Module Users', href: `${base}/module-users` },
  ];
  const tabs = allTabs.filter((tab) => canSeeTab('user-management', tab.key));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
        <div className={pageHeader}>
          <h1 className="text-xl font-semibold text-gray-900">User Management</h1>
        </div>
        <TabBar tabs={tabs} className={pagePx} />
      </div>

      <main className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto flex flex-col')}>
        {children}
      </main>
    </div>
  );
}
