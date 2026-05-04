import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';

export function useHrManagementAccess() {
  const canManageLeaveTypes = usePermission(Permission.MANAGE_LEAVE_TYPES);
  const canConfigureAppraisal = usePermission(Permission.CONFIGURE_APPRAISAL);
  const canManageRoles = usePermission(Permission.MANAGE_ROLES);
  const canAssignRoles = usePermission(Permission.ASSIGN_ROLE);

  const canAccessRoles = canManageRoles || canAssignRoles;
  const hasAnyManagementAccess = canManageLeaveTypes || canConfigureAppraisal || canAccessRoles;

  return {
    canManageLeaveTypes,
    canConfigureAppraisal,
    canManageRoles,
    canAssignRoles,
    canAccessRoles,
    hasAnyManagementAccess,
  };
}
