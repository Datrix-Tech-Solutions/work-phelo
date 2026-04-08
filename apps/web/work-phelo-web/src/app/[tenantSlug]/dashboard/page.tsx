// TENANT DASHBOARD

'use client';

import { use, useMemo } from 'react';
import { useCurrentTenantUsers } from '@/hooks/useTenants';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { TopNav } from '@/components/organisms/TopNav';
import { ModuleButton } from '@/components/molecules/ModuleButton';
import { Activity, BookUser, DollarSign } from 'lucide-react';

/* ── Nav ── */

/* ── Types ── */
interface TenantUser {
  id: string;
  status: 'ACTIVE' | 'PENDING_VERIFICATION' | 'INACTIVE' | 'PENDING';
}

/* ── Greeting ── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ── Module definitions ── */
const HRIcon = () => <BookUser />;

const MarketingIcon = () => <Activity />;

const AccountingIcon = () => <DollarSign />;

const OperationIcon = () => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    <path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
  </svg>
);

interface ModuleDef {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  route: string;
}

const MODULE_DEFS: ModuleDef[] = [
  {
    key: 'hr',
    name: 'Human Resource',
    description: 'Manage employees, payroll, and attendance',
    icon: <HRIcon />,
    iconBg: '#0D2244',
    route: 'hr',
  },
  {
    key: 'marketing',
    name: 'Marketing',
    description: 'Manage campaigns, leads, and analytics',
    icon: <MarketingIcon />,
    iconBg: '#22994A',
    route: 'marketing',
  },
  {
    key: 'accounting',
    name: 'Accounting',
    description: 'Manage invoices, expenses, and reports',
    icon: <AccountingIcon />,
    iconBg: '#D97706',
    route: 'accounting',
  },
  {
    key: 'operation',
    name: 'Operation',
    description: 'Manage operations, workflows, and tasks',
    icon: <OperationIcon />,
    iconBg: '#6B7280',
    route: 'operation',
  },
];

/* ── Stat pill ── */
function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-start gap-0.5 px-6  ">
      <span className="text-xs text-white/60">{label}</span>
      <span className="text-2xl font-bold text-white">{value === 0 ? '—' : value}</span>
    </div>
  );
}

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

    const active = users.filter((u: any) => u.status === 'ACTIVE').length;

    const pending = users.filter(
      (u: any) => u.status === 'PENDING_VERIFICATION' || u.status === 'PENDING',
    ).length;

    return { total, active, pending };
  }, [users]);

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
        <div className="bg-[#0D2244] mx-6 mt-6 rounded-card px-8 py-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-orange-400 mb-1">{tenantName}</p>
            <h1 className="text-2xl font-bold text-white">
              {getGreeting()}, {firstName}
            </h1>
          </div>
          <div className="flex items-center gap-0">
            <StatPill label="Active modules" value={activeModuleCount} />
            <StatPill label="Total Employees" value={stats.total} />
            <StatPill label="Active" value={stats.active} />
            <StatPill label="Pending" value={stats.pending} />
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
                  iconBg={mod.iconBg}
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
