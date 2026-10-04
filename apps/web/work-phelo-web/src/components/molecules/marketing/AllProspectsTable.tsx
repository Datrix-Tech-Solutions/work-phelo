'use client';

import { useState } from 'react';
import { TypeChip } from '@/components/atoms/TypeChip';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { ViewModeToggle, type ViewMode } from '@/components/atoms/ViewModeToggle';
import { ProspectCard, stageColor } from '@/components/molecules/marketing/ProspectCard';
import { DataCardGrid } from '@/components/organisms/shared/DataCardGrid';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';

export interface Prospect {
  id: string;
  prospectName: string;
  businessType: string;
  expectedRevenue: string;
  product: string;
  contactNo: string;
  salesStage: string;
  salesStageId: string;
  /** Stage probability (0–100); drives the stage chip colour. */
  salesStageProgress: number;
  decisionMaker: string;
  lastInteraction: string;
  /** The assigned marketer's name. */
  assignedTo: string;
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
  /** Omit to hide the action, e.g. when the user can't create clients. */
  onConvertToClient?: (row: Prospect) => void;
  onAdd: () => void;
  stageOptions: { value: string; label: string }[];
  stageFilter: string;
  onStageFilter: (stageId: string) => void;
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
  stageOptions,
  stageFilter,
  onStageFilter,
  isLoading,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const stageFilterSelect = (
    <SearchSelect
      size="sm"
      placeholder="Sales Stage"
      allLabel="All stages"
      options={stageOptions}
      value={stageFilter}
      showAllOption
      onChange={onStageFilter}
    />
  );
  const viewToggle = <ViewModeToggle value={viewMode} onChange={setViewMode} />;

  if (viewMode === 'grid') {
    return (
      <DataCardGrid
        data={data}
        renderCard={(row) => (
          <ProspectCard
            prospect={row}
            onClick={() => onRowClick(row)}
            onEdit={() => onEdit(row)}
            onUpdateStage={() => onUpdateStage(row)}
            onConvertToClient={onConvertToClient && (() => onConvertToClient(row))}
          />
        )}
        renderSkeleton={() => <div className="w-80 h-56 rounded-2xl bg-gray-200 animate-pulse" />}
        isLoading={isLoading}
        emptyMessage="No prospects yet"
        searchPlaceholder="Search prospects..."
        searchValue={searchValue}
        onSearch={onSearch}
        extraFilters={stageFilterSelect}
        toolbarTrailing={viewToggle}
        actionButton={{ label: 'Add Prospect', onClick: onAdd }}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    );
  }

  return (
    <DataTable
      columns={COLUMNS}
      data={data}
      emptyMessage="No prospects yet"
      searchPlaceholder="Search prospects..."
      searchValue={searchValue}
      onSearch={onSearch}
      extraFilters={stageFilterSelect}
      toolbarTrailing={viewToggle}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onRowClick={onRowClick}
      rowActions={(row) => [
        ...(row.salesStageProgress >= 100 && onConvertToClient
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
