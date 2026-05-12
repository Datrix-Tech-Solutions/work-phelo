'use client';

import { useAuthStore } from '@/store/auth.store';
import { PERMISSION_MAP } from '@/lib/permissionMap';

function hasResolvedPermission(
  permissions: string[],
  userRole: string | undefined,
  requiredPermissions: string[],
): boolean {
  if (userRole === 'SUPER_ADMIN' || userRole === 'TENANT_ADMIN') return true;
  if (requiredPermissions.length === 0) return false;

  return requiredPermissions.some((permission) => permissions.includes(permission));
}

export function usePermissionRule(permissionRule: string): boolean {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);

  if (!user) return false;

  return hasResolvedPermission(permissions, user.role, [permissionRule]);
}

export function useAnyPermissionRules(permissionRules: string[]): boolean {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);

  if (!user) return false;

  return hasResolvedPermission(permissions, user.role, permissionRules);
}

export function usePermission(permission: string): boolean {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);

  if (!user) return false;

  const mapped = PERMISSION_MAP[permission];
  if (!mapped || mapped.length === 0) return false;

  return hasResolvedPermission(permissions, user.role, mapped);
}
