'use client';

import { useState, useMemo } from 'react';
import { X, ShieldOff } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { cn, inputClass } from '@/lib/utils';
import {
  PERMISSION_ACTION_LABELS,
  RESOURCE_ACTIONS,
  isPermissionUiVisibleResource,
} from '@/lib/permissionMap';
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
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [selectedActions, setSelectedActions] = useState<Set<PermissionAction>>(new Set());
  const [expiresAt, setExpiresAt] = useState('');
  const [resourceError, setResourceError] = useState('');

  const { data: resources = [] } = usePermissionResources();
  const { data: userPerms, isLoading: isLoadingPerms } = useUserPermissions(userId);
  const { mutateAsync: grantPermission, isPending: isSaving } = useGrantPermission();
  const { mutate: revokePermission, isPending: isRevoking } = useRevokePermission();

  const directPermissions = (userPerms?.directPermissions ?? []) as unknown as DirectPerm[];

  const resourceOptions = useMemo(() => {
    return resources
      .filter(
        (resource) =>
          resource.isActive &&
          isPermissionUiVisibleResource(resource.name) &&
          (RESOURCE_ACTIONS[resource.name] ?? []).length > 0,
      )
      .sort((a, b) => a.module.localeCompare(b.module) || a.name.localeCompare(b.name))
      .map((resource) => ({
        value: resource.id,
        label: formatResourceName(resource.name),
        sublabel: `${resource.module}${resource.description ? ` - ${resource.description}` : ''}`,
      }));
  }, [resources]);

  const selectedResource = resources.find((resource) => resource.id === selectedResourceId);
  const availableActions = (
    selectedResource ? (RESOURCE_ACTIONS[selectedResource.name] ?? []) : []
  ) as PermissionAction[];

  const toggleAction = (action: PermissionAction) => {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return next;
    });
  };

  const handleResourceChange = (value: string) => {
    setSelectedResourceId(value);
    setSelectedActions(new Set());
    setResourceError('');
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
    if (!selectedResourceId || !selectedResource) {
      setResourceError('Please select a resource');
      return;
    }
    if (selectedActions.size === 0) {
      setResourceError('Please select at least one action');
      return;
    }

    try {
      await Promise.all(
        Array.from(selectedActions).map((action) =>
          grantPermission({
            userId,
            resourceId: selectedResourceId,
            action,
            expiresAt: expiresAt || undefined,
          }),
        ),
      );
      toast.success(
        `${selectedActions.size} ${formatResourceName(selectedResource.name)} permission${selectedActions.size !== 1 ? 's' : ''} granted to ${employeeName}`,
      );
      setSelectedResourceId('');
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
      title="Grant Direct Permissions"
      description={`Use one-off direct permission overrides for ${employeeName}. These are exceptions on top of the base role and any assigned permission sets.`}
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

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Changes appear in this panel immediately. The affected user may need to refresh or sign in
        again before their live session reflects the new access.
      </div>

      {/* ── Grant new permission ──────────────────────────────── */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Grant new permission
      </p>

      <SearchSelect
        label="Resource"
        placeholder="Select a resource..."
        options={resourceOptions}
        value={selectedResourceId}
        onChange={handleResourceChange}
        error={resourceError}
      />

      {selectedResource && (
        <div className="flex flex-col gap-2.5">
          <p className="text-sm font-semibold text-gray-800">
            {formatResourceName(selectedResource.name)}
          </p>
          <div className="flex flex-col gap-2">
            {availableActions.map((action) => (
              <label
                key={action}
                className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedActions.has(action)}
                  onChange={() => toggleAction(action)}
                  className="w-4 h-4 accent-brand cursor-pointer rounded"
                />
                <span
                  className={cn(
                    'text-sm',
                    selectedActions.has(action) ? 'font-semibold text-gray-900' : 'text-gray-600',
                  )}
                >
                  {PERMISSION_ACTION_LABELS[action] ?? action}
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
