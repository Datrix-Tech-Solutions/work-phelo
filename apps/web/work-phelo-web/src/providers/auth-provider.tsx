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

          // /auth/me does not currently return lastName for employee users.
          try {
            const empRes = await api.get<{ lastName?: string }>('/hr/employees/me');
            if (empRes.data.lastName) authUser.lastName = empRes.data.lastName;
          } catch {
            // Not critical — keep the auth payload as-is.
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
