// SUPER ADMIN LAYOUT //

'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { TopNav } from '@/components/organisms/TopNav';

const NAV_TABS = [
  { label: 'Portal', value: 'portal' },
  { label: 'Reports', value: 'reports' },
  { label: 'Integrations', value: 'integrations' },
  { label: 'Support', value: 'support' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? 'Admin';
  const initials = firstName.slice(0, 2).toUpperCase();

  const [activeTab, setActiveTab] = useState('portal');

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex flex-col">
      <TopNav
        userInitials={initials}
        tabs={NAV_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        notificationCount={0}
      />
      {children}
    </div>
  );
}
