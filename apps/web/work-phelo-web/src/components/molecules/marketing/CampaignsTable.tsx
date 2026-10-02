'use client';

import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';

export interface Campaign {
  id: string;
  name: string;
  channel: string;
  targetAudience: string;
  performanceRate: number;
  conversions: number;
  status: 'draft' | 'active' | 'paused' | 'completed';
}

const STATUS_MAP: Record<
  Campaign['status'],
  { label: string; variant: 'success' | 'warning' | 'info' | 'neutral' }
> = {
  draft: { label: 'Draft', variant: 'neutral' },
  active: { label: 'Active', variant: 'success' },
  paused: { label: 'Paused', variant: 'warning' },
  completed: { label: 'Completed', variant: 'info' },
};

const COLUMNS: Column<Campaign>[] = [
  {
    key: 'name',
    label: 'Campaign & Channel',
    render: (row) => (
      <div className="flex flex-col">
        <span className="font-medium text-gray-900">{row.name}</span>
        <span className="text-xs text-gray-500">{row.channel}</span>
      </div>
    ),
  },
  { key: 'targetAudience', label: 'Target Audience' },
  // {
  //   key: 'performanceRate',
  //   label: 'Performance Rate',
  //   render: (row) => `${row.performanceRate}%`,
  // },
  // { key: 'conversions', label: 'Conversions' },
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
  searchValue: string;
  onSearch: (q: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRowClick?: (row: Campaign) => void;
  onAdd: () => void;
}

export function CampaignsTable({
  data,
  searchValue,
  onSearch,
  currentPage,
  totalPages,
  onPageChange,
  onRowClick,
  onAdd,
}: Props) {
  return (
    <DataTable
      columns={COLUMNS}
      data={data}
      emptyMessage="No campaigns yet"
      searchPlaceholder="Search campaigns..."
      searchValue={searchValue}
      onSearch={onSearch}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onRowClick={onRowClick}
      actionButton={{ label: 'New Campaign', onClick: onAdd }}
      noInternalScroll
    />
  );
}
