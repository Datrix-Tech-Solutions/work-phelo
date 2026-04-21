'use client';

import { useAuthStore } from '@/store/auth.store';
import { PERMISSION_MAP } from '@/lib/permissionMap';

export function usePermission(permission: string): boolean {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);

  if (!user) return false;
  if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') return true;

  const mapped = PERMISSION_MAP[permission];
  if (!mapped || mapped.length === 0) return false;

  return mapped.some((p) => permissions.includes(p));
}
