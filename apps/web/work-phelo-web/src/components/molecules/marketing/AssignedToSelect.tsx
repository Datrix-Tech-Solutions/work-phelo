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
}

/** "Assigned to" picker. Renders nothing for users without the assign permission. */
export function AssignedToSelect({ record, value, onChange, label = 'Assigned To' }: Props) {
  const canAssign = useCanAssign(record);
  const { data: people = [], isLoading } = useAssignees(canAssign);
  const options = useMemo(() => people.map((p) => ({ value: p.userId, label: p.name })), [people]);

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
