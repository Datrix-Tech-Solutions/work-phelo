'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import {
  PermissionMatrix,
  FeaturePermissions,
} from '@/components/molecules/roles/PermissionMatrix';
import { reverseTransformFeaturePermissions } from '@/lib/permissionMap';
import type { CompanyRole } from '@/types/roles';

interface RolePermissionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  role: CompanyRole | null;
  onSave: (roleId: string, featurePermissions: FeaturePermissions) => void;
  isSaving: boolean;
}

// Inner component — remounted via key={role.id} in RolesContent so the
// lazy useState initializer re-runs whenever a different role is opened.
function RolePermissionsPanelInner({
  isOpen,
  onClose,
  role,
  onSave,
  isSaving,
}: RolePermissionsPanelProps & { role: CompanyRole }) {
  const [featurePermissions, setFeaturePermissions] = useState<FeaturePermissions>(() => {
    const backend = (role.permissions ?? {}) as Record<string, string[]>;
    return reverseTransformFeaturePermissions(backend);
  });

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={`${role.name} — Permissions`}
      description="Set what this role can access across each feature."
      footer={
        !role.isSystem ? (
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              isLoading={isSaving}
              loadingText="Saving..."
              onClick={() => onSave(role.id, featurePermissions)}
            >
              Save Permissions
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        )
      }
    >
      {role.isSystem && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">
            System roles are managed by WorkPhelo and cannot be edited. Their permissions reflect
            the platform&apos;s built-in access levels.
          </p>
        </div>
      )}

      <PermissionMatrix
        value={featurePermissions}
        onChange={role.isSystem ? undefined : setFeaturePermissions}
        readOnly={role.isSystem}
      />
    </SidePanel>
  );
}

export function RolePermissionsPanel(props: RolePermissionsPanelProps) {
  if (!props.role) return null;
  return <RolePermissionsPanelInner key={props.role.id} {...props} role={props.role} />;
}
