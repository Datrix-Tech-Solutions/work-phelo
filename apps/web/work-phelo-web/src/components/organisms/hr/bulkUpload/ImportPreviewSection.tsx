'use client';

import type { ReactNode } from 'react';
import type { BulkImportRowResult } from '@/lib/hr/bulkImportTypes';

export interface ParsedRowBase {
  rowNumber: number;
  status: 'new' | 'invalid';
  errors: string[];
  warnings: string[];
}

/** What a column can do to the row it is drawing: edit it in the preview, unless results are in. */
export interface ImportCellContext {
  update: (patch: Record<string, unknown>) => void;
  locked: boolean;
}

export interface ImportColumn<Row> {
  header: string;
  render: (row: Row, ctx: ImportCellContext) => ReactNode;
}

export interface ImportSectionData {
  key: string;
  title: string;
  rows: ParsedRowBase[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ImportColumn<any>[];
  /** Employee sections only: lets the user pick which rows also get a login. */
  supportsAccess?: boolean;
  /** Applies an in-preview edit to a row, e.g. re-checking its errors. Defaults to a plain merge. */
  reviseRow?: (row: ParsedRowBase, patch: Record<string, unknown>) => ParsedRowBase;
}

/** The fields the access checkbox reads from a row. */
type AccessRow = ParsedRowBase & { email?: string; grantAccess?: boolean };

function StatusCell({ row, result }: { row: ParsedRowBase; result?: BulkImportRowResult }) {
  if (result?.status === 'created') {
    if (result.access === 'queued') {
      return <span className="text-green-600">Created · invite queued</span>;
    }
    if (result.access === 'failed') {
      return (
        <span className="text-amber-600">
          Created · access failed{result.accessMessage ? `: ${result.accessMessage}` : ''}
        </span>
      );
    }
    return <span className="text-green-600">Created</span>;
  }
  if (result?.status === 'failed')
    return <span className="text-red-600">{result.message ?? 'Failed'}</span>;
  if (row.status === 'invalid')
    return <span className="text-red-600">{row.errors.join('; ')}</span>;
  return <span className="text-green-600">Ready</span>;
}

interface ImportPreviewSectionProps extends ImportSectionData {
  results?: BulkImportRowResult[];
  /** Present only when the user may grant access; shows the access checkbox column. */
  onToggleAccess?: (rowNumber: number, value: boolean) => void;
  onToggleAllAccess?: (value: boolean) => void;
  onUpdateRow?: (rowNumber: number, patch: Record<string, unknown>) => void;
}

export function ImportPreviewSection({
  title,
  rows,
  columns,
  results,
  supportsAccess,
  onToggleAccess,
  onToggleAllAccess,
  onUpdateRow,
}: ImportPreviewSectionProps) {
  if (rows.length === 0) return null;
  const resultByRow = new Map(results?.map((r) => [r.rowNumber, r]));
  const showAccess = Boolean(supportsAccess && onToggleAccess);
  const locked = Boolean(results);
  const eligible = (rows as AccessRow[]).filter((r) => r.status === 'new' && r.email);
  const allChecked = eligible.length > 0 && eligible.every((r) => r.grantAccess);

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
              {showAccess && (
                <th className="px-3 py-2 text-left font-medium text-gray-500">
                  <label className="flex items-center gap-2 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      disabled={locked || eligible.length === 0}
                      onChange={(e) => onToggleAllAccess?.(e.target.checked)}
                      className="w-4 h-4 rounded accent-blue-500 cursor-pointer disabled:cursor-default"
                    />
                    System access
                  </label>
                </th>
              )}
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
                      {col.render(row, {
                        update: (patch) => onUpdateRow?.(row.rowNumber, patch),
                        locked,
                      })}
                    </td>
                  ))}
                  {showAccess && (
                    <td className="px-3 py-2">
                      {(() => {
                        const accessRow = row as AccessRow;
                        const hasEmail = Boolean(accessRow.email);
                        const canTick = row.status === 'new' && hasEmail && !locked;
                        return (
                          <input
                            type="checkbox"
                            checked={Boolean(accessRow.grantAccess) && hasEmail}
                            disabled={!canTick}
                            title={
                              hasEmail
                                ? undefined
                                : 'Add a work email in the sheet to give this employee access'
                            }
                            onChange={(e) => onToggleAccess?.(row.rowNumber, e.target.checked)}
                            className="w-4 h-4 rounded accent-blue-500 cursor-pointer disabled:cursor-default"
                          />
                        );
                      })()}
                    </td>
                  )}
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
