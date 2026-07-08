// SUPER ADMIN LAYOUT //

'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { TopNav } from '@/components/organisms/shared/TopNav';
import { AppBackground } from '@/components/atoms/AppBackground';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? 'Admin';
  const initials = `${firstName[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  const [activeTab, setActiveTab] = useState('portal');

  return (
    <AppBackground className="h-screen overflow-hidden flex flex-col">
      <TopNav
        userInitials={initials}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        notificationCount={0}
        logoVariant="image"
      />
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
    </AppBackground>
  );
}
