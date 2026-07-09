'use client';

import { ModuleIcons } from '@/components/atoms/icons';
import { cardClass } from '@/lib/utils';

interface QuickActionsCardProps {
  onPayslips: () => void;
  onAssets: () => void;
  onLeave: () => void;
  onSchedules: () => void;
  onProjects: () => void;
  leaveBadge?: number;
  projectsBadge?: number;
}

/** Per-action accent colors — distinct from each other, unlike the shared HR module color. */
const ACTION_COLORS = {
  payslips: '#16a34a', // green-600
  assets: '#2563eb', // blue-600
  leave: '#7c3aed', // violet-600
  schedules: '#0d9488', // teal-600
  projects: '#e11d48', // rose-600
};

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
  badge?: number;
}

function ActionButton({ icon, label, color, onClick, badge }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 group"
      style={{ '--card-accent': color } as React.CSSProperties}
    >
      <div className="relative">
        <div
          className="module-icon-shake w-14 h-14 rounded-full flex items-center justify-center text-white backdrop-blur-sm border border-white/30 -translate-y-0.5 shadow-[0_12px_22px_-6px_color-mix(in_oklab,var(--card-accent)_55%,transparent)] transition-[transform,box-shadow] duration-200 group-hover:scale-105 group-hover:-translate-y-1 group-hover:shadow-[0_18px_30px_-6px_color-mix(in_oklab,var(--card-accent)_65%,transparent)]"
          style={{ backgroundColor: `color-mix(in oklab, ${color} 78%, white 22%)` }}
        >
          {icon}
        </div>
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className="text-xs font-medium text-gray-700 text-center leading-tight">{label}</span>
    </button>
  );
}

export function QuickActionsCard({
  onPayslips,
  onAssets,
  onLeave,
  onSchedules,
  onProjects,
  leaveBadge,
  projectsBadge,
}: QuickActionsCardProps) {
  return (
    <div className={cardClass('p-5 shrink-0 border-gray-200')}>
      <h2 className="text-base font-bold text-gray-900 mb-4">Quick Actions</h2>
      <div className="flex flex-wrap items-start justify-around gap-y-4">
        <ActionButton
          icon={<ModuleIcons.payroll className="w-6 h-6" />}
          label="My Payslips"
          color={ACTION_COLORS.payslips}
          onClick={onPayslips}
        />
        <ActionButton
          icon={<ModuleIcons.assets className="w-6 h-6" />}
          label="My Assets"
          color={ACTION_COLORS.assets}
          onClick={onAssets}
        />
        <ActionButton
          icon={<ModuleIcons.leave className="w-6 h-6" />}
          label="My Leave"
          color={ACTION_COLORS.leave}
          onClick={onLeave}
          badge={leaveBadge}
        />
        <ActionButton
          icon={<ModuleIcons.scheduling className="w-6 h-6" />}
          label="My Schedules"
          color={ACTION_COLORS.schedules}
          onClick={onSchedules}
        />
        <ActionButton
          icon={<ModuleIcons.projects className="w-6 h-6" />}
          label="My Projects"
          color={ACTION_COLORS.projects}
          onClick={onProjects}
          badge={projectsBadge}
        />
      </div>
    </div>
  );
}
