import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useCurrentTenantUsers } from '@/hooks/useTenants';

interface TenantUser {
  id: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Names for the user ids the inventory service records (who created or approved something). The
 * company's user list needs the permission to read users; without it only the signed-in user's own
 * name is known and other people show as unknown.
 */
export function useUserNames() {
  const me = useAuthStore((s) => s.user);
  const { data } = useCurrentTenantUsers();
  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of Array.isArray(data) ? (data as TenantUser[]) : []) {
      const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
      if (u.id && name) map.set(u.id, name);
    }
    if (me?.id && !map.has(me.id)) {
      const name = `${me.firstName ?? ''} ${me.lastName ?? ''}`.trim();
      if (name) map.set(me.id, name);
    }
    return map;
  }, [data, me]);
  /** The person's name, or a dash when nobody is recorded or the name isn't known. */
  return (id: string | null | undefined) => (id ? (names.get(id) ?? '—') : '—');
}
