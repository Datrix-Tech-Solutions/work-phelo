'use client';

import { useState, useMemo } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { cn, inputClass } from '@/lib/utils';
import { HR_FEATURES, ACTIONS } from '@/components/molecules/roles/PermissionMatrix';
import { FEATURE_PERMISSION_MAPPING } from '@/lib/permissionMap';
import { usePermissionResources, useGrantPermission } from '@/hooks/useRoles';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { PermissionAction } from '@/types/roles';

interface AssignPermissionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  userId: string;
}

const featureOptions = HR_FEATURES.map((f) => ({ value: f.key, label: f.label }));

function AssignPermissionPanelInner({
  onClose,
  employeeName,
  userId,
}: Omit<AssignPermissionPanelProps, 'isOpen'>) {
  const toast = useToast();
  const [selectedFeature, setSelectedFeature] = useState('');
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());
  const [expiresAt, setExpiresAt] = useState('');
  const [featureError, setFeatureError] = useState('');

  const { data: resources = [] } = usePermissionResources();
  const { mutateAsync: grantPermission, isPending: isSaving } = useGrantPermission();

  // resourceName → resourceId lookup
  const resourceIdMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of resources) m.set(r.name, r.id);
    return m;
  }, [resources]);

  const featureLabel = HR_FEATURES.find((f) => f.key === selectedFeature)?.label ?? '';

  const toggleAction = (action: string) => {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      next.has(action) ? next.delete(action) : next.add(action);
      return next;
    });
  };

  const handleFeatureChange = (value: string) => {
    setSelectedFeature(value);
    setSelectedActions(new Set());
    setFeatureError('');
  };

  const handleSave = async () => {
    if (!selectedFeature) {
      setFeatureError('Please select a feature');
      return;
    }
    if (selectedActions.size === 0) {
      setFeatureError('Please select at least one permission');
      return;
    }

    // Map the UI feature + UI actions to backend {resource, action} pairs.
    // E.g. Leave + DELETE → { resource: 'leave', action: 'APPROVE' }
    // E.g. Time Management + VIEW → 4 grants (attendance, time-corrections, timesheets, schedules)
    const mapping = FEATURE_PERMISSION_MAPPING[selectedFeature] ?? {};
    const grants: { resourceId: string; action: PermissionAction }[] = [];
    const seen = new Set<string>();

    for (const uiAction of selectedActions) {
      for (const { resource, action } of mapping[uiAction] ?? []) {
        const resourceId = resourceIdMap.get(resource);
        if (!resourceId) continue; // skip unseeded resources (branches, projects, assets)
        const key = `${resourceId}:${action}`;
        if (seen.has(key)) continue;
        seen.add(key);
        grants.push({ resourceId, action: action as PermissionAction });
      }
    }

    if (grants.length === 0) {
      toast.error('No matching backend resources found for this feature');
      return;
    }

    try {
      await Promise.all(
        grants.map((g) =>
          grantPermission({
            userId,
            resourceId: g.resourceId,
            action: g.action,
            expiresAt: expiresAt || undefined,
          }),
        ),
      );
      toast.success(
        `${grants.length} permission${grants.length !== 1 ? 's' : ''} granted to ${employeeName}`,
      );
      onClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to grant permissions'));
    }
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title="Assign Permissions"
      description={`Grant additional permissions to ${employeeName}.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={isSaving} loadingText="Saving..." onClick={handleSave}>
            Save Permissions
          </Button>
        </div>
      }
    >
      {/* Feature picker */}
      <SearchSelect
        label="Feature"
        placeholder="Select a feature..."
        options={featureOptions}
        value={selectedFeature}
        onChange={handleFeatureChange}
        error={featureError}
      />

      {/* Action checkboxes — only shown after a feature is selected */}
      {selectedFeature && (
        <div className="flex flex-col gap-2.5">
          <p className="text-sm font-semibold text-gray-800">{featureLabel}</p>
          <div className="flex flex-col gap-2">
            {ACTIONS.map((action) => (
              <label
                key={action.key}
                className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedActions.has(action.key)}
                  onChange={() => toggleAction(action.key)}
                  className="w-4 h-4 accent-brand cursor-pointer rounded"
                />
                <span
                  className={cn(
                    'text-sm',
                    selectedActions.has(action.key)
                      ? 'font-semibold text-gray-900'
                      : 'text-gray-600',
                  )}
                >
                  {action.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Expires At date picker */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-gray-900">
          Expires At <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className={inputClass()}
        />
        {expiresAt && (
          <p className="text-xs text-gray-400">
            Permission will automatically expire on{' '}
            {new Date(expiresAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
      </div>
    </SidePanel>
  );
}

export function AssignPermissionPanel({ isOpen, ...props }: AssignPermissionPanelProps) {
  if (!isOpen) {
    return (
      <SidePanel isOpen={false} onClose={props.onClose} title="">
        {null}
      </SidePanel>
    );
  }
  return <AssignPermissionPanelInner key={props.userId} {...props} />;
}
