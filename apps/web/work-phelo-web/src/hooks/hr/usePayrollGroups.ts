'use client';

import { useCallback } from 'react';
import { useLocalStorageList } from '@/hooks/hr/useLocalStorageList';
import type { PayrollGroup, PayrollGroupInput } from '@/lib/payroll-groups';

let seq = 0;
const newId = () => `pg_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** The payroll groups. Kept in the browser until the backend exists. */
export function usePayrollGroups(tenantSlug: string) {
  const [groups, setGroups] = useLocalStorageList<PayrollGroup>(`payroll.groups.${tenantSlug}`);

  /** Creates the group, or updates it when the input has an id. */
  const save = useCallback(
    (input: PayrollGroupInput): string => {
      const id = input.id ?? newId();
      const group: PayrollGroup = { ...input, id, name: input.name.trim() };
      setGroups((list) =>
        list.some((g) => g.id === id)
          ? list.map((g) => (g.id === id ? group : g))
          : [...list, group],
      );
      return id;
    },
    [setGroups],
  );

  const remove = useCallback(
    (id: string) => setGroups((list) => list.filter((g) => g.id !== id)),
    [setGroups],
  );

  return { groups, save, remove };
}
