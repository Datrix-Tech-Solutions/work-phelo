'use client';

import { DataTable, Column, RowAction } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  PURPOSE_LABELS,
  REQUEST_STATUS_BADGES,
  formatTravelDate,
  formatWindow,
} from '@/lib/requestOptions';
import type { TransportRequest, TransportRequestStatus } from '@/types/marketing';

const dash = <span className="text-gray-400">—</span>;

const COLUMNS: Column<TransportRequest>[] = [
  {
    key: 'requester',
    label: 'Requester',
    width: 'minmax(120px, 0.8fr)',
    render: (row) => (
      <div className="flex flex-col">
        <span className="font-semibold text-gray-900">{row.requester.name}</span>
        <span className="text-xs font-semibold text-gray-500">
          {row.requester.department ?? '—'}
        </span>
      </div>
    ),
  },
  {
    key: 'purpose',
    label: 'Purpose',
    width: 'minmax(100px, 0.6fr)',
    render: (row) => (
      <div className="flex flex-col">
        <span className="font-semibold text-gray-900">{PURPOSE_LABELS[row.purpose]}</span>
        {/* Requests made before purpose became personal / official keep their typed reason. */}
        {row.businessPurpose && (
          <span className="text-xs text-gray-500 line-clamp-1 max-w-56">{row.businessPurpose}</span>
        )}
      </div>
    ),
  },
  {
    key: 'destination',
    label: 'Destination',
    width: 'minmax(120px, 0.8fr)',
    render: (row) =>
      row.destination ? (
        <span className="line-clamp-2 max-w-64" title={row.destination}>
          {row.destination}
        </span>
      ) : (
        dash
      ),
  },
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
    render: (row) => formatWindow(row.departureTime, row.returnTime),
  },
  {
    key: 'passengers',
    label: 'Passengers',
    width: '80px',
    render: (row) => (row.passengerCount ? row.passengerCount : dash),
  },
  {
    key: 'allocation',
    label: 'Vehicle / Driver',
    width: 'minmax(120px, 1fr)',
    render: (row) =>
      row.allocation ? (
        <div className="font-semibold flex flex-col">
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
  /** Show "View" in the row menu. Off where tapping the row already opens the request and nothing else is offered. */
  showViewAction?: boolean;
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
  showViewAction = true,
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
    const actions: RowAction[] = showViewAction
      ? [{ label: 'View', onClick: () => onView(row) }]
      : [];
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
