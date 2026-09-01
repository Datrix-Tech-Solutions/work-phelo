'use client';

import { cn } from '@/lib/utils';

interface PermissionTag {
  key: string;
  label: string;
}

interface PermissionTagGroup {
  group: string;
  tags: PermissionTag[];
}

// Not wired to a backend yet — group names are provisional, tags are empty for now.
export const OPERATIONS_PERMISSION_TAG_GROUPS: PermissionTagGroup[] = [
  {
    group: 'Facultative Offer',
    tags: [
      { key: 'create_premium', label: 'Create premium' },
      { key: 'edit_offer', label: 'Edit Offer' },
      { key: 'partial_edit', label: 'Partial Edit' },
      { key: 'reopen_offer', label: 'Reopen Offer' },
      { key: 'force_close', label: 'Force Close' },
      { key: 'endorse_offer', label: 'Endorse offer' },
      { key: 'archive_offer', label: 'Archive offer' },
      { key: 'renew_offer', label: 'Renew offer' },
    ],
  },
  {
    group: 'Premiums',
    tags: [
      { key: 'add_payments', label: 'Add payments' },
      { key: 'disburse_payment', label: 'Disburse payment' },
      { key: 'reverse_payments', label: 'Reverse payments' },
    ],
  },
  {
    group: 'Claims',
    tags: [
      { key: 'add_claims', label: 'Add claims' },
      { key: 'create_notifications', label: 'Create notifications' },
      { key: 'record_recovery', label: 'Record recovery' },
      { key: 'delete_claim', label: 'Delete claim' },
    ],
  },
  {
    group: 'Settings',
    tags: [
      { key: 'manage_risk_types', label: 'Manage risk types' },
      { key: 'manage_risk_class', label: 'Manage risk class' },
    ],
  },
];

interface OperationsPermissionsSectionProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function OperationsPermissionsSection({
  value,
  onChange,
}: OperationsPermissionsSectionProps) {
  const selected = new Set(value);

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(Array.from(next));
  };

  return (
    <div className="flex flex-col gap-6">
      {OPERATIONS_PERMISSION_TAG_GROUPS.map((group) => (
        <div key={group.group} className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-700">{group.group}</p>
          <div className="flex flex-wrap gap-2">
            {group.tags.map((tag) => {
              const isSelected = selected.has(tag.key);
              return (
                <button
                  key={tag.key}
                  type="button"
                  onClick={() => toggle(tag.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                    isSelected
                      ? 'bg-(--module-btn-bg,var(--color-brand)) text-white border-(--module-btn-bg,var(--color-brand))'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700',
                  )}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
