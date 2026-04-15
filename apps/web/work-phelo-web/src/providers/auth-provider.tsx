'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { User } from '@/types/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    // If a user is already in the store (e.g. just logged in), don't re-fetch —
    // the cookie may not yet be present in dev (CORS/SameSite) and overwriting
    // with null would immediately log the user out.
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
        if (authUser.role === 'EMPLOYEE' || authUser.role === 'MANAGER') {
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
