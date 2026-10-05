'use client';

import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { TableButton } from '@/components/atoms/TableButton';
import { formatDate } from '@/lib/formatters';
import type { Campaign, CampaignChannel, CampaignStatus } from '@/types/marketing';

const STATUS_MAP: Record<
  CampaignStatus,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }
> = {
  DRAFT: { label: 'Draft', variant: 'neutral' },
  PENDING_DISPATCH: { label: 'Pending Dispatch', variant: 'warning' },
  SCHEDULED: { label: 'Scheduled', variant: 'info' },
  QUEUED: { label: 'Queued', variant: 'info' },
  SENDING: { label: 'Sending', variant: 'info' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  PARTIALLY_COMPLETED: { label: 'Partially Completed', variant: 'warning' },
  FAILED: { label: 'Failed', variant: 'danger' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
};

const CHANNEL_LABEL: Record<CampaignChannel, string> = { SMS: 'SMS', EMAIL: 'Email' };

const COLUMNS: Column<Campaign>[] = [
  {
    key: 'name',
    label: 'Campaign',
    width: 'minmax(120px, 1fr)',
    render: (row) => (
      <div className="flex flex-col">
        <span className="font-medium text-gray-900">{row.name}</span>
        <span className="text-xs text-gray-500 truncate max-w-64">{row.subject}</span>
      </div>
    ),
  },
  {
    key: 'channels',
    label: 'Channels',
    width: '120px',
    render: (row) => row.channels.map((c) => CHANNEL_LABEL[c]).join(', '),
  },
  {
    key: 'businessType',
    label: 'Target Audience',
    width: 'minmax(120px, 1fr)',
    render: (row) => row.businessTypes.map((type) => type.name).join(', '),
  },
  {
    key: 'recipients',
    label: 'Recipients',
    width: '90px',
    render: (row) => {
      const { total, skipped, sent, accepted, delivered, failed, cancelled } = row.recipients;
      const submitted = sent + accepted + delivered;
      const detail = [
        submitted > 0 ? `${submitted} sent` : null,
        failed > 0 ? `${failed} failed` : null,
        skipped > 0 ? `${skipped} skipped` : null,
        cancelled > 0 ? `${cancelled} cancelled` : null,
      ].filter(Boolean);
      return (
        <div className="flex flex-col">
          <span className="text-gray-900">{total - skipped - cancelled}</span>
          {detail.length > 0 && <span className="text-xs text-gray-500">{detail.join(' · ')}</span>}
        </div>
      );
    },
  },
  {
    key: 'dispatchMode',
    label: 'Dispatch',
    width: '90px',
    render: (row) =>
      row.dispatchMode === 'SCHEDULED' && row.scheduledDate
        ? formatDate(row.scheduledDate)
        : 'Instant',
  },
  {
    key: 'createdAt',
    label: 'Created',
    width: '90px',
    render: (row) => formatDate(row.createdAt),
  },
  {
    key: 'status',
    label: 'Status',
    width: '100px',
    render: (row) => {
      const { label, variant } = STATUS_MAP[row.status];
      return <Badge label={label} variant={variant} />;
    },
  },
];

interface Props {
  data: Campaign[];
  isLoading?: boolean;
  searchValue: string;
  onSearch: (q: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRowClick?: (row: Campaign) => void;
  /** Omit to hide the New Campaign button (no create permission). */
  onAdd?: () => void;
  /** Omit to hide the Actions column (no cancel permission). Cancel shows only on scheduled campaigns. */
  onCancel?: (row: Campaign) => void;
  /** Omit to hide Send. Send shows only on queued-ready SMS campaigns. */
  onSend?: (row: Campaign) => void;
}

export function CampaignsTable({
  data,
  isLoading,
  searchValue,
  onSearch,
  currentPage,
  totalPages,
  onPageChange,
  onRowClick,
  onAdd,
  onCancel,
  onSend,
}: Props) {
  const hasActions = Boolean(onCancel || onSend);
  const columns: Column<Campaign>[] = hasActions
    ? [
        ...COLUMNS,
        {
          key: 'actions',
          label: 'Actions',
          width: '150px',
          render: (row) => {
            const canSend =
              onSend &&
              row.channels.includes('SMS') &&
              !row.channels.includes('EMAIL') &&
              ['PENDING_DISPATCH', 'SCHEDULED'].includes(row.status);
            const canCancel = onCancel && ['PENDING_DISPATCH', 'SCHEDULED'].includes(row.status);
            if (!canSend && !canCancel) return null;
            return (
              <div className="flex gap-2">
                {canSend && (
                  <TableButton
                    onClick={(e) => {
                      e.stopPropagation();
                      onSend(row);
                    }}
                  >
                    Send
                  </TableButton>
                )}
                {canCancel && (
                  <TableButton
                    variant="red"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancel(row);
                    }}
                  >
                    Cancel
                  </TableButton>
                )}
              </div>
            );
          },
        },
      ]
    : COLUMNS;

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      emptyMessage="No campaigns yet"
      searchPlaceholder="Search campaigns..."
      searchValue={searchValue}
      onSearch={onSearch}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onRowClick={onRowClick}
      actionButton={onAdd ? { label: 'New Campaign', onClick: onAdd } : undefined}
      noInternalScroll
    />
  );
}
