'use client';

import { ModuleIcons, moduleColor } from '@/components/atoms/icons';

interface QuickActionsCardProps {
  onPayslips: () => void;
  onAssets: () => void;
  onLeave: () => void;
  onSchedules: () => void;
  onProjects: () => void;
  leaveBadge?: number;
  projectsBadge?: number;
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
  badge?: number;
}

function ActionButton({ icon, label, color, onClick, badge }: ActionButtonProps) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group">
      <div className="relative">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-white transition-transform group-hover:scale-105"
          style={{ backgroundColor: color }}
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
    <div className="bg-white border border-gray-200 rounded-card p-5 shrink-0">
      <h2 className="text-base font-bold text-gray-900 mb-4">Quick Actions</h2>
      <div className="flex flex-wrap items-start justify-around gap-y-4">
        <ActionButton
          icon={<ModuleIcons.payroll className="w-6 h-6" />}
          label="My Payslips"
          color={moduleColor('payroll')}
          onClick={onPayslips}
        />
        <ActionButton
          icon={<ModuleIcons.assets className="w-6 h-6" />}
          label="My Assets"
          color={moduleColor('assets')}
          onClick={onAssets}
        />
        <ActionButton
          icon={<ModuleIcons.leave className="w-6 h-6" />}
          label="My Leave"
          color={moduleColor('leave')}
          onClick={onLeave}
          badge={leaveBadge}
        />
        <ActionButton
          icon={<ModuleIcons.scheduling className="w-6 h-6" />}
          label="My Schedules"
          color={moduleColor('scheduling')}
          onClick={onSchedules}
        />
        <ActionButton
          icon={<ModuleIcons.projects className="w-6 h-6" />}
          label="My Projects"
          color={moduleColor('projects')}
          onClick={onProjects}
          badge={projectsBadge}
        />
      </div>
    </div>
  );
}
