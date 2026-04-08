// TENANT LANDING PAGE //

'use client';

import { use, useMemo } from 'react';
import { useTenant, useTenantUsers, useTenantAudit } from '@/hooks/useTenants';
import { useUpdateModules, useUpdateFeatures } from '@/hooks/useModuleConfig';
import Link from 'next/link';
import { CompanyHeader } from '@/components/organisms/CompanyHeader';
import { CompanyInfoCard } from '@/components/organisms/CompanyInfoCard';
import { ModuleConfiguration, Module } from '@/components/organisms/ModuleConfiguration';
import { RecentActivities } from '@/components/organisms/RecentActivities';
import { TenantUser, AuditLog, AuditData } from '@/types/tenant';

// Module keys and feature keys must match the backend featureConfig schema exactly
const DEFAULT_MODULES: Module[] = [
  {
    id: 'hr',
    key: 'hr',
    name: 'HR Module',
    description: 'Manage employees, leave, payroll, appraisals and more',
    enabled: false,
    options: [
      {
        key: 'departments',
        label: 'Departments',
        description: 'Manage company departments and structure',
      },
      {
        key: 'branches',
        label: 'Branches',
        description: 'Manage company branch locations',
      },
      {
        key: 'employees',
        label: 'Employees',
        description: 'Manage employee records and profiles',
      },
      {
        key: 'leave',
        label: 'Leave Management',
        description: 'Employee leave requests and balances',
      },
      {
        key: 'appraisal',
        label: 'Appraisal',
        description: 'Performance reviews and cycles',
      },
      {
        key: 'timeclock',
        label: 'Time Clock',
        description: 'Clock in/out and attendance tracking',
      },
      {
        key: 'scheduling',
        label: 'Smart Scheduling',
        description: 'Shift and workforce scheduling',
      },
      {
        key: 'projects',
        label: 'Project & Tasks',
        description: 'Projects and task tracking',
      },
      {
        key: 'payroll',
        label: 'Payroll',
        description: 'Process and manage payroll',
      },
      {
        key: 'assets',
        label: 'Asset Management',
        description: 'Company asset tracking',
      },
    ],
  },
  {
    id: 'accounting',
    key: 'accounting',
    name: 'Accounting Module',
    description: 'Manage invoices, expenses, and financial reports',
    enabled: false,
    options: [],
  },
  {
    id: 'marketing',
    key: 'marketing',
    name: 'Marketing Module',
    description: 'Manage leads, sales pipeline, and contacts',
    enabled: false,
    options: [
      { key: 'leads', label: 'Lead Management', description: 'Manage leads and conversions' },
      {
        key: 'pipeline',
        label: 'Sales Pipeline',
        description: 'Track deals through pipeline stages',
      },
      { key: 'contacts', label: 'Contact Management', description: 'Manage customer contacts' },
    ],
  },
];

function ChevronIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  /* ── Fetch tenant ── */
  const { data: tenant, isLoading: tenantLoading, error: tenantError } = useTenant(id);

  /* ── Fetch tenant users (find the TENANT_ADMIN) ── */
  const { data: users = [] } = useTenantUsers(id);

  /* ── Fetch audit logs ── */
  const { data: auditData } = useTenantAudit(id);

  const updateModules = useUpdateModules(id);
  const updateFeatures = useUpdateFeatures(id);

  const admin = (users as any[]).find((u: any) => u.role === 'TENANT_ADMIN');

  // Build modules from real tenant config — memoized so ModuleConfiguration
  // only re-syncs its local state when the server data actually changes
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

      {/* Company header */}
      <CompanyHeader id={tenant.id} name={tenant.name} slug={tenant.slug} status={tenant.status} />

      {/* Two-column layout */}
      <div className="grid grid-cols-[3fr_2fr] gap-5 flex-1 min-h-0">
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

      {/* Recent activities */}
      <div className="h-75 shrink-0">
        <RecentActivities activities={activities} onViewAll={() => {}} />
      </div>
    </main>
  );
}
