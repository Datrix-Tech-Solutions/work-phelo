'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';

interface CompanyRole {
  id: string;
  name: string;
  isSystem: boolean;
  _count?: { users: number };
}

interface AssignRolePanelProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  userId: string;
  currentRoleId?: string | null;
  roles: CompanyRole[];
  onAssign: (companyRoleId: string, userId: string) => void;
  isAssigning: boolean;
}

/* ── Inner form — remounted via key each time the panel opens ── */
function AssignRoleForm({
  onClose,
  employeeName,
  userId,
  currentRoleId,
  roles,
  onAssign,
  isAssigning,
}: Omit<AssignRolePanelProps, 'isOpen'>) {
  const [selectedRoleId, setSelectedRoleId] = useState(currentRoleId ?? '');
  const [error, setError] = useState('');

  const currentRole = roles.find((r) => r.id === currentRoleId);
  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const isUnchanged = selectedRoleId === currentRoleId;

  const handleAssign = () => {
    if (!selectedRoleId) {
      setError('Please select a role');
      return;
    }
    if (isUnchanged) {
      onClose();
      return;
    }
    onAssign(selectedRoleId, userId);
  };

  const options = roles.map((r) => ({
    value: r.id,
    label: r.name,
    sublabel: r.isSystem ? 'System role' : 'Custom role',
  }));

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title="Assign Role"
      description={`Set the system role for ${employeeName}.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            isLoading={isAssigning}
            loadingText="Assigning..."
            onClick={handleAssign}
            disabled={!selectedRoleId}
          >
            {isUnchanged ? 'No Changes' : 'Assign Role'}
          </Button>
        </div>
      }
    >
      {/* Current role indicator */}
      {currentRole && (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-brand" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Current role</p>
            <p className="text-sm font-semibold text-gray-900">{currentRole.name}</p>
          </div>
        </div>
      )}

      <SearchSelect
        label="Select New Role"
        placeholder="Choose a role..."
        options={options}
        value={selectedRoleId}
        onChange={(v) => {
          setSelectedRoleId(v);
          setError('');
        }}
        error={error}
      />

      {/* Role description hint */}
      {selectedRole && (
        <div className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-brand">
          <p className="font-medium">{selectedRole.name}</p>
          <p className="text-xs text-brand/70 mt-0.5">
            {selectedRole.name === 'Company Admin' && 'Full access to all HR modules and settings.'}
            {selectedRole.name === 'Manager' &&
              'Can approve leave, review timesheets and manage their team.'}
            {selectedRole.name === 'Employee' &&
              'Standard access — can apply for leave, clock in/out and view own data.'}
            {!['Company Admin', 'Manager', 'Employee'].includes(selectedRole.name) &&
              'Custom role with permissions defined by your organisation.'}
          </p>
        </div>
      )}
    </SidePanel>
  );
}

/* ── Public wrapper — closed state renders a hidden panel, open state remounts form ── */
export function AssignRolePanel({ isOpen, ...props }: AssignRolePanelProps) {
  if (!isOpen) {
    return (
      <SidePanel isOpen={false} onClose={props.onClose} title="">
        {null}
      </SidePanel>
    );
  }

  return <AssignRoleForm key={`${props.userId}-${props.currentRoleId}`} {...props} />;
}
