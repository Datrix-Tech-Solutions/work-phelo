'use client';

import { cn } from '@/lib/utils';

export interface FeatureDefinition {
  key: string;
  label: string;
  actions: { key: string; label: string }[];
}

export const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    key: 'employees',
    label: 'Employees',
    actions: [
      { key: 'VIEW', label: 'View' },
      { key: 'CREATE', label: 'Create' },
      { key: 'EDIT', label: 'Edit' },
      { key: 'DELETE', label: 'Offboard' },
    ],
  },
  {
    key: 'departments',
    label: 'Departments',
    actions: [
      { key: 'VIEW', label: 'View' },
      { key: 'CREATE', label: 'Create' },
      { key: 'EDIT', label: 'Edit' },
      { key: 'DELETE', label: 'Delete' },
    ],
  },
  {
    key: 'branches',
    label: 'Branches',
    actions: [
      { key: 'VIEW', label: 'View' },
      { key: 'CREATE', label: 'Create' },
      { key: 'EDIT', label: 'Edit' },
      { key: 'DELETE', label: 'Delete' },
    ],
  },
  {
    key: 'leave',
    label: 'Leave',
    actions: [
      { key: 'VIEW', label: 'View' },
      { key: 'CREATE', label: 'Create' },
      { key: 'APPROVE', label: 'Approve' },
    ],
  },
  {
    key: 'attendance',
    label: 'Attendance',
    actions: [
      { key: 'VIEW', label: 'View' },
      { key: 'APPROVE', label: 'Approve' },
    ],
  },
  {
    key: 'timesheets',
    label: 'Timesheets',
    actions: [
      { key: 'VIEW', label: 'View' },
      { key: 'APPROVE', label: 'Approve' },
    ],
  },
  {
    key: 'schedules',
    label: 'Schedules',
    actions: [
      { key: 'VIEW', label: 'View' },
      { key: 'CREATE', label: 'Create' },
      { key: 'EDIT', label: 'Edit' },
    ],
  },
  {
    key: 'payroll',
    label: 'Payroll',
    actions: [
      { key: 'VIEW', label: 'View' },
      { key: 'RUN', label: 'Run' },
      { key: 'APPROVE', label: 'Approve' },
    ],
  },
  {
    key: 'appraisals',
    label: 'Appraisals',
    actions: [
      { key: 'VIEW', label: 'View' },
      { key: 'CREATE', label: 'Create' },
      { key: 'APPROVE', label: 'Approve' },
    ],
  },
];

export type FeaturePermissions = Record<string, string[]>;

interface PermissionMatrixProps {
  value: FeaturePermissions;
  onChange?: (value: FeaturePermissions) => void;
  readOnly?: boolean;
}

export function PermissionMatrix({ value, onChange, readOnly = false }: PermissionMatrixProps) {
  const toggle = (featureKey: string, actionKey: string) => {
    if (readOnly || !onChange) return;
    const current = value[featureKey] ?? [];
    const next = current.includes(actionKey)
      ? current.filter((a) => a !== actionKey)
      : [...current, actionKey];
    onChange({ ...value, [featureKey]: next });
  };

  const toggleAll = (featureKey: string, feature: FeatureDefinition) => {
    if (readOnly || !onChange) return;
    const current = value[featureKey] ?? [];
    const all = feature.actions.map((a) => a.key);
    const isAllSelected = all.every((a) => current.includes(a));
    onChange({ ...value, [featureKey]: isAllSelected ? [] : all });
  };

  return (
    <div className="flex flex-col border border-gray-200 rounded-xl overflow-hidden text-sm">
      {/* Column header */}
      <div
        className="grid bg-gray-50 border-b border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide"
        style={{ gridTemplateColumns: '1fr repeat(4, 80px)' }}
      >
        <span>Feature</span>
        <span className="text-center">View</span>
        <span className="text-center">Create</span>
        <span className="text-center">Edit</span>
        <span className="text-center">Delete / Other</span>
      </div>

      {FEATURE_DEFINITIONS.map((feature, i) => {
        const granted = value[feature.key] ?? [];
        const allSelected = feature.actions.every((a) => granted.includes(a.key));
        const someSelected = feature.actions.some((a) => granted.includes(a.key));

        // Map actions to fixed columns: VIEW, CREATE, EDIT, DELETE/other
        const COL_KEYS = ['VIEW', 'CREATE', 'EDIT', 'DELETE'];

        return (
          <div
            key={feature.key}
            className={cn(
              'grid items-center px-4 py-3',
              i < FEATURE_DEFINITIONS.length - 1 && 'border-b border-gray-100',
              someSelected && 'bg-brand/[0.02]',
            )}
            style={{ gridTemplateColumns: '1fr repeat(4, 80px)' }}
          >
            {/* Feature label + select-all checkbox */}
            <div className="flex items-center gap-2">
              {!readOnly && (
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={() => toggleAll(feature.key, feature)}
                  className="w-3.5 h-3.5 accent-brand cursor-pointer"
                />
              )}
              <span className={cn('font-medium text-gray-700', someSelected && 'text-gray-900')}>
                {feature.label}
              </span>
            </div>

            {/* Action columns */}
            {COL_KEYS.map((colKey) => {
              // Find an action in this feature that maps to this column
              // VIEW→VIEW, CREATE→CREATE, EDIT→EDIT, DELETE→DELETE or other actions (APPROVE, RUN, etc.)
              let action = feature.actions.find((a) => a.key === colKey);
              if (!action && colKey === 'DELETE') {
                // Put APPROVE, RUN, ASSIGN in the last column if no DELETE
                action = feature.actions.find((a) => ['APPROVE', 'RUN', 'ASSIGN'].includes(a.key));
              }

              if (!action) {
                return <span key={colKey} />;
              }

              const checked = granted.includes(action.key);
              return (
                <div key={colKey} className="flex flex-col items-center gap-1">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={readOnly}
                    onChange={() => toggle(feature.key, action!.key)}
                    className="w-3.5 h-3.5 accent-brand cursor-pointer disabled:cursor-default"
                  />
                  {colKey === 'DELETE' && action.key !== 'DELETE' && (
                    <span className="text-[10px] text-gray-400 leading-tight text-center">
                      {action.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
