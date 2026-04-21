'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { User } from '@/types/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, setUser, setLoading, setPermissions } = useAuthStore();

  useEffect(() => {
    // If a non-employee user is already in the store, nothing left to fetch.
    // For employees: if permissions are already loaded (e.g. after a previous fetch), also skip.
    // But if user is an EMPLOYEE with an empty permissions array (e.g. just logged in via the
    // login flow which only calls setUser), we still need to fetch their permissions.
    if (user) {
      setLoading(false);
      return;
    }

    api
      .get<{ user: User }>('/auth/me')
      .then(async (res) => {
        const authUser = res.data.user;
        // Employees have an HR profile — fetch isManager from it.
        // TENANT_ADMIN and SUPER_ADMIN don't have employee records, skip.
        if (authUser.role === 'EMPLOYEE') {
          try {
            const empRes = await api.get<{ isManager: boolean }>('/hr/employees/me');
            authUser.isManager = empRes.data.isManager ?? false;
          } catch {
            // Not critical — leave isManager undefined; UI falls back to role check
          }

          // Fetch granular effective permissions for non-admin users.
          // SUPER_ADMIN and TENANT_ADMIN bypass permission checks entirely.
          try {
            const permRes = await api.get<{ effectivePermissions: string[] }>(
              `/auth/permissions/users/${authUser.id}`,
            );
            setPermissions(permRes.data.effectivePermissions ?? []);
          } catch {
            // Fail open on error — usePermission will deny unknown checks
          }
        }
        setUser(authUser);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
