'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { FileUpload } from '@/components/atoms/FileUpload';
import { downloadGLAccountImportTemplate } from '@/lib/accounting/glAccountImportTemplate';
import { downloadGLAccountImportTemplateBasic } from '@/lib/accounting/glAccountImportTemplateBasic';
import {
  parseGLAccountImportFile,
  type GLAccountImportResult,
  type ImportRowStatus,
} from '@/lib/accounting/glAccountImportParser';
import { useBulkImportGLAccounts } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type {
  AccountClassification,
  AccountGroup,
  BulkImportRowResult,
  GLAccount,
} from '@/types/accounting';

interface BulkImportGLAccountsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  classifications: AccountClassification[];
  groups: AccountGroup[];
  existingAccounts: GLAccount[];
}

const norm = (value: string) => value.trim().toLowerCase();

function StatusCell({
  status,
  result,
  errors,
}: {
  status: ImportRowStatus;
  result?: BulkImportRowResult;
  errors: string[];
}) {
  if (result?.status === 'created') return <span className="text-green-600">Created</span>;
  if (result?.status === 'failed') return <span className="text-red-600">{result.message}</span>;
  if (result?.status === 'skipped') return <span className="text-amber-600">{result.message}</span>;
  if (status === 'invalid') return <span className="text-red-600">{errors.join('; ')}</span>;
  if (status === 'existing') return <span className="text-gray-400">Already exists</span>;
  return <span className="text-green-600">Ready</span>;
}

export function BulkImportGLAccountsDialog({
  isOpen,
  onClose,
  classifications,
  groups,
  existingAccounts,
}: BulkImportGLAccountsDialogProps) {
  const toast = useToast();
  const { mutateAsync: bulkImport, isPending: isImporting } = useBulkImportGLAccounts();

  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [result, setResult] = useState<GLAccountImportResult | null>(null);
  const [results, setResults] = useState<Record<string, BulkImportRowResult>>({});

  const reset = () => {
    setFile(null);
    setResult(null);
    setResults({});
    setIsParsing(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = async (selected: File | null) => {
    setFile(selected);
    setResults({});
    if (!selected) {
      setResult(null);
      return;
    }
    setIsParsing(true);
    try {
      const parsed = await parseGLAccountImportFile(selected, {
        classifications,
        groups,
        existingAccounts,
      });
      setResult(parsed);
      if (
        parsed.classifications.length === 0 &&
        parsed.groups.length === 0 &&
        parsed.accounts.length === 0
      ) {
        toast.error('No rows found in this file');
      }
    } catch (error) {
      toast.error(extractError(error, 'Unable to read this file — is it the template?'));
      setResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  const newClassifications = result?.classifications.filter((r) => r.status === 'new') ?? [];
  const newGroups = result?.groups.filter((r) => r.status === 'new') ?? [];
  const newAccounts = result?.accounts.filter((r) => r.status === 'new') ?? [];
  // The preview only needs to show rows that will actually do something — rows that already
  // exist are silently reused for cross-referencing and would otherwise clutter every import
  // with the tenant's entire existing chart of accounts.
  const visibleClassifications =
    result?.classifications.filter((r) => r.status !== 'existing') ?? [];
  const visibleGroups = result?.groups.filter((r) => r.status !== 'existing') ?? [];
  const visibleAccounts = result?.accounts.filter((r) => r.status !== 'existing') ?? [];
  const hasInvalidRows =
    (result?.classifications.some((r) => r.status === 'invalid') ?? false) ||
    (result?.groups.some((r) => r.status === 'invalid') ?? false) ||
    (result?.accounts.some((r) => r.status === 'invalid') ?? false);
  const totalNew = newClassifications.length + newGroups.length + newAccounts.length;

  const handleImport = async () => {
    if (!result || totalNew === 0) return;

    try {
      const response = await bulkImport({
        classifications: newClassifications.map((row) => ({
          code: row.code,
          name: row.name,
          category: row.category!,
          cashFlowCategory: row.cashFlowCategory,
        })),
        groups: newGroups.map((row) => ({
          code: row.code,
          name: row.name,
          classificationCode: row.classificationCode,
          cashFlowCategory: row.cashFlowCategory,
        })),
        accounts: newAccounts.map((row) => ({
          code: row.code,
          name: row.name,
          category: row.category!,
          classificationCode: row.classificationCode,
          parentAccountCode: row.parentAccountCode || undefined,
          description: row.description || undefined,
          cashFlowCategory: row.cashFlowCategory,
        })),
      });

      const nextResults: Record<string, BulkImportRowResult> = {};
      const applySection = (
        prefix: string,
        rows: { rowNumber: number; code: string }[],
        rowResults: BulkImportRowResult[],
      ) => {
        const byCode = new Map(rowResults.map((r) => [norm(r.code), r]));
        for (const row of rows) {
          const rowResult = byCode.get(norm(row.code));
          if (rowResult) nextResults[`${prefix}-${row.rowNumber}`] = rowResult;
        }
      };
      applySection('classification', newClassifications, response.classifications);
      applySection('group', newGroups, response.groups);
      applySection('account', newAccounts, response.accounts);
      setResults(nextResults);

      const allResults = [...response.classifications, ...response.groups, ...response.accounts];
      const createdCount = allResults.filter((r) => r.status === 'created').length;

      if (createdCount === totalNew) {
        toast.success(`Created ${createdCount} item${createdCount === 1 ? '' : 's'}`);
        handleClose();
      } else {
        toast.error(`Created ${createdCount} of ${totalNew} — see errors below`);
      }
    } catch (error) {
      toast.error(extractError(error, 'Unable to import — no items were created'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Accounts"
      description="Download a template (Basic for one simple sheet, Advanced for full control), fill it in, then upload it here to bulk-create classifications, parent accounts and accounts."
      width="max-w-3xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={() =>
                downloadGLAccountImportTemplateBasic(classifications, groups, existingAccounts)
              }
            >
              Basic Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={() => downloadGLAccountImportTemplate(classifications, groups)}
            >
              Advanced Template
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
              {result ? 'Close' : 'Cancel'}
            </Button>
            <Button
              onClick={handleImport}
              disabled={totalNew === 0 || isImporting}
              isLoading={isImporting}
              loadingText="Importing…"
            >
              Import {totalNew > 0 ? totalNew : ''} item{totalNew === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-2">
        <FileUpload
          label="Filled template"
          accept=".xlsx"
          value={file}
          onChange={handleFileChange}
          hint="Only .xlsx files exported from the template above are supported."
        />

        {isParsing && <p className="text-sm text-gray-500">Reading file…</p>}

        {result && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-gray-500">
              {totalNew} new item{totalNew === 1 ? '' : 's'} ready to create
              {hasInvalidRows && ' — some rows need fixing'}
            </p>

            {visibleClassifications.length > 0 && (
              <ImportSection
                title="Classifications"
                rows={visibleClassifications}
                results={results}
                prefix="classification"
                columns={['Code', 'Name', 'Type']}
                renderRow={(row) => [row.code || '—', row.name || '—', row.categoryLabel || '—']}
              />
            )}

            {visibleGroups.length > 0 && (
              <ImportSection
                title="Parent Accounts"
                rows={visibleGroups}
                results={results}
                prefix="group"
                columns={['Code', 'Name', 'Classification']}
                renderRow={(row) => [
                  row.code || '—',
                  row.name || '—',
                  row.classificationCode || '—',
                ]}
              />
            )}

            {visibleAccounts.length > 0 && (
              <ImportSection
                title="Accounts"
                rows={visibleAccounts}
                results={results}
                prefix="account"
                columns={['Code', 'Name', 'Type']}
                renderRow={(row) => [row.code || '—', row.name || '—', row.categoryLabel || '—']}
              />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function ImportSection<T extends { rowNumber: number; status: ImportRowStatus; errors: string[] }>({
  title,
  rows,
  results,
  prefix,
  columns,
  renderRow,
}: {
  title: string;
  rows: T[];
  results: Record<string, BulkImportRowResult>;
  prefix: string;
  columns: string[];
  renderRow: (row: T) => [string, string, string];
}) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h4>
      <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-100">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Row</th>
              {columns.map((col) => (
                <th key={col} className="px-3 py-2 font-semibold">
                  {col}
                </th>
              ))}
              <th className="px-3 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const [a, b, c] = renderRow(row);
              return (
                <tr key={row.rowNumber} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-400">{row.rowNumber}</td>
                  <td className="px-3 py-2 font-mono text-gray-700">{a}</td>
                  <td className="px-3 py-2 text-gray-700">{b}</td>
                  <td className="px-3 py-2 text-gray-500">{c}</td>
                  <td className="px-3 py-2">
                    <StatusCell
                      status={row.status}
                      result={results[`${prefix}-${row.rowNumber}`]}
                      errors={row.errors}
                    />
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
