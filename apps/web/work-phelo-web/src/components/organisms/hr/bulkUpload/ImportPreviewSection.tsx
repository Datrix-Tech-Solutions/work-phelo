'use client';

import type { ReactNode } from 'react';
import type { BulkImportRowResult } from '@/lib/hr/bulkImportTypes';

export interface ParsedRowBase {
  rowNumber: number;
  status: 'new' | 'invalid';
  errors: string[];
  warnings: string[];
}

export interface ImportColumn<Row> {
  header: string;
  render: (row: Row) => ReactNode;
}

export interface ImportSectionData {
  key: string;
  title: string;
  rows: ParsedRowBase[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ImportColumn<any>[];
}

function StatusCell({ row, result }: { row: ParsedRowBase; result?: BulkImportRowResult }) {
  if (result?.status === 'created') return <span className="text-green-600">Created</span>;
  if (result?.status === 'failed')
    return <span className="text-red-600">{result.message ?? 'Failed'}</span>;
  if (row.status === 'invalid')
    return <span className="text-red-600">{row.errors.join('; ')}</span>;
  return <span className="text-green-600">Ready</span>;
}

interface ImportPreviewSectionProps extends ImportSectionData {
  results?: BulkImportRowResult[];
}

export function ImportPreviewSection({ title, rows, columns, results }: ImportPreviewSectionProps) {
  if (rows.length === 0) return null;
  const resultByRow = new Map(results?.map((r) => [r.rowNumber, r]));

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-medium text-gray-700">{title}</h4>
      <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Row</th>
              {columns.map((col) => (
                <th key={col.header} className="px-3 py-2 text-left font-medium text-gray-500">
                  {col.header}
                </th>
              ))}
              <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const result = resultByRow.get(row.rowNumber);
              const warnings = result?.warnings ?? row.warnings;
              return (
                <tr key={row.rowNumber} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-400">{row.rowNumber}</td>
                  {columns.map((col) => (
                    <td key={col.header} className="px-3 py-2 text-gray-700">
                      {col.render(row)}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <StatusCell row={row} result={result} />
                    {warnings.length > 0 && (
                      <div className="text-xs text-amber-600 mt-0.5">{warnings.join('; ')}</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
