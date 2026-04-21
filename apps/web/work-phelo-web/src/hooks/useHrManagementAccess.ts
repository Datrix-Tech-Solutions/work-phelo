import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';

export function useHrManagementAccess() {
  const canManageLeaveTypes = usePermission(Permission.MANAGE_LEAVE_TYPES);
  const canConfigureAppraisal = usePermission(Permission.CONFIGURE_APPRAISAL);
  const canReadRoles = usePermission(Permission.READ_COMPANY_ROLES);
  const canManageRoles = usePermission(Permission.MANAGE_COMPANY_ROLES);
  const canAssignRoles = usePermission(Permission.ASSIGN_ROLE);

  const canAccessRoles = canReadRoles || canManageRoles || canAssignRoles;
  const hasAnyManagementAccess =
    canManageLeaveTypes || canConfigureAppraisal || canAccessRoles;

  return {
    canManageLeaveTypes,
    canConfigureAppraisal,
    canReadRoles,
    canManageRoles,
    canAssignRoles,
    canAccessRoles,
    hasAnyManagementAccess,
  };
}
