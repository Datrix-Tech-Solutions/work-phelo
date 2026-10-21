import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import type { PermissionSet } from '@/types/roles';

export interface ModuleUser {
  id: string;
  name: string;
  email: string;
  department: string;
  status: string;
  roles: { id: string; name: string }[];
  /** Holds the module's permissions granted directly rather than through a role. */
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

/** A role belongs to a module when it carries at least one of that module's resources. */
export function isModuleSet(set: PermissionSet, module: string): boolean {
  return set.resources.some((r) => r.resource.module === module);
}

/** Users who hold at least one permission of the module, through a role or a direct grant. */
export function useModuleUsers(module: string) {
  const { data: rawUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['permissions', 'module-users', module],
    queryFn: async () => {
      const res = await api.get<ModuleUserResponse[]>('/auth/permissions/module-users', {
        params: { module },
      });
      return res.data;
    },
  });
  const { data: employees } = useAllEmployees();

  const users = useMemo<ModuleUser[]>(() => {
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
