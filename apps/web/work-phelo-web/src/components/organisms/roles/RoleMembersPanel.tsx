'use client';

import { useMemo } from 'react';
import { UserCircle } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { useCurrentTenantUsers } from '@/hooks/useTenants';
import type { CompanyRole } from '@/types/roles';

interface RoleMembersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  role: CompanyRole | null;
}

export function RoleMembersPanel({ isOpen, onClose, role }: RoleMembersPanelProps) {
  const { data: usersRaw, isLoading } = useCurrentTenantUsers({ enabled: isOpen && !!role });

  const members = useMemo(() => {
    if (!role || !Array.isArray(usersRaw)) return [];
    return (
      usersRaw as {
        id: string;
        firstName: string;
        lastName?: string;
        email: string;
        companyRoleId?: string | null;
      }[]
    ).filter((u) => u.companyRoleId === role.id);
  }, [usersRaw, role]);

  if (!role) return null;

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={`${role.name} — Members`}
      description={role.description ?? `Employees assigned the ${role.name} role.`}
    >
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <UserCircle className="w-10 h-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No members assigned</p>
          <p className="text-xs text-gray-400">
            No employees have been assigned the {role.name} role yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400 font-medium">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3"
            >
              <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-brand">
                  {(member.firstName[0] ?? '').toUpperCase()}
                  {(member.lastName?.[0] ?? '').toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {member.firstName} {member.lastName ?? ''}
                </p>
                <p className="text-xs text-gray-400 truncate">{member.email}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SidePanel>
  );
}
