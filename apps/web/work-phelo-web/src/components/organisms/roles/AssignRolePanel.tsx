'use client';

import { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import type { CompanyRole } from '@/types/roles';

interface AssignRolePanelProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  userId: string;
  currentRoleName: string | null;
  assignedSets: { id: string; name: string }[];
  roles: CompanyRole[];
  onAssign: (companyRoleId: string, userId: string) => void;
  onRemoveRole: (companyRoleId: string, userId: string) => void;
  onRemovePermissionSet: (permissionSetId: string) => void;
  isAssigning: boolean;
  isRemoving: boolean;
}

function AssignRoleForm({
  onClose,
  employeeName,
  userId,
  currentRoleName,
  assignedSets,
  roles,
  onAssign,
  onRemoveRole,
  onRemovePermissionSet,
  isAssigning,
  isRemoving,
}: Omit<AssignRolePanelProps, 'isOpen'>) {
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [error, setError] = useState('');

  const assignedRoles = roles.filter((role) =>
    assignedSets.some((set) => set.name === `${role.name} Set`),
  );
  const currentRole = roles.find((role) => role.name === currentRoleName) ?? null;

  const availableOptions = roles
    .filter((role) => !assignedRoles.some((assignedRole) => assignedRole.id === role.id))
    .map((r) => ({
      value: r.id,
      label: r.name,
      sublabel: r.isSystem ? 'System role' : 'Custom role',
    }));

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  const handleAssign = () => {
    if (!selectedRoleId) {
      setError('Please select a role to add');
      return;
    }
    onAssign(selectedRoleId, userId);
    setSelectedRoleId('');
    setError('');
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title="Manage Roles"
      description={`Assign and remove roles for ${employeeName}. Default system roles replace one another, while custom roles can stack as extra access.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      {/* Currently assigned roles */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Assigned Roles {assignedRoles.length > 0 && `(${assignedRoles.length})`}
        </p>

        {assignedRoles.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No roles assigned yet.</p>
        ) : (
          assignedRoles.map((role) => {
            const isCurrentRole = role.name === currentRoleName;
            const matchingSet = assignedSets.find((set) => set.name === `${role.name} Set`);

            return (
              <div
                key={role.id}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{role.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {isCurrentRole ? 'Current base role' : 'Stacked custom role access'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isCurrentRole) {
                      onRemoveRole(role.id, userId);
                      return;
                    }

                    if (matchingSet) {
                      onRemovePermissionSet(matchingSet.id);
                    }
                  }}
                  disabled={isRemoving}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Add a new role */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assign Role</p>

        {availableOptions.length === 0 ? (
          <p className="text-sm text-gray-400">All available roles have been assigned.</p>
        ) : (
          <>
            <SearchSelect
              placeholder="Choose a role to add..."
              options={availableOptions}
              value={selectedRoleId}
              onChange={(v) => {
                setSelectedRoleId(v);
                setError('');
              }}
              error={error}
            />

            {selectedRole?.description && (
              <div className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3">
                <p className="text-sm font-medium text-brand">{selectedRole.name}</p>
                <p className="text-xs text-brand/70 mt-0.5">{selectedRole.description}</p>
              </div>
            )}

            <Button
              onClick={handleAssign}
              isLoading={isAssigning}
              loadingText="Assigning..."
              disabled={!selectedRoleId}
            >
              Add Role
            </Button>
          </>
        )}
      </div>
    </SidePanel>
  );
}

export function AssignRolePanel({ isOpen, ...props }: AssignRolePanelProps) {
  if (!isOpen) {
    return (
      <SidePanel isOpen={false} onClose={props.onClose} title="">
        {null}
      </SidePanel>
    );
  }
  return <AssignRoleForm key={props.userId} {...props} />;
}
