'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { User } from '@/types/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, setUser, setLoading, setPermissions } = useAuthStore();

  useEffect(() => {
    if (user) {
      setLoading(false);
      return;
    }

    api
      .get<{ user: User; permissions: string[] }>('/auth/me')
      .then(async (res) => {
        const authUser = res.data.user;

        // Permissions for EMPLOYEE users are embedded in the /auth/me response.
        // SUPER_ADMIN and TENANT_ADMIN bypass permission checks — no array needed.
        if (authUser.role === 'EMPLOYEE') {
          setPermissions(res.data.permissions ?? []);

          // Also fetch isManager from the HR profile (department head flag).
          try {
            const empRes = await api.get<{ isManager: boolean }>('/hr/employees/me');
            authUser.isManager = empRes.data.isManager ?? false;
          } catch {
            // Not critical — leave isManager undefined; UI falls back to role check
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
