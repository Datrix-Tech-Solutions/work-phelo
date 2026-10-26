'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CalendarPlus,
  CalendarCheck,
  Wallet,
  Package,
  Clock,
  KanbanSquare,
  ChevronDown,
  Briefcase,
  Trophy,
  CalendarRange,
  FolderKanban,
  LucideIcon,
} from 'lucide-react';
import { waterIconStyle } from '@/lib/utils';
import { QuickActionsPanel } from '@/components/atoms/QuickActionsPanel';
import { ModuleIcons, MODULE_COLORS } from '@/components/atoms/icons';
import { useTabUsage } from '@/hooks/useTabUsage';
import { useProjectLabels } from '@/hooks/useModuleLabels';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';

export interface QuickActionModule {
  key: string;
  label: string;
  href: string;
}

interface QuickActionsCardProps {
  onApplyLeave: () => void;
  onLeave: () => void;
  onPayslips: () => void;
  onAssets: () => void;
  onSchedules: () => void;
  onProjects: () => void;
  leaveBadge?: number;
  projectsBadge?: number;
  /** Modules the user has access to — mirrors the sidebar's "Modules" group. */
  modules?: QuickActionModule[];
  onModule?: (module: QuickActionModule) => void;
}

interface Entry {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  onClick: () => void;
  badge?: number;
  allowed?: boolean;
}

const MAX_INLINE = 9;

export function QuickActionsCard({
  onApplyLeave,
  onLeave,
  onPayslips,
  onAssets,
  onSchedules,
  onProjects,
  leaveBadge,
  projectsBadge,
  modules = [],
  onModule,
}: QuickActionsCardProps) {
  const labels = useProjectLabels();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const canRecruitment = usePermission(Permission.READ_RECRUITMENT_VACANCIES);
  const canPayroll = usePermission(Permission.READ_PAYROLL);
  const canAppraisals = usePermission(Permission.READ_APPRAISALS);
  const canLeave = usePermission(Permission.READ_ALL_LEAVES);
  const canProjects = usePermission(Permission.READ_PROJECTS);
  const canAssets = usePermission(Permission.READ_ASSETS);
  const [expanded, setExpanded] = useState(false);

  /* Personal shortcuts + accessible modules, one flat list. Colors are distinct
     per entry so it reads as separate shortcuts, not one repeated tile. */
  const entries = useMemo<Entry[]>(() => {
    const personal: Entry[] = [
      {
        key: 'apply-leave',
        label: 'Apply for Leave',
        icon: CalendarPlus,
        color: '#0d9488',
        onClick: onApplyLeave,
      },
      {
        key: 'my-leave',
        label: 'My Leave',
        icon: CalendarCheck,
        color: '#2a78d6',
        onClick: onLeave,
        badge: leaveBadge,
      },
      {
        key: 'my-payslips',
        label: 'My Payslips',
        icon: Wallet,
        color: '#1baf7a',
        onClick: onPayslips,
      },
      { key: 'my-assets', label: 'My Assets', icon: Package, color: '#eb6834', onClick: onAssets },
      {
        key: 'my-schedules',
        label: 'My Schedules',
        icon: Clock,
        color: '#e34948',
        onClick: onSchedules,
      },
      {
        key: 'my-projects',
        label: `My ${labels.plural}`,
        icon: KanbanSquare,
        color: '#7c3aed',
        onClick: onProjects,
        badge: projectsBadge,
      },
    ];

    /* HR management pages, mirroring the sidebar's Management group. Shown only to people
       who can read them; the "My …" shortcuts above stay for personal use. */
    const goTo = (path: string) => () => router.push(`/${tenantSlug}/hr/${path}`);
    const management: Entry[] = [
      {
        key: 'manage-recruitment',
        label: 'Hiring',
        icon: Briefcase,
        color: '#0891b2',
        onClick: goTo('recruitment'),
        allowed: canRecruitment,
      },
      {
        key: 'manage-payroll',
        label: 'Payroll',
        icon: Wallet,
        color: '#16a34a',
        onClick: goTo('payroll'),
        allowed: canPayroll,
      },
      {
        key: 'manage-appraisal',
        label: 'Performance',
        icon: Trophy,
        color: '#d97706',
        onClick: goTo('appraisal'),
        allowed: canAppraisals,
      },
      {
        key: 'manage-leave',
        label: 'Leave Management',
        icon: CalendarRange,
        color: '#2563eb',
        onClick: goTo('leave'),
        allowed: canLeave,
      },
      {
        key: 'manage-projects',
        label: `${labels.plural} Management`,
        icon: FolderKanban,
        color: '#9333ea',
        onClick: goTo('projects'),
        allowed: canProjects,
      },
      {
        key: 'manage-assets',
        label: 'Asset Management',
        icon: Package,
        color: '#ea580c',
        onClick: goTo('assets'),
        allowed: canAssets,
      },
    ].filter((entry) => entry.allowed);

    const moduleEntries: Entry[] = modules.map((module) => ({
      key: `module:${module.key}`,
      label: module.label,
      icon: ModuleIcons[module.key as keyof typeof ModuleIcons] ?? KanbanSquare,
      color: MODULE_COLORS[module.key] ?? 'var(--color-brand)',
      onClick: () => onModule?.(module),
    }));

    return [...personal, ...management, ...moduleEntries];
  }, [
    onApplyLeave,
    onLeave,
    onPayslips,
    onAssets,
    onSchedules,
    onProjects,
    leaveBadge,
    projectsBadge,
    labels.plural,
    router,
    tenantSlug,
    canRecruitment,
    canPayroll,
    canAppraisals,
    canLeave,
    canProjects,
    canAssets,
    modules,
    onModule,
  ]);

  // Float the most-used entries to the top (frozen per session), least-used
  // spill below the "More" toggle — same behaviour as the profile tabs.
  const { tabs: ordered, recordUse } = useTabUsage('dashboard-quick-actions-usage', entries, {
    pinFirst: false,
  });

  const hasOverflow = ordered.length > MAX_INLINE;
  const primary = hasOverflow ? ordered.slice(0, MAX_INLINE - 1) : ordered;
  const overflow = hasOverflow ? ordered.slice(MAX_INLINE - 1) : [];
  const visible = expanded ? [...primary, ...overflow] : primary;

  const tileClass =
    'group relative flex flex-col items-center gap-1 rounded-xl border border-(--qa-tile-border,rgba(255,255,255,0.4)) bg-(--qa-tile-bg,rgba(255,255,255,0.95)) p-1.5 shadow-sm transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-1 hover:bg-(--tint) hover:shadow-lg';

  return (
    <QuickActionsPanel className="min-h-0 shrink">
      <div className="grid grid-cols-4 gap-1.5 min-h-0 overflow-y-auto">
        {visible.map(({ key, label, icon: Icon, color, onClick, badge }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              recordUse(key);
              onClick();
            }}
            className={tileClass}
            title={label}
            aria-label={label}
            style={
              {
                '--tint': `color-mix(in oklab, ${color} 14%, var(--background))`,
              } as React.CSSProperties
            }
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
              style={waterIconStyle(color)}
            >
              <Icon
                className="w-5 h-5"
                style={{ color: `color-mix(in oklab, ${color} 65%, black)` }}
              />
            </div>
            <span className="w-full text-center text-[11px] font-medium leading-tight text-gray-700 line-clamp-2">
              {label}
            </span>
            {badge != null && badge > 0 && (
              <span className="absolute right-0.5 top-0.5 min-w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </button>
        ))}

        {hasOverflow && (
          <button
            type="button"
            onClick={() => setExpanded((o) => !o)}
            className="col-span-4 flex w-full items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10"
          >
            {expanded ? 'Show less' : `More (${overflow.length})`}
            <ChevronDown
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>
    </QuickActionsPanel>
  );
}
