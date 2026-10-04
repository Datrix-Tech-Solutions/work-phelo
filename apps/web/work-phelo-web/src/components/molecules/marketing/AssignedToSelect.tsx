'use client';

import { useMemo } from 'react';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import { useAssignees } from '@/hooks/marketing/useAssignees';

const ASSIGN_PERMISSION = {
  prospect: 'marketing.prospects:ASSIGN',
  client: 'marketing.clients:ASSIGN',
} as const;

/** Whether the current user may give prospects/clients to someone else. */
export function useCanAssign(record: 'prospect' | 'client'): boolean {
  return useAnyPermissionRules([ASSIGN_PERMISSION[record]]);
}

interface Props {
  record: 'prospect' | 'client';
  /** User id; empty means "me" when creating. */
  value: string;
  onChange: (userId: string) => void;
  label?: string;
  /** Name of the person it is assigned to now, so they show even when they are not on the list. */
  currentName?: string | null;
}

/** "Assigned to" picker. Renders nothing for users without the assign permission. */
export function AssignedToSelect({
  record,
  value,
  onChange,
  label = 'Assigned To',
  currentName,
}: Props) {
  const canAssign = useCanAssign(record);
  const { data: people = [], isLoading } = useAssignees(canAssign);
  const options = useMemo(() => {
    const list = people.map((p) => ({ value: p.userId, label: p.name }));
    // The current assignee may hold no Marketing permissions (e.g. an admin who created it).
    if (value && currentName && !list.some((o) => o.value === value)) {
      list.unshift({ value, label: currentName });
    }
    return list;
  }, [people, value, currentName]);

  if (!canAssign) return null;
  return (
    <SearchSelect
      label={label}
      placeholder={isLoading ? 'Loading...' : 'Assigned to me'}
      options={options}
      value={value}
      onChange={onChange}
      disabled={isLoading}
      clearable
    />
  );
}
