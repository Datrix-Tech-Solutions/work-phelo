'use client';

import { useState, useEffect } from 'react';
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

export function RolePermissionsPanel({
  isOpen,
  onClose,
  role,
  onSave,
  isSaving,
}: RolePermissionsPanelProps) {
  const [featurePermissions, setFeaturePermissions] = useState<FeaturePermissions>({});

  // Populate from existing role permissions when panel opens
  useEffect(() => {
    if (!isOpen || !role) return;
    const backend = (role.permissions ?? {}) as Record<string, string[]>;
    setFeaturePermissions(reverseTransformFeaturePermissions(backend));
  }, [isOpen, role]);

  if (!role) return null;

  const handleClose = () => {
    setFeaturePermissions({});
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
