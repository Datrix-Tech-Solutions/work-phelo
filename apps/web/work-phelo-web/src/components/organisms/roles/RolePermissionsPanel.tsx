'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';

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
  onSave: (roleId: string, featurePermissions: Record<string, string[]>) => void;
  isSaving: boolean;
}

export function RolePermissionsPanel({ isOpen, onClose, role }: RolePermissionsPanelProps) {
  if (!role) return null;

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={`${role.name} — Permissions`}
      description="Set Permissions for selected roles"
    >
      {null}
    </SidePanel>
  );
}
