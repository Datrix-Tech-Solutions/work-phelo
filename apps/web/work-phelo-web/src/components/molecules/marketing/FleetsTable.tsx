'use client';

import { DataTable, Column, RowAction } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  FLEET_STATUS_BADGES,
  FLEET_STATUS_OPTIONS,
  FUEL_TYPE_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
  labelFor,
} from '@/lib/fleetOptions';
import type { FleetStatus, FleetVehicle } from '@/types/marketing';

const dash = <span className="text-gray-400">—</span>;

const COLUMNS: Column<FleetVehicle>[] = [
  {
    key: 'name',
    label: 'Vehicle',
    render: (row) => (
      <div className="flex flex-col">
        <span className="font-medium text-gray-900">
          {row.make && row.model ? `${row.make} ${row.model}` : row.name}
        </span>
        <span className="text-xs text-gray-500">{row.assetNumber}</span>
      </div>
    ),
  },
  {
    key: 'vehicleType',
    label: 'Type',
    render: (row) =>
      row.vehicleType ? (
        labelFor(VEHICLE_TYPE_OPTIONS, row.vehicleType)
      ) : (
        <Badge label="Details needed" variant="warning" />
      ),
  },
  {
    key: 'yearOfRegistration',
    label: 'Year',
    render: (row) => row.yearOfRegistration ?? dash,
  },
  {
    key: 'fuelType',
    label: 'Fuel',
    render: (row) => (row.fuelType ? labelFor(FUEL_TYPE_OPTIONS, row.fuelType) : dash),
  },
  {
    key: 'currentMileage',
    label: 'Mileage',
    render: (row) =>
      row.currentMileage != null ? `${row.currentMileage.toLocaleString('en-GB')} km` : dash,
  },
  { key: 'branch', label: 'Branch', render: (row) => row.branch?.name ?? dash },
  { key: 'driver', label: 'Driver', render: (row) => row.assignedDriver?.name ?? dash },
  {
    key: 'status',
    label: 'Status',
    render: (row) => {
      const { label, variant } = FLEET_STATUS_BADGES[row.status];
      return <Badge label={label} variant={variant} />;
    },
  },
];

interface Props {
  data: FleetVehicle[];
  isLoading?: boolean;
  searchValue: string;
  onSearch: (q: string) => void;
  statusFilter: string;
  onStatusFilter: (status: string) => void;
  branchFilter: string;
  onBranchFilter: (branchId: string) => void;
  branchOptions: { value: string; label: string }[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Omit a handler to hide that action (e.g. when the user lacks the permission). */
  onAdd?: () => void;
  onEdit?: (row: FleetVehicle) => void;
  onAssignDriver?: (row: FleetVehicle) => void;
  onUnassignDriver?: (row: FleetVehicle) => void;
  onSetStatus?: (row: FleetVehicle, status: 'AVAILABLE' | 'MAINTENANCE') => void;
  onRetire?: (row: FleetVehicle) => void;
}

export function FleetsTable({
  data,
  isLoading,
  searchValue,
  onSearch,
  statusFilter,
  onStatusFilter,
  branchFilter,
  onBranchFilter,
  branchOptions,
  currentPage,
  totalPages,
  onPageChange,
  onAdd,
  onEdit,
  onAssignDriver,
  onUnassignDriver,
  onSetStatus,
  onRetire,
}: Props) {
  const filters = (
    <>
      <SearchSelect
        size="sm"
        placeholder="Status"
        allLabel="All statuses"
        options={FLEET_STATUS_OPTIONS}
        value={statusFilter}
        showAllOption
        onChange={onStatusFilter}
      />
      <SearchSelect
        size="sm"
        placeholder="Branch"
        allLabel="All branches"
        options={branchOptions}
        value={branchFilter}
        showAllOption
        onChange={onBranchFilter}
      />
    </>
  );

  const rowActions = (row: FleetVehicle): RowAction[] => {
    const status: FleetStatus = row.status;
    if (status === 'RETIRED') {
      return onEdit ? [{ label: 'Edit', onClick: () => onEdit(row) }] : [];
    }
    const actions: RowAction[] = [];
    if (onEdit) {
      actions.push({
        label: row.needsFleetDetails ? 'Add Details' : 'Edit',
        onClick: () => onEdit(row),
      });
    }
    if (status === 'ASSIGNED') {
      if (onUnassignDriver) {
        actions.push({ label: 'Remove Driver', onClick: () => onUnassignDriver(row) });
      }
      if (onAssignDriver) {
        actions.push({ label: 'Change Driver', onClick: () => onAssignDriver(row) });
      }
    } else {
      if (status === 'AVAILABLE' && onAssignDriver) {
        actions.push({ label: 'Assign Driver', onClick: () => onAssignDriver(row) });
      }
      if (onSetStatus) {
        actions.push(
          status === 'MAINTENANCE'
            ? { label: 'Mark Available', onClick: () => onSetStatus(row, 'AVAILABLE') }
            : { label: 'Send to Maintenance', onClick: () => onSetStatus(row, 'MAINTENANCE') },
        );
      }
    }
    if (onRetire) {
      actions.push({ label: 'Retire', onClick: () => onRetire(row), danger: true });
    }
    return actions;
  };

  return (
    <DataTable
      columns={COLUMNS}
      data={data}
      isLoading={isLoading}
      emptyMessage="No vehicles found"
      searchPlaceholder="Search vehicles..."
      searchValue={searchValue}
      onSearch={onSearch}
      extraFilters={filters}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      rowActions={rowActions}
      actionButton={onAdd ? { label: 'Add Vehicle', onClick: onAdd } : undefined}
      noInternalScroll
    />
  );
}
