'use client';

import { ModuleIcons, moduleColor } from '@/components/atoms/icons';

interface QuickActionsCardProps {
  onPayslips: () => void;
  onAssets: () => void;
  onLeave: () => void;
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}

function ActionButton({ icon, label, color, onClick }: ActionButtonProps) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-white transition-transform group-hover:scale-105"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>
      <span className="text-xs font-medium text-gray-700 text-center leading-tight">{label}</span>
    </button>
  );
}

export function QuickActionsCard({ onPayslips, onAssets, onLeave }: QuickActionsCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-card p-5 shrink-0">
      <h2 className="text-base font-bold text-gray-900 mb-4">Quick Actions</h2>
      <div className="flex items-start justify-around">
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
        />
      </div>
    </div>
  );
}
