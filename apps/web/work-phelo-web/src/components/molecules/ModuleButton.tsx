'use client';

import { cn } from '@/lib/utils';

interface ModuleButtonProps {
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  iconBg?: string;
  onClick?: () => void;
}

const LockIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export function ModuleButton({
  name,
  description,
  icon,
  enabled,
  iconBg,
  onClick,
}: ModuleButtonProps) {
  return (
    <button
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      className={cn(
        'relative w-full flex flex-col items-center text-center gap-4 p-6 rounded-card border transition-all duration-200',
        enabled
          ? 'bg-white border-gray-200 cursor-pointer hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5'
          : 'bg-gray-50 border-gray-200 cursor-not-allowed',
      )}
    >
      {/* Lock badge — top right, only when disabled */}
      {!enabled && (
        <div className="absolute top-3 right-3 w-7 h-7 rounded-full border border-gray-300 bg-white flex items-center justify-center text-gray-400">
          <LockIcon />
        </div>
      )}

      {/* Icon */}
      <div
        className={cn(
          'w-14 h-14 rounded-card flex items-center justify-center',
          !enabled && 'bg-gray-200',
        )}
        style={
          enabled && iconBg
            ? { backgroundColor: iconBg }
            : enabled
              ? { backgroundColor: '#0D2244' }
              : undefined
        }
      >
        <div className={cn(enabled ? 'text-white' : 'text-gray-400')}>{icon}</div>
      </div>

      {/* Text */}
      <div className="flex flex-col gap-1.5">
        <span
          className={cn(
            'text-sm font-bold leading-tight',
            enabled ? 'text-gray-900' : 'text-gray-400',
          )}
        >
          {name}
        </span>
        <span
          className={cn('text-xs leading-relaxed', enabled ? 'text-gray-500' : 'text-gray-400')}
        >
          {description}
        </span>
      </div>
    </button>
  );
}
