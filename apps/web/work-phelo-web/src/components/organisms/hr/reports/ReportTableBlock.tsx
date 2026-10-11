'use client';

import { useMemo, useState } from 'react';
import { Column, DataTable } from '@/components/organisms/shared/DataTable';
import { useRunReportBlock } from '@/hooks/hr/useReports';
import { apiErrorMessage } from '@/lib/apiError';
import { formatDate } from '@/lib/formatters';
import { ReportBlock, ReportPeriod } from '@/types/reports';

const PAGE_SIZE = 25;

type Row = { id: number; cells: Record<string, string | number | null> };

interface ReportTableBlockProps {
  block: ReportBlock;
  period: ReportPeriod;
}

export function ReportTableBlock({ block, period }: ReportTableBlockProps) {
  const [page, setPage] = useState(1);
  // A click on a column header sorts on the server; until then the report's own sort applies.
  const [sort, setSort] = useState(block.sort);
  const sorted = useMemo(() => ({ ...block, sort }), [block, sort]);

  const { data, isLoading, isError, error } = useRunReportBlock('TABLE', sorted, period, {
    page,
    pageSize: PAGE_SIZE,
  });
  const result = data?.type === 'TABLE' ? data : null;

  const columns: Column<Row>[] = (result?.columns ?? []).map((column) => ({
    key: column.key,
    label: column.label,
    sortable: true,
    className: column.kind === 'number' ? 'text-right tabular-nums' : undefined,
    render: (row) => {
      const value = row.cells[column.key];
      if (value === null || value === undefined) return <span className="text-gray-400">—</span>;
      if (column.kind === 'date') return formatDate(String(value));
      if (typeof value === 'number') return value.toLocaleString('en-GB');
      return value;
    },
  }));

  const rows: Row[] = (result?.rows ?? []).map((cells, index) => ({ id: index, cells }));

  if (isError) {
    return (
      <p className="text-sm text-gray-500">
        {apiErrorMessage(error, 'This table could not be loaded.')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {block.title && <h3 className="text-sm font-semibold text-gray-900">{block.title}</h3>}
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyMessage="No records match this selection."
        currentPage={result?.page ?? page}
        totalPages={Math.max(1, Math.ceil((result?.total ?? 0) / PAGE_SIZE))}
        onPageChange={setPage}
        sortState={sort ? { key: sort.field, direction: sort.direction } : undefined}
        onSort={(key) => {
          setPage(1);
          setSort((current) =>
            current?.field === key
              ? { field: key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
              : { field: key, direction: 'asc' },
          );
        }}
      />
      {result?.truncated && (
        <p className="text-xs text-amber-600">
          Only the first part of a very large dataset was read, so this table may be incomplete.
        </p>
      )}
    </div>
  );
}
