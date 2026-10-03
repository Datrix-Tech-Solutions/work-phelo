'use client';

import { useMemo, useState } from 'react';
import { DataCardGrid } from '@/components/organisms/shared/DataCardGrid';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { FleetCard } from '@/components/molecules/marketing/FleetCard';
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
import { FLEET_STATUS_OPTIONS } from '@/lib/fleetOptions';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';
import type { FleetStatus, FleetVehicle } from '@/types/marketing';

const PAGE_SIZE = 12;

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
        <DataCardGrid
          data={data?.data ?? []}
          isLoading={isLoading}
          searchPlaceholder="Search vehicles…"
          searchValue={search}
          onSearch={resetPage(setSearch)}
          extraFilters={
            <>
              <SearchSelect
                size="sm"
                placeholder="Status"
                allLabel="All statuses"
                options={FLEET_STATUS_OPTIONS}
                value={statusFilter}
                showAllOption
                onChange={resetPage(setStatusFilter)}
              />
              <SearchSelect
                size="sm"
                placeholder="Branch"
                allLabel="All branches"
                options={branchOptions}
                value={branchFilter}
                showAllOption
                onChange={resetPage(setBranchFilter)}
              />
            </>
          }
          actionButton={
            canCreate ? { label: 'Add Vehicle', onClick: () => setAddOpen(true) } : undefined
          }
          emptyMessage="No vehicles found"
          currentPage={page}
          totalPages={Math.max(1, data?.meta.totalPages ?? 1)}
          onPageChange={setPage}
          renderCard={(vehicle) => (
            <FleetCard
              vehicle={vehicle}
              onEdit={canEdit ? () => setEditing(vehicle) : undefined}
              onAssignDriver={canEdit ? () => setAssigning(vehicle) : undefined}
              onUnassignDriver={
                canEdit
                  ? () =>
                      unassignDriver.mutate(vehicle.assetId, {
                        onSuccess: () => toast.success('Driver removed'),
                        onError: (error) =>
                          toast.error(apiErrorMessage(error, 'Failed to remove driver')),
                      })
                  : undefined
              }
              onSetStatus={
                canEdit
                  ? (status) =>
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
              onRetire={canDelete ? () => setRetiring(vehicle) : undefined}
            />
          )}
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
