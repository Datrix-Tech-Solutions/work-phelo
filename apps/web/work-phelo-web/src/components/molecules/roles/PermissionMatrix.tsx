'use client';

import { useState } from 'react';
import { ChevronDown, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PERMISSION_ACTION_LABELS, RESOURCE_ACTIONS } from '@/lib/permissionMap';
import { useAuthStore } from '@/store/auth.store';

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

type ResourceGroup = {
  label: string;
  resources: string[];
};

const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    label: 'Access Management',
    resources: ['users', 'company-roles', 'permission-sets', 'audit-logs'],
  },
  {
    label: 'People',
    resources: [
      'employees',
      'employee-profile',
      'resignations',
      'departments',
      'branches',
      'documents',
    ],
  },
  {
    label: 'Leave and Time',
    resources: ['leave', 'attendance', 'time-corrections', 'timesheets', 'schedules'],
  },
  {
    label: 'Work and Assets',
    resources: ['projects', 'assets'],
  },
  {
    label: 'Payroll and Performance',
    resources: ['payroll', 'allowances', 'appraisals', 'hr-settings'],
  },
];

const RESOURCE_FEATURE_KEYS: Record<string, string> = {
  employees: 'employees',
  'employee-profile': 'employees',
  resignations: 'employees',
  departments: 'departments',
  branches: 'branches',
  documents: 'employees',
  leave: 'leave',
  attendance: 'timeclock',
  'time-corrections': 'timeclock',
  timesheets: 'timeclock',
  schedules: 'scheduling',
  projects: 'projects',
  assets: 'assets',
  payroll: 'payroll',
  allowances: 'payroll',
  appraisals: 'appraisal',
  'hr-settings': 'management',
};

const EMPTY_HR_FEATURES: Record<string, boolean> = {};

function formatResourceName(name: string) {
  return name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PermissionMatrix({ value, onChange, readOnly = false }: PermissionMatrixProps) {
  const [expanded, setExpanded] = useState(true);
  const hrFeatures = useAuthStore((s) => s.user?.featureConfig?.hr ?? EMPTY_HR_FEATURES);

  const isLocked = (resourceName: string) => {
    const featureKey = RESOURCE_FEATURE_KEYS[resourceName];
    if (!featureKey || featureKey === 'management') return false;
    return featureKey in hrFeatures && hrFeatures[featureKey] === false;
  };

  const toggle = (resourceName: string, action: string) => {
    if (readOnly || !onChange) return;
    const current = value[resourceName] ?? [];
    const next = current.includes(action)
      ? current.filter((existingAction) => existingAction !== action)
      : [...current, action];
    onChange({ ...value, [resourceName]: next });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Access Levels</p>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
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
          <span className="text-sm font-semibold text-gray-700">Resource Permissions</span>
        </button>

        {expanded && (
          <div className="divide-y divide-gray-100">
            {RESOURCE_GROUPS.map((group) => (
              <div key={group.label} className="px-4 py-3.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {group.label}
                </p>

                <div className="flex flex-col gap-3">
                  {group.resources.map((resourceName) => {
                    const actions = RESOURCE_ACTIONS[resourceName] ?? [];
                    const locked = isLocked(resourceName);
                    const granted = value[resourceName] ?? [];

                    return (
                      <div key={resourceName} className="rounded-lg border border-gray-100 p-3">
                        <p className="text-sm font-semibold text-gray-800 mb-2.5">
                          {formatResourceName(resourceName)}
                        </p>

                        {locked ? (
                          <div className="flex items-center justify-center gap-2 py-3 rounded-lg bg-gray-100 text-gray-400">
                            <Lock className="w-4 h-4" />
                            <span className="text-sm">Upgrade to unlock</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-x-5 gap-y-2 flex-wrap">
                            {actions.map((action) => (
                              <label
                                key={action}
                                className={cn(
                                  'flex items-center gap-1.5 select-none',
                                  readOnly ? 'cursor-default' : 'cursor-pointer',
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={granted.includes(action)}
                                  disabled={readOnly}
                                  onChange={() => toggle(resourceName, action)}
                                  className="w-4 h-4 accent-brand rounded cursor-pointer disabled:cursor-default"
                                />
                                <span className="text-sm text-gray-600">
                                  {PERMISSION_ACTION_LABELS[action] ?? action}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
