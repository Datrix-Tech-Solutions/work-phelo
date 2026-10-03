'use client';

import { useMemo, useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import {
  useAddTransportOfficers,
  useTransportOfficerCandidates,
} from '@/hooks/marketing/useTransportOfficers';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AddTransportOfficersPanel({ isOpen, onClose }: Props) {
  const toast = useToast();
  const addOfficers = useAddTransportOfficers();
  const { data: candidates, isLoading } = useTransportOfficerCandidates(isOpen);
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  const options = useMemo(
    () =>
      (candidates ?? []).map((person) => ({
        value: person.employeeId,
        label: person.name,
        sublabel: [person.jobTitle, person.department].filter(Boolean).join(' · ') || undefined,
      })),
    [candidates],
  );

  function handleClose() {
    setEmployeeIds([]);
    setError('');
    onClose();
  }

  function handleSubmit() {
    if (employeeIds.length === 0) {
      setError('Select at least one employee.');
      return;
    }
    setError('');
    addOfficers.mutate(employeeIds, {
      onSuccess: (added) => {
        toast.success(
          added.length === 1
            ? 'Transport officer added'
            : `${added.length} transport officers added`,
        );
        handleClose();
      },
      onError: (e) => toast.error(apiErrorMessage(e, 'Failed to add transport officers')),
    });
  }

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Transport Officers"
      description="Choose employees who will drive. They become available in the driver dropdowns."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={addOfficers.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={addOfficers.isPending} loadingText="Adding…">
            Add {employeeIds.length > 1 ? `${employeeIds.length} Officers` : 'Officer'}
          </Button>
        </div>
      }
    >
      <MultiSelect
        label="Employees"
        placeholder={isLoading ? 'Loading employees…' : 'Select employees'}
        options={options}
        value={employeeIds}
        onChange={setEmployeeIds}
        error={error || undefined}
      />
      {!isLoading && options.length === 0 && (
        <p className="text-xs text-gray-400 mt-2">
          Every active employee is already a transport officer.
        </p>
      )}
    </SidePanel>
  );
}
