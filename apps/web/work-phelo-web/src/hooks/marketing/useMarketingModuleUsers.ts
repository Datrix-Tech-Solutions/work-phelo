import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import type { PermissionSet } from '@/types/roles';

export interface MarketingModuleUser {
  id: string;
  name: string;
  email: string;
  department: string;
  status: string;
  roles: { id: string; name: string }[];
  /** Holds marketing permissions granted directly rather than through a role. */
  hasDirectPermissions: boolean;
}

interface ModuleUserResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  roles: { id: string; name: string }[];
  hasDirectPermissions: boolean;
}

/** A role belongs to marketing when it carries at least one marketing resource. */
export function isMarketingSet(set: PermissionSet): boolean {
  return set.resources.some((r) => r.resource.module === 'MARKETING');
}

/** Users who hold at least one marketing permission, through a role or a direct grant. */
export function useMarketingModuleUsers() {
  const { data: rawUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['permissions', 'module-users', 'MARKETING'],
    queryFn: async () => {
      const res = await api.get<ModuleUserResponse[]>('/auth/permissions/module-users', {
        params: { module: 'MARKETING' },
      });
      return res.data;
    },
  });
  const { data: employees } = useAllEmployees();

  const users = useMemo<MarketingModuleUser[]>(() => {
    const departmentByUserId = new Map<string, string>();
    for (const e of employees?.data ?? []) {
      if (e.userId && e.department?.name) departmentByUserId.set(e.userId, e.department.name);
    }

    return (rawUsers ?? []).map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`.trim(),
      email: u.email,
      department: departmentByUserId.get(u.id) ?? '',
      status: u.status,
      roles: u.roles,
      hasDirectPermissions: u.hasDirectPermissions,
    }));
  }, [rawUsers, employees]);

  return { users, isLoading: isLoadingUsers };
}
