'use client';

import { use, useState } from 'react';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { StageSettings } from '@/components/organisms/hr/recruitment/StageSettings';
import { usePermission } from '@/hooks/hr/usePermission';
import { useRedirectWhenDenied } from '@/hooks/hr/useRedirectWhenDenied';
import { Permission } from '@/lib/permissionMap';
import { pageHeader, pageContent, pagePx } from '@/lib/layout';

const TABS = [{ key: 'stages', label: 'Stage Settings' }];

export default function ConfigurationsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const canView = usePermission(Permission.READ_RECRUITMENT_STAGES);

  const [activeTab, setActiveTab] = useState('stages');

  useRedirectWhenDenied(canView === false, `/${tenantSlug}/hr/recruitment`);

  if (!canView) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-bold text-gray-900">Configurations</h1>
      </div>
      <div className={`${pagePx} shrink-0`}>
        <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto flex flex-col`}>
        {activeTab === 'stages' && <StageSettings />}
      </div>
    </div>
  );
}
