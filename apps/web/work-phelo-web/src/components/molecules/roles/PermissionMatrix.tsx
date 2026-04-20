'use client';

import { useState } from 'react';
import { ChevronDown, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

export const ACTIONS = [
  { key: 'CREATE', label: 'Create' },
  { key: 'VIEW', label: 'Read' },
  { key: 'EDIT', label: 'Update' },
  { key: 'DELETE', label: 'Delete' },
];

// featureKey matches the keys in user.featureConfig.hr
// 'management' has no toggle — always available
export const HR_FEATURES = [
  { key: 'departments', label: 'Department Management' },
  { key: 'branches', label: 'Branch Management' },
  { key: 'employees', label: 'Employee Management' },
  { key: 'leave', label: 'Leave Management' },
  { key: 'appraisal', label: 'Appraisal Management' },
  { key: 'timeclock', label: 'Time Management' },
  { key: 'projects', label: 'Project Management' },
  { key: 'payroll', label: 'Payroll Management' },
  { key: 'assets', label: 'Asset Management' },
  { key: 'management', label: 'HR Management' },
];

export type FeaturePermissions = Record<string, string[]>;

// Kept for any existing imports that reference FeatureDefinition
export interface FeatureDefinition {
  key: string;
  label: string;
  actions: { key: string; label: string }[];
}

interface PermissionMatrixProps {
  value: FeaturePermissions;
  onChange?: (value: FeaturePermissions) => void;
  readOnly?: boolean;
}

const EMPTY_HR_FEATURES: Record<string, boolean> = {};

export function PermissionMatrix({ value, onChange, readOnly = false }: PermissionMatrixProps) {
  const [expanded, setExpanded] = useState(true);
  const hrFeatures = useAuthStore((s) => s.user?.featureConfig?.hr ?? EMPTY_HR_FEATURES);

  const isLocked = (featureKey: string) => {
    if (featureKey === 'management') return false;
    // Locked when the tenant has the feature explicitly disabled
    return featureKey in hrFeatures && hrFeatures[featureKey] === false;
  };

  const toggle = (featureKey: string, actionKey: string) => {
    if (readOnly || !onChange) return;
    const current = value[featureKey] ?? [];
    const next = current.includes(actionKey)
      ? current.filter((a) => a !== actionKey)
      : [...current, actionKey];
    onChange({ ...value, [featureKey]: next });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Access Levels</p>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {/* Module header */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <ChevronDown
            className={cn(
              'w-4 h-4 text-gray-500 transition-transform duration-200',
              !expanded && '-rotate-90',
            )}
          />
          <span className="text-sm font-semibold text-gray-700">Human Resource</span>
        </button>

        {expanded && (
          <div className="divide-y divide-gray-100">
            {HR_FEATURES.map((feature) => {
              const locked = isLocked(feature.key);
              const granted = value[feature.key] ?? [];

              return (
                <div key={feature.key} className="px-4 py-3.5">
                  <p className="text-sm font-semibold text-gray-800 mb-2.5">{feature.label}</p>

                  {locked ? (
                    <div className="flex items-center justify-center gap-2 py-3 rounded-lg bg-gray-100 text-gray-400">
                      <Lock className="w-4 h-4" />
                      <span className="text-sm">Upgrade to unlock</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-6">
                      {ACTIONS.map((action) => (
                        <label
                          key={action.key}
                          className={cn(
                            'flex items-center gap-1.5 select-none',
                            readOnly ? 'cursor-default' : 'cursor-pointer',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={granted.includes(action.key)}
                            disabled={readOnly}
                            onChange={() => toggle(feature.key, action.key)}
                            className="w-4 h-4 accent-brand rounded cursor-pointer disabled:cursor-default"
                          />
                          <span className="text-sm text-gray-600">{action.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
