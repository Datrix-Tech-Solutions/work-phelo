'use client';

import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { formatDate } from '@/lib/formatters';
import type { Campaign, CampaignChannel, CampaignStatus } from '@/types/marketing';

const STATUS_MAP: Record<
  CampaignStatus,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }
> = {
  PENDING_DISPATCH: { label: 'Pending Dispatch', variant: 'warning' },
  SCHEDULED: { label: 'Scheduled', variant: 'info' },
  SENDING: { label: 'Sending', variant: 'info' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'danger' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
};

const CHANNEL_LABEL: Record<CampaignChannel, string> = { SMS: 'SMS', EMAIL: 'Email' };

const COLUMNS: Column<Campaign>[] = [
  {
    key: 'name',
    label: 'Campaign',
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
    render: (row) => row.channels.map((c) => CHANNEL_LABEL[c]).join(', '),
  },
  { key: 'businessType', label: 'Target Audience', render: (row) => row.businessType.name },
  {
    key: 'recipients',
    label: 'Recipients',
    render: (row) => {
      const { total, skipped, sent, failed } = row.recipients;
      const detail = [
        sent > 0 ? `${sent} sent` : null,
        failed > 0 ? `${failed} failed` : null,
        skipped > 0 ? `${skipped} skipped` : null,
      ].filter(Boolean);
      return (
        <div className="flex flex-col">
          <span className="text-gray-900">{total - skipped}</span>
          {detail.length > 0 && <span className="text-xs text-gray-500">{detail.join(' · ')}</span>}
        </div>
      );
    },
  },
  {
    key: 'dispatchMode',
    label: 'Dispatch',
    render: (row) =>
      row.dispatchMode === 'SCHEDULED' && row.scheduledDate
        ? formatDate(row.scheduledDate)
        : 'Instant',
  },
  { key: 'createdAt', label: 'Created', render: (row) => formatDate(row.createdAt) },
  {
    key: 'status',
    label: 'Status',
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
  /** Omit to hide Cancel (no cancel permission). Only offered for scheduled campaigns. */
  onCancel?: (row: Campaign) => void;
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
}: Props) {
  return (
    <DataTable
      columns={COLUMNS}
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
      rowActions={
        onCancel
          ? (row) =>
              row.status === 'SCHEDULED'
                ? [{ label: 'Cancel Campaign', danger: true, onClick: () => onCancel(row) }]
                : []
          : undefined
      }
      actionButton={onAdd ? { label: 'New Campaign', onClick: onAdd } : undefined}
      noInternalScroll
    />
  );
}
