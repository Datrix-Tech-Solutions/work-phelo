// TENANT LANDING PAGE //

'use client';

import { use, useMemo } from 'react';
import { useTenant, useTenantUsers, useTenantAudit } from '@/hooks/useTenants';
import { useUpdateModules, useUpdateFeatures } from '@/hooks/useModuleConfig';
import Link from 'next/link';
import { CompanyHeader } from '@/components/organisms/shared/CompanyHeader';
import { CompanyInfoCard } from '@/components/organisms/shared/CompanyInfoCard';
import { ModuleConfiguration, Module } from '@/components/organisms/shared/ModuleConfiguration';
import { RecentActivities } from '@/components/organisms/superadmin/RecentActivities';
import { DEFAULT_MODULES } from '@/lib/ModuleDefaults';
import { ChevronLeftIcon } from 'lucide-react';

function ChevronIcon() {
  return <ChevronLeftIcon />;
}

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: tenant, isLoading: tenantLoading, error: tenantError } = useTenant(id);
  const { data: users = [] } = useTenantUsers(id);
  const { data: auditData } = useTenantAudit(id);

  const updateModules = useUpdateModules(id);
  const updateFeatures = useUpdateFeatures(id);

  const admin = (users as any[]).find((u: any) => u.role === 'TENANT_ADMIN');

  const moduleConfig = (tenant?.moduleConfig as Record<string, boolean>) ?? {};
  const featureConfig = (tenant?.featureConfig as Record<string, Record<string, boolean>>) ?? {};

  const modules: Module[] = useMemo(
    () =>
      DEFAULT_MODULES.map((m) => ({
        ...m,
        enabled: moduleConfig[m.key] ?? false,
        options: m.options?.map((o) => ({
          ...o,
          enabled: featureConfig[m.key]?.[o.key] ?? false,
        })),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(moduleConfig), JSON.stringify(featureConfig)],
  );

  const activities = (auditData?.logs ?? []).map((log: any) => ({
    id: log.id,
    title: `${log.resource} ${log.action.toLowerCase()}`,
    description: log.changes?.after
      ? Object.entries(log.changes.after)
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join(', ')
      : undefined,
    date: new Date(log.createdAt)
      .toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
      .replace(/\//g, '.'),
  }));

  if (tenantLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Loading…</div>
    );
  }

  if (tenantError || !tenant) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-500">
          {tenantError ? 'Failed to load company. Please try again.' : 'Company not found.'}
        </p>
        <Link href="/dashboard" className="text-sm text-[#0D2244] hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <main className="flex-1 min-h-0 overflow-hidden w-full max-w-7xl mx-auto px-6 py-6 flex flex-col gap-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 shrink-0">
        <Link href="/dashboard" className="hover:text-gray-700 transition-colors">
          Dashboard
        </Link>
        <ChevronIcon />
        <span className="text-gray-700 font-medium">{tenant.name}</span>
      </nav>

      <CompanyHeader id={tenant.id} name={tenant.name} slug={tenant.slug} status={tenant.status} />

      <div className="grid grid-cols-[2fr_2fr] gap-5 flex-1 min-h-0">
        <CompanyInfoCard
          id={tenant.id}
          name={tenant.name}
          slug={tenant.slug}
          size={tenant.size}
          industry={tenant.industry}
          location={tenant.country}
          contact={tenant.phone}
          admin={
            admin
              ? {
                  name: `${admin.firstName} ${admin.lastName}`,
                  status: admin.status,
                  email: admin.email,
                }
              : undefined
          }
          onEditCompany={function (): void {
            throw new Error('Function not implemented.');
          }}
          onEditAdmin={function (): void {
            throw new Error('Function not implemented.');
          }}
        />
        <ModuleConfiguration
          modules={modules}
          onToggle={(moduleId, enabled) => {
            updateModules.mutate({ [moduleId]: enabled });
          }}
          onSave={(updatedModules) => {
            updatedModules.forEach((m) => {
              if (m.options && m.enabled) {
                const features = Object.fromEntries(
                  m.options.map((o) => [o.key, (o as any).enabled ?? false]),
                );
                updateFeatures.mutate({ module: m.key, features });
              }
            });
          }}
        />
      </div>

      <div className="h-75 shrink-0">
        <RecentActivities activities={activities} onViewAll={() => {}} />
      </div>
    </main>
  );
}
