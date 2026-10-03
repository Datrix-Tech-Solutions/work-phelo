'use client';

import { DataTable, Column, RowAction } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { REQUEST_STATUS_BADGES, formatClock, formatTravelDate } from '@/lib/requestOptions';
import type { TransportRequest, TransportRequestStatus } from '@/types/marketing';

const dash = <span className="text-gray-400">—</span>;

const COLUMNS: Column<TransportRequest>[] = [
  {
    key: 'requester',
    label: 'Requester',
    render: (row) => (
      <div className="flex flex-col">
        <span className="font-medium text-gray-900">{row.requester.name}</span>
        <span className="text-xs text-gray-500">{row.requester.department ?? '—'}</span>
      </div>
    ),
  },
  {
    key: 'businessPurpose',
    label: 'Business Purpose',
    render: (row) => <span className="line-clamp-2 max-w-64">{row.businessPurpose}</span>,
  },
  { key: 'destination', label: 'Destination' },
  {
    key: 'travelDate',
    label: 'Travel Date',
    render: (row) => formatTravelDate(row.travelDate),
  },
  {
    key: 'time',
    label: 'Departure – Return',
    render: (row) => `${formatClock(row.departureTime)} – ${formatClock(row.returnTime)}`,
  },
  {
    key: 'passengers',
    label: 'Passengers',
    render: (row) => (row.passengers.length ? row.passengers.length : dash),
  },
  {
    key: 'allocation',
    label: 'Vehicle / Driver',
    render: (row) =>
      row.allocation ? (
        <div className="flex flex-col">
          <span className="text-gray-900">{row.allocation.vehicle.name ?? '—'}</span>
          <span className="text-xs text-gray-500">
            {row.allocation.driver.selfDriven
              ? `Self-driven · ${row.allocation.driver.name ?? row.requester.name}`
              : (row.allocation.driver.name ?? '—')}
          </span>
        </div>
      ) : (
        dash
      ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => {
      const { label, variant } = REQUEST_STATUS_BADGES[row.status];
      return <Badge label={label} variant={variant} />;
    },
  },
];

interface Props {
  data: TransportRequest[];
  isLoading?: boolean;
  searchValue: string;
  onSearch: (q: string) => void;
  statusOptions: { value: TransportRequestStatus; label: string }[];
  statusFilter: string;
  onStatusFilter: (status: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onView: (row: TransportRequest) => void;
  /** Omit a handler to hide that action (no permission, or not the user's request). */
  onAdd?: () => void;
  canApprove?: (row: TransportRequest) => boolean;
  onApprove?: (row: TransportRequest) => void;
  onReject?: (row: TransportRequest) => void;
  canEdit?: (row: TransportRequest) => boolean;
  onEdit?: (row: TransportRequest) => void;
  canCancel?: (row: TransportRequest) => boolean;
  onCancel?: (row: TransportRequest) => void;
}

export function RequestsTable({
  data,
  isLoading,
  searchValue,
  onSearch,
  statusOptions,
  statusFilter,
  onStatusFilter,
  currentPage,
  totalPages,
  onPageChange,
  onView,
  onAdd,
  canApprove,
  onApprove,
  onReject,
  canEdit,
  onEdit,
  canCancel,
  onCancel,
}: Props) {
  const rowActions = (row: TransportRequest): RowAction[] => {
    const actions: RowAction[] = [{ label: 'View', onClick: () => onView(row) }];
    if (onApprove && canApprove?.(row)) {
      actions.push({ label: 'Approve', onClick: () => onApprove(row), variant: 'success' });
    }
    if (onReject && canApprove?.(row)) {
      actions.push({ label: 'Reject', onClick: () => onReject(row), danger: true });
    }
    if (onEdit && canEdit?.(row)) actions.push({ label: 'Edit', onClick: () => onEdit(row) });
    if (onCancel && canCancel?.(row)) {
      actions.push({ label: 'Cancel Request', onClick: () => onCancel(row), danger: true });
    }
    return actions;
  };

  return (
    <DataTable
      columns={COLUMNS}
      data={data}
      isLoading={isLoading}
      emptyMessage="No requests found"
      searchPlaceholder="Search requests..."
      searchValue={searchValue}
      onSearch={onSearch}
      extraFilters={
        statusOptions.length > 1 ? (
          <SearchSelect
            size="sm"
            placeholder="Status"
            allLabel="All statuses"
            options={statusOptions}
            value={statusFilter}
            showAllOption
            onChange={onStatusFilter}
          />
        ) : undefined
      }
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onRowClick={onView}
      rowActions={rowActions}
      actionButton={onAdd ? { label: 'Add Request', onClick: onAdd } : undefined}
      noInternalScroll
    />
  );
}
