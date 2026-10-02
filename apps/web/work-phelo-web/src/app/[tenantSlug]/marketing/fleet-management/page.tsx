'use client';

import { useMemo, useState } from 'react';
import { FleetsTable } from '@/components/molecules/marketing/FleetsTable';
import { ConfirmDeleteProspectModal } from '@/components/molecules/marketing/ConfirmDeleteProspectModal';
import { FleetVehiclePanel } from '@/components/organisms/marketing/FleetVehiclePanel';
import { AssignFleetDriverPanel } from '@/components/organisms/marketing/AssignFleetDriverPanel';
import {
  useFleet,
  useFleetOptions,
  useRetireFleetVehicle,
  useSetFleetVehicleStatus,
  useUnassignFleetDriver,
} from '@/hooks/marketing/useFleet';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';
import type { FleetStatus, FleetVehicle } from '@/types/marketing';

const PAGE_SIZE = 10;

export default function FleetManagementPage() {
  const toast = useToast();
  const canCreate = usePermissionRule('marketing.fleet:CREATE');
  const canEdit = usePermissionRule('marketing.fleet:EDIT');
  const canDelete = usePermissionRule('marketing.fleet:DELETE');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<FleetVehicle | null>(null);
  const [assigning, setAssigning] = useState<FleetVehicle | null>(null);
  const [retiring, setRetiring] = useState<FleetVehicle | null>(null);

  const { data, isLoading, isError } = useFleet({
    page,
    limit: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(statusFilter ? { status: statusFilter as FleetStatus } : {}),
    ...(branchFilter ? { branchId: branchFilter } : {}),
  });
  const { data: options } = useFleetOptions();
  const branchOptions = useMemo(
    () => (options?.branches ?? []).map((b) => ({ value: b.id, label: b.name })),
    [options],
  );

  const setStatus = useSetFleetVehicleStatus();
  const unassignDriver = useUnassignFleetDriver();
  const retireVehicle = useRetireFleetVehicle();

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  if (isError) {
    return (
      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
        <p className="text-sm text-red-500 text-center py-8">Failed to load vehicles.</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
        <FleetsTable
          data={data?.data ?? []}
          isLoading={isLoading}
          searchValue={search}
          onSearch={resetPage(setSearch)}
          statusFilter={statusFilter}
          onStatusFilter={resetPage(setStatusFilter)}
          branchFilter={branchFilter}
          onBranchFilter={resetPage(setBranchFilter)}
          branchOptions={branchOptions}
          currentPage={page}
          totalPages={Math.max(1, data?.meta.totalPages ?? 1)}
          onPageChange={setPage}
          onAdd={canCreate ? () => setAddOpen(true) : undefined}
          onEdit={canEdit ? setEditing : undefined}
          onAssignDriver={canEdit ? setAssigning : undefined}
          onUnassignDriver={
            canEdit
              ? (vehicle) =>
                  unassignDriver.mutate(vehicle.assetId, {
                    onSuccess: () => toast.success('Driver removed'),
                    onError: (error) =>
                      toast.error(apiErrorMessage(error, 'Failed to remove driver')),
                  })
              : undefined
          }
          onSetStatus={
            canEdit
              ? (vehicle, status) =>
                  setStatus.mutate(
                    { assetId: vehicle.assetId, status },
                    {
                      onSuccess: () => toast.success('Vehicle status updated'),
                      onError: (error) =>
                        toast.error(apiErrorMessage(error, 'Failed to update status')),
                    },
                  )
              : undefined
          }
          onRetire={canDelete ? setRetiring : undefined}
        />
      </div>

      <FleetVehiclePanel isOpen={addOpen} onClose={() => setAddOpen(false)} />
      <FleetVehiclePanel isOpen={!!editing} vehicle={editing} onClose={() => setEditing(null)} />
      <AssignFleetDriverPanel
        isOpen={!!assigning}
        vehicle={assigning}
        onClose={() => setAssigning(null)}
      />

      {retiring && (
        <ConfirmDeleteProspectModal
          title="Retire Vehicle"
          verb="Retiring"
          name={retiring.make ? `${retiring.make} ${retiring.model}` : retiring.name}
          consequence="removes it from active service and frees its driver. Its HR asset record is kept"
          warning="The vehicle stays in HR assets as retired."
          confirmLabel="Retire"
          confirmingLabel="Retiring…"
          isDeleting={retireVehicle.isPending}
          onCancel={() => setRetiring(null)}
          onConfirm={() =>
            retireVehicle.mutate(retiring.assetId, {
              onSuccess: () => {
                toast.success('Vehicle retired');
                setRetiring(null);
              },
              onError: (error) => toast.error(apiErrorMessage(error, 'Failed to retire vehicle')),
            })
          }
        />
      )}
    </>
  );
}
