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
  salesStageId: string;
  /** Stage probability (0–100); drives the stage chip colour. */
  salesStageProgress: number;
  decisionMaker: string;
  lastInteraction: string;
}

function stageColor(progress: number): TypeChipColor {
  if (progress >= 100) return 'green';
  if (progress >= 75) return 'blue';
  if (progress >= 50) return 'purple';
  if (progress >= 25) return 'amber';
  if (progress > 0) return 'gray';
  return 'red';
}

const COLUMNS: Column<Prospect>[] = [
  {
    key: 'prospectName',
    label: 'Prospect Name',
    width: 'minmax(100px, 1fr)',
    render: (row) => <span className="font-semibold ">{row.prospectName}</span>,
  },
  {
    key: 'expectedRevenue',
    label: 'Expected Revenue',
    width: '130px',
    className: 'text-right',
    render: (row) => <span className="font-semibold text-gray-700">{row.expectedRevenue}</span>,
  },
  {
    key: 'product',
    label: 'Product',
    width: 'minmax(100px, 1fr)',
    render: (row) => <span className="font-semibold">{row.product}</span>,
  },
  {
    key: 'contactNo',
    label: 'Contact No',
    width: '100px',
    render: (row) => <span className="font-semibold text-gray-700">{row.contactNo}</span>,
  },
  {
    key: 'decisionMaker',
    label: 'Decision Maker',
    width: '150px',
    render: (row) => <span className="font-semibold">{row.decisionMaker}</span>,
  },
  {
    key: 'lastInteraction',
    label: 'Last Interaction',
    width: '150px',
    render: (row) =>
      row.lastInteraction ? (
        <span className="font-semibold">
          {new Date(row.lastInteraction).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ) : (
        <span className="text-gray-400 font-semibold">—</span>
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
  onUpdateStage: (row: Prospect) => void;
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
  onUpdateStage,
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
        { label: 'Update Stage', onClick: () => onUpdateStage(row) },
        { label: 'Delete', onClick: () => onDelete(row), danger: true },
      ]}
      actionButton={{ label: 'Add Prospect', onClick: onAdd }}
      noInternalScroll
      isLoading={isLoading}
    />
  );
}
