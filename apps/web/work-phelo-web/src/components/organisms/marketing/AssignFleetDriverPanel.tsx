'use client';

import { useMemo, useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useAssignFleetDriver, useFleetOptions } from '@/hooks/marketing/useFleet';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import type { FleetVehicle } from '@/types/marketing';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  vehicle: FleetVehicle | null;
}

export function AssignFleetDriverPanel({ isOpen, onClose, vehicle }: Props) {
  const toast = useToast();
  const assignDriver = useAssignFleetDriver();
  const { data: options } = useFleetOptions();
  const [employeeId, setEmployeeId] = useState('');

  const driverOptions = useMemo(
    () =>
      (options?.drivers ?? [])
        // The current driver can't be "changed" to themselves.
        .filter((driver) => driver.id !== vehicle?.assignedDriver?.id)
        .map((driver) => ({ value: driver.id, label: driver.name })),
    [options, vehicle],
  );

  function handleClose() {
    setEmployeeId('');
    onClose();
  }

  function handleSubmit() {
    if (!vehicle || !employeeId) return;
    assignDriver.mutate(
      { assetId: vehicle.assetId, employeeId },
      {
        onSuccess: () => {
          toast.success('Driver assigned');
          handleClose();
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to assign driver')),
      },
    );
  }

  const label = vehicle ? `${vehicle.make ?? vehicle.name} ${vehicle.model ?? ''}`.trim() : '';

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={vehicle?.assignedDriver ? 'Change Driver' : 'Assign Driver'}
      description={label ? `Choose the driver for ${label}.` : 'Choose a driver.'}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={assignDriver.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!employeeId}
            isLoading={assignDriver.isPending}
            loadingText="Assigning…"
          >
            Assign Driver
          </Button>
        </div>
      }
    >
      <SearchSelect
        label="Driver"
        placeholder="Select an employee"
        options={driverOptions}
        value={employeeId}
        onChange={setEmployeeId}
      />
    </SidePanel>
  );
}
