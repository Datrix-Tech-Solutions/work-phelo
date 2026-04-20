'use client';

import { useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import {
  PermissionMatrix,
  FeaturePermissions,
} from '@/components/molecules/roles/PermissionMatrix';
import { reverseTransformFeaturePermissions } from '@/lib/permissionMap';

interface CompanyRole {
  id: string;
  name: string;
  isSystem: boolean;
  permissions?: Record<string, unknown> | null;
}

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

  const handleClose = () => {
    onClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={`${role.name} — Permissions`}
      description="Set what this role can access across each feature."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
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
      }
    >
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
  return <RolePermissionsPanelInner {...props} role={props.role} />;
}
