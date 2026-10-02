import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePermissionSets } from '@/hooks/hr/useRoles';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import type { PermissionSet, PermissionSetMember } from '@/types/roles';

export interface MarketingModuleUser {
  id: string;
  name: string;
  email: string;
  department: string;
  status: string;
  roles: { id: string; name: string }[];
}

/** A role belongs to marketing when it carries at least one marketing resource. */
export function isMarketingSet(set: PermissionSet): boolean {
  return set.resources.some((r) => r.resource.module === 'MARKETING');
}

/** Users who hold at least one marketing role (permission set). */
export function useMarketingModuleUsers() {
  const { data: setsRaw = [], isLoading: isLoadingSets } = usePermissionSets();
  const marketingSets = useMemo(
    () => (Array.isArray(setsRaw) ? setsRaw : []).filter(isMarketingSet),
    [setsRaw],
  );

  const memberQueries = useQueries({
    queries: marketingSets.map((set) => ({
      queryKey: ['permissions', 'sets', set.id, 'members'],
      queryFn: async () => {
        const res = await api.get<PermissionSetMember[]>(
          `/auth/permissions/sets/${set.id}/members`,
        );
        return res.data;
      },
    })),
  });
  const { data: employees } = useAllEmployees();

  const isLoading = isLoadingSets || memberQueries.some((q) => q.isLoading);
  // Re-derive only when the fetched members actually change.
  const membersKey = memberQueries.map((q) => q.dataUpdatedAt).join('|');

  const users = useMemo(() => {
    const departmentByUserId = new Map<string, string>();
    for (const e of employees?.data ?? []) {
      if (e.userId && e.department?.name) departmentByUserId.set(e.userId, e.department.name);
    }

    const byId = new Map<string, MarketingModuleUser>();
    marketingSets.forEach((set, i) => {
      for (const member of memberQueries[i]?.data ?? []) {
        const existing = byId.get(member.id);
        const role = { id: set.id, name: set.name };
        if (existing) {
          existing.roles.push(role);
        } else {
          byId.set(member.id, {
            id: member.id,
            name: `${member.firstName} ${member.lastName}`.trim(),
            email: member.email,
            department: departmentByUserId.get(member.id) ?? '',
            status: member.status,
            roles: [role],
          });
        }
      }
    });
    return Array.from(byId.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketingSets, membersKey, employees]);

  return { users, isLoading };
}
