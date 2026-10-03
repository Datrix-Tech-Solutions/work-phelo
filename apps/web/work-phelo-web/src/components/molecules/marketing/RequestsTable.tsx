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
    width: 'minmax(120px, 0.8fr)',
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
    width: 'minmax(120px, 1fr)',
    render: (row) => <span className="line-clamp-2 max-w-64">{row.businessPurpose}</span>,
  },
  { key: 'destination', label: 'Destination', width: 'minmax(120px, 0.8fr)' },
  {
    key: 'travelDate',
    label: 'Travel Date',
    width: '80px',
    render: (row) => formatTravelDate(row.travelDate),
  },
  {
    key: 'time',
    label: 'Departure – Return',
    width: '140px',
    render: (row) => `${formatClock(row.departureTime)} – ${formatClock(row.returnTime)}`,
  },
  {
    key: 'passengers',
    label: 'Passengers',
    width: '80px',
    render: (row) => (row.passengers.length ? row.passengers.length : dash),
  },
  {
    key: 'allocation',
    label: 'Vehicle / Driver',
    width: 'minmax(120px, 1fr)',
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
    width: '100px',
    render: (row) => {
      const { label, variant } = REQUEST_STATUS_BADGES[row.status];
      return (
        <div className="flex flex-col items-start gap-1">
          <Badge label={label} variant={variant} />
          {row.overdue && row.status === 'ON_ROUTE' && <Badge label="Overdue" variant="warning" />}
        </div>
      );
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
  canReschedule?: (row: TransportRequest) => boolean;
  onReschedule?: (row: TransportRequest) => void;
  canComplete?: (row: TransportRequest) => boolean;
  onComplete?: (row: TransportRequest) => void;
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
  canReschedule,
  onReschedule,
  canComplete,
  onComplete,
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
    if (onComplete && canComplete?.(row)) {
      actions.push({ label: 'Complete Trip', onClick: () => onComplete(row), variant: 'success' });
    }
    if (onReschedule && canReschedule?.(row)) {
      actions.push({ label: 'Reschedule', onClick: () => onReschedule(row) });
    }
    if (onEdit && canEdit?.(row)) actions.push({ label: 'Edit', onClick: () => onEdit(row) });
    if (onCancel && canCancel?.(row)) {
      actions.push({
        label: row.status === 'PENDING' ? 'Cancel Request' : 'Cancel Trip',
        onClick: () => onCancel(row),
        danger: true,
      });
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
