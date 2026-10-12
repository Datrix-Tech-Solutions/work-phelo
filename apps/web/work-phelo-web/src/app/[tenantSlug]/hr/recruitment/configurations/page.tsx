'use client';

import { use } from 'react';
import { usePermission } from '@/hooks/hr/usePermission';
import { useRedirectWhenDenied } from '@/hooks/hr/useRedirectWhenDenied';
import { Permission } from '@/lib/permissionMap';
import { pageHeader, pageContent } from '@/lib/layout';

export default function ConfigurationsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const canView = usePermission(Permission.READ_RECRUITMENT_STAGES);

  useRedirectWhenDenied(canView === false, `/${tenantSlug}/hr/recruitment`);

  if (!canView) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-bold text-gray-900">Configurations</h1>
      </div>
      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto flex flex-col`}>
        <p className="text-sm text-gray-500">Hiring configuration will appear here.</p>
      </div>
    </div>
  );
}
