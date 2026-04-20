'use client';

import { useState, useMemo } from 'react';
import { X, ShieldOff } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { cn, inputClass } from '@/lib/utils';
import { HR_FEATURES, ACTIONS } from '@/components/molecules/roles/PermissionMatrix';
import { FEATURE_PERMISSION_MAPPING } from '@/lib/permissionMap';
import {
  usePermissionResources,
  useGrantPermission,
  useRevokePermission,
  useUserPermissions,
} from '@/hooks/useRoles';
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

// Backend serialises directPermissions with a flat resourceName field (not nested resource object)
type DirectPerm = {
  id: string;
  resourceId: string;
  resourceName: string;
  action: PermissionAction;
  grantedAt: string;
  expiresAt?: string | null;
};

const ACTION_COLORS: Record<string, string> = {
  VIEW: 'bg-blue-50 text-blue-600',
  CREATE: 'bg-green-50 text-green-600',
  EDIT: 'bg-purple-50 text-purple-600',
  DELETE: 'bg-red-50 text-red-600',
  APPROVE: 'bg-amber-50 text-amber-600',
  RUN: 'bg-teal-50 text-teal-600',
  EXPORT: 'bg-gray-100 text-gray-600',
  ASSIGN: 'bg-indigo-50 text-indigo-600',
};

function formatResourceName(name: string) {
  return name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

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
  const { data: userPerms, isLoading: isLoadingPerms } = useUserPermissions(userId);
  const { mutateAsync: grantPermission, isPending: isSaving } = useGrantPermission();
  const { mutate: revokePermission, isPending: isRevoking } = useRevokePermission();

  const directPermissions = (userPerms?.directPermissions ?? []) as unknown as DirectPerm[];

  const resourceIdMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of resources) m.set(r.name, r.id);
    return m;
  }, [resources]);

  const featureLabel = HR_FEATURES.find((f) => f.key === selectedFeature)?.label ?? '';

  const toggleAction = (action: string) => {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return next;
    });
  };

  const handleFeatureChange = (value: string) => {
    setSelectedFeature(value);
    setSelectedActions(new Set());
    setFeatureError('');
  };

  const handleRevoke = (perm: DirectPerm) => {
    revokePermission(
      { userId, resourceId: perm.resourceId, action: perm.action },
      {
        onSuccess: () =>
          toast.success(`${formatResourceName(perm.resourceName)} — ${perm.action} revoked`),
        onError: (err) => toast.error(extractError(err, 'Failed to revoke permission')),
      },
    );
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

    const mapping = FEATURE_PERMISSION_MAPPING[selectedFeature] ?? {};
    const grants: { resourceId: string; action: PermissionAction }[] = [];
    const seen = new Set<string>();

    for (const uiAction of selectedActions) {
      for (const { resource, action } of mapping[uiAction] ?? []) {
        const resourceId = resourceIdMap.get(resource);
        if (!resourceId) continue;
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
      setSelectedFeature('');
      setSelectedActions(new Set());
      setExpiresAt('');
    } catch (err) {
      toast.error(extractError(err, 'Failed to grant permissions'));
    }
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title="Manage Permissions"
      description={`View, grant, and revoke direct permissions for ${employeeName}.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
          <Button isLoading={isSaving} loadingText="Saving..." onClick={handleSave}>
            Grant
          </Button>
        </div>
      }
    >
      {/* ── Active direct permissions ─────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Active direct permissions
        </p>

        {isLoadingPerms ? (
          <div className="flex flex-col gap-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : directPermissions.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-gray-200 px-4 py-3">
            <ShieldOff className="w-4 h-4 text-gray-300 shrink-0" />
            <p className="text-sm text-gray-400 italic">No direct permissions granted yet.</p>
          </div>
        ) : (
          directPermissions.map((perm) => (
            <div
              key={`${perm.resourceId}-${perm.action}`}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={cn(
                    'text-xs font-semibold px-2 py-0.5 rounded-md shrink-0',
                    ACTION_COLORS[perm.action] ?? 'bg-gray-100 text-gray-600',
                  )}
                >
                  {perm.action}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {formatResourceName(perm.resourceName)}
                  </p>
                  {perm.expiresAt && (
                    <p className="text-xs text-amber-500">Expires {formatDate(perm.expiresAt)}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRevoke(perm)}
                disabled={isRevoking}
                className="w-7 h-7 rounded-md flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 shrink-0 ml-2"
                aria-label="Revoke"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* ── Grant new permission ──────────────────────────────── */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Grant new permission
      </p>

      <SearchSelect
        label="Feature"
        placeholder="Select a feature..."
        options={featureOptions}
        value={selectedFeature}
        onChange={handleFeatureChange}
        error={featureError}
      />

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
            Permission will automatically expire on {formatDate(expiresAt)}
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
