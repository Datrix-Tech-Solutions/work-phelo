'use client';

import { TypeChip, type TypeChipColor } from '@/components/atoms/TypeChip';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';

export interface Prospect {
  id: string;
  prospectName: string;
  expectedRevenue: string;
  product: string;
  contactNo: string;
  salesStage: string;
  /** Stage probability (0–100); drives the stage chip colour. */
  salesStageProgress: number;
  decisionMaker: string;
  lastInteraction: string;
}

function stageColor(progress: number): TypeChipColor {
  if (progress >= 100) return 'green';
  if (progress >= 75) return 'teal';
  if (progress >= 50) return 'purple';
  if (progress >= 25) return 'amber';
  if (progress > 0) return 'blue';
  return 'gray';
}

const COLUMNS: Column<Prospect>[] = [
  { key: 'prospectName', label: 'Prospect Name', width: 'minmax(100px, 1fr)' },
  { key: 'expectedRevenue', label: 'Expected Revenue', width: '130px' },
  { key: 'product', label: 'Product', width: 'minmax(100px, 1fr)' },
  { key: 'contactNo', label: 'Contact No', width: '100px' },

  { key: 'decisionMaker', label: 'Decision Maker', width: '150px' },
  {
    key: 'lastInteraction',
    label: 'Last Interaction',
    width: '150px',
    render: (row) =>
      row.lastInteraction ? (
        new Date(row.lastInteraction).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      ) : (
        <span className="text-gray-400">—</span>
      ),
  },
  {
    key: 'salesStage',
    label: 'Sales Stage',
    width: '150px',
    render: (row) => <TypeChip label={row.salesStage} color={stageColor(row.salesStageProgress)} />,
  },
];

interface Props {
  data: Prospect[];
  searchValue: string;
  onSearch: (q: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRowClick: (row: Prospect) => void;
  onEdit: (row: Prospect) => void;
  onDelete: (row: Prospect) => void;
  onConvertToClient: (row: Prospect) => void;
  onAdd: () => void;
  isLoading?: boolean;
}

export function AllProspectsTable({
  data,
  searchValue,
  onSearch,
  currentPage,
  totalPages,
  onPageChange,
  onRowClick,
  onEdit,
  onDelete,
  onConvertToClient,
  onAdd,
  isLoading,
}: Props) {
  return (
    <DataTable
      columns={COLUMNS}
      data={data}
      emptyMessage="No prospects yet"
      searchPlaceholder="Search prospects..."
      searchValue={searchValue}
      onSearch={onSearch}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onRowClick={onRowClick}
      rowActions={(row) => [
        ...(row.salesStageProgress >= 100
          ? [{ label: 'Convert to Client', onClick: () => onConvertToClient(row) }]
          : []),
        { label: 'Edit', onClick: () => onEdit(row) },
        { label: 'Delete', onClick: () => onDelete(row), danger: true },
      ]}
      actionButton={{ label: 'Add Prospect', onClick: onAdd }}
      noInternalScroll
      isLoading={isLoading}
    />
  );
}
