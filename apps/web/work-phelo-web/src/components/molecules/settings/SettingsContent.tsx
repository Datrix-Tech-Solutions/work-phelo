'use client';

import { useState } from 'react';
import { pageHeader, pagePx, pageContent } from '@/lib/layout';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { ChangePasswordTab } from '@/components/molecules/settings/ChangePasswordTab';
import { AppearanceTab } from '@/components/molecules/settings/AppearanceTab';

type SettingsTab = 'security' | 'appearance';

const TABS = [
  { key: 'security', label: 'Change Password' },
  { key: 'appearance', label: 'Appearance' },
];

export function SettingsContent() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('security');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Manage your account and workspace preferences
        </p>
      </div>

      <div className={`${pagePx} shrink-0`}>
        <TabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(t) => setActiveTab(t as SettingsTab)}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className={pageContent}>
          {activeTab === 'security' && <ChangePasswordTab />}
          {activeTab === 'appearance' && <AppearanceTab />}
        </div>
      </div>
    </div>
  );
}
