// TENANT DASHBOARD

'use client';

import { use, useMemo } from 'react';
import { useCurrentTenantUsers } from '@/hooks/useTenants';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { TopNav } from '@/components/organisms/shared/TopNav';
import { ModuleButton } from '@/components/molecules/ModuleButton';
import { StatPill } from '@/components/molecules/departments/StatPill';
import { getGreeting } from '@/lib/formatters';
import { ModuleIcons, MODULE_COLORS } from '@/components/atoms/icons';
import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';

/* ── Module definitions ── */
interface ModuleDef {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  route: string;
}

const MODULE_DEFS: ModuleDef[] = [
  {
    key: 'hr',
    name: 'Human Resource',
    description: 'Manage employees, payroll, and attendance',
    icon: <ModuleIcons.hr className="w-7 h-7" />,
    route: 'hr',
  },
  {
    key: 'marketing',
    name: 'Marketing',
    description: 'Manage campaigns, leads, and analytics',
    icon: <ModuleIcons.marketing className="w-7 h-7" />,
    route: 'marketing',
  },
  {
    key: 'accounting',
    name: 'Accounting',
    description: 'Manage invoices, expenses, and reports',
    icon: <ModuleIcons.accounting className="w-7 h-7" />,
    route: 'accounting',
  },
  {
    key: 'operations',
    name: 'Operations',
    description: 'Manage operations, workflows, and tasks',
    icon: <ModuleIcons.operations className="w-7 h-7" />,
    route: 'operations',
  },
];

/* ── Page ── */
export default function TenantDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const firstName = user?.firstName ?? 'User';
  const tenantName = user?.tenantName ?? '';
  const initials = firstName.slice(0, 2).toUpperCase();

  /* ── Fetch users for employee count ── */
  const { data: users = [] } = useCurrentTenantUsers();

  /* ── Derive stats ── */
  const stats = useMemo(() => {
    const total = users.length;

    const active = users.filter((u: { status: string }) => u.status === 'ACTIVE').length;

    const pending = users.filter(
      (u: { status: string }) => u.status === 'PENDING_VERIFICATION' || u.status === 'PENDING',
    ).length;

    return { total, active, pending };
  }, [users]);

  const canViewEmployeeStats = usePermission(Permission.READ_EMPLOYEES);

  /* ── Enabled modules from tenant config ── */
  const moduleConfig = user?.moduleConfig ?? {};
  const enabledKeys = new Set(
    Object.entries(moduleConfig)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key),
  );
  const activeModuleCount = MODULE_DEFS.filter((m) => enabledKeys.has(m.key)).length;

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex flex-col">
      <TopNav
        userInitials={initials}
        notificationCount={0}
        activeTab="portal"
        onTabChange={() => {}}
      />

      <main className="flex-1 min-h-0 overflow-y-auto">
        {/* Welcome banner */}
        <div className="bg-brand mx-6 mt-6 rounded-card px-8 py-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-orange-400 mb-1">{tenantName}</p>
            <h1 className="text-2xl font-bold text-white">
              {getGreeting()}, {firstName}
            </h1>
          </div>
          <div className="flex items-center gap-0">
            {canViewEmployeeStats && (
              <>
                <StatPill label="Active modules" value={activeModuleCount} />
                <StatPill label="Total Employees" value={stats.total} />
                <StatPill label="Active" value={stats.active} />
                <StatPill label="Pending" value={stats.pending} />
              </>
            )}
          </div>
        </div>

        {/* Modules section */}
        <div className="max-w-4xl mx-auto px-6 py-12 flex flex-col items-center gap-8">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900">Your Modules</h2>
            <p className="text-sm text-gray-400 mt-1">Click on a module to get started</p>
          </div>

          <div className="grid grid-cols-4 gap-4 w-full">
            {MODULE_DEFS.map((mod) => {
              const enabled = enabledKeys.has(mod.key);
              return (
                <ModuleButton
                  key={mod.key}
                  name={mod.name}
                  description={mod.description}
                  icon={mod.icon}
                  iconBg={MODULE_COLORS[mod.key]}
                  enabled={enabled}
                  onClick={() => router.push(`/${tenantSlug}/${mod.route}`)}
                />
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
