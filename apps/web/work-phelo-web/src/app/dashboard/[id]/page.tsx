// TENANT LANDING PAGE //

'use client';

import { use } from 'react';
import { useTenant, useTenantUsers, useTenantAudit } from '@/hooks/useTenants';
import { useUpdateModules, useUpdateFeatures } from '@/hooks/useModuleConfig';
import Link from 'next/link';
import { CompanyHeader } from '@/components/organisms/CompanyHeader';
import { CompanyInfoCard } from '@/components/organisms/CompanyInfoCard';
import { ModuleConfiguration, Module } from '@/components/organisms/ModuleConfiguration';
import { RecentActivities } from '@/components/organisms/RecentActivities';

/* ── Types ── */
interface TenantUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'EMPLOYEE' | 'MANAGER';
  status: string;
}

interface AuditLog {
  id: string;
  resource: string;
  action: string;
  createdAt: string;
  changes?: { after?: Record<string, unknown> };
}

interface AuditData {
  logs: AuditLog[];
}

const DEFAULT_MODULES: Module[] = [
  {
    id: 'hr',
    key: 'hr',
    name: 'HR Module',
    description: 'Manage employees, attendance, payroll…',
    enabled: false,
    options: [
      {
        key: 'employees',
        label: 'Employee Management',
        description: 'Add and manage employee records',
      },
      {
        key: 'attendance',
        label: 'Attendance Tracking',
        description: 'Track daily attendance and leave',
      },
      { key: 'payroll', label: 'Payroll', description: 'Process and manage payroll' },
    ],
  },
  {
    id: 'accounting',
    key: 'accounting',
    name: 'Accounting Module',
    description: 'Manage invoices, expenses, and reports…',
    enabled: false,
    options: [
      { key: 'invoices', label: 'Invoices', description: 'Create and manage invoices' },
      { key: 'expenses', label: 'Expenses', description: 'Track business expenses' },
    ],
  },
  {
    id: 'marketing',
    key: 'marketing',
    name: 'Marketing Module',
    description: 'Manage campaigns, leads, and analytics…',
    enabled: false,
    options: [
      { key: 'campaigns', label: 'Campaigns', description: 'Run and track marketing campaigns' },
      { key: 'leads', label: 'Leads', description: 'Manage leads and conversions' },
    ],
  },
  {
    id: 'operations',
    key: 'operations',
    name: 'Operations Module',
    description: 'Manage campaigns, leads, and analytics…',
    enabled: false,
    options: [
      { key: 'operations', label: 'Operations', description: 'Run and track operations campaigns' },
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

  const admin = (users as any[]).find((u: any) => u.role === 'TENANT_ADMIN');

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
          modules={DEFAULT_MODULES}
          onToggle={(moduleId, enabled) => {
            console.log('toggle', moduleId, enabled);
          }}
          onSave={(modules) => {
            console.log('save', modules);
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
