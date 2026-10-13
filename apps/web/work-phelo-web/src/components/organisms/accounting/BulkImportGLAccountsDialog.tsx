'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { FileUpload } from '@/components/atoms/FileUpload';
import {
  CATEGORY_CODE_RANGES,
  bandProblem,
  outOfRangeFor,
} from '@/lib/accounting/glAccountImportShared';
import { cn, inputClass } from '@/lib/utils';
import { downloadGLAccountImportTemplate } from '@/lib/accounting/glAccountImportTemplate';
import { downloadGLAccountImportTemplateBasic } from '@/lib/accounting/glAccountImportTemplateBasic';
import {
  parseGLAccountImportFile,
  type GLAccountImportResult,
  type ImportRowStatus,
  type ParsedGLAccountRow,
  type ParsedGroupRow,
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

type EditableRow<T> = T & { codeEditable?: boolean };

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
  /** Codes the user retyped in the preview for accounts whose code was outside their type's
   *  range, keyed by sheet row number. */
  const [codeOverrides, setCodeOverrides] = useState<Record<number, string>>({});
  const [groupOverrides, setGroupOverrides] = useState<Record<number, string>>({});
  /** Rows the user chose to leave out of the import, keyed like `results` (`group-12`). */
  const [ignored, setIgnored] = useState<Record<string, boolean>>({});

  const reset = () => {
    setFile(null);
    setResult(null);
    setResults({});
    setCodeOverrides({});
    setGroupOverrides({});
    setIgnored({});
    setIsParsing(false);
  };

  const toggleIgnore = (key: string) => setIgnored((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = async (selected: File | null) => {
    setFile(selected);
    setResults({});
    setCodeOverrides({});
    setGroupOverrides({});
    setIgnored({});
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

  // Parent account and account codes that break a numbering rule (type range, or the band of
  // the code above them) can be retyped in the preview. This re-derives every row's effective
  // code and status from those edits — and blocks accounts whose parent account is itself still
  // invalid, rather than letting them fail at the server — without touching the parsed file.
  const { groupRows, accountRows } = useMemo(() => {
    const fileGroups = result?.groups ?? [];
    const accounts = result?.accounts ?? [];
    const takenGroupCodes = new Set(groups.map((g) => norm(g.code)));
    const takenAccountCodes = new Set(existingAccounts.map((a) => norm(a.code)));

    const rangeMessage = (row: ParsedGLAccountRow) => {
      const range = row.category ? CATEGORY_CODE_RANGES[row.category] : undefined;
      return range
        ? `Code must be between ${range.min} and ${range.max} for ${row.categoryLabel} accounts`
        : undefined;
    };

    // --- Parent accounts (groups): code must sit in the band of their classification ---
    const groupProblem = (row: ParsedGroupRow, code: string) =>
      bandProblem(code, row.classificationCode);
    const groupFileCounts = new Map<string, number>();
    for (const row of fileGroups) {
      if (row.status === 'existing' || row.errors.length > 0) continue;
      const override = groupOverrides[row.rowNumber];
      if (override === undefined && groupProblem(row, row.code)) continue;
      const key = norm(override ?? row.code);
      groupFileCounts.set(key, (groupFileCounts.get(key) ?? 0) + 1);
    }
    const effectiveGroups: EditableRow<ParsedGroupRow>[] = fileGroups.map((row) => {
      if (row.status === 'existing' || row.errors.length > 0) return row;
      const override = groupOverrides[row.rowNumber];
      const code = (override ?? row.code).trim();
      const errors: string[] = [];
      if (override !== undefined && !/^\d+$/.test(code)) errors.push('Code must be numeric');
      else {
        const problem = groupProblem(row, code);
        if (problem) errors.push(problem);
        else if (override !== undefined && takenGroupCodes.has(norm(code)))
          errors.push(`Parent account code "${code}" already exists`);
        else if (override !== undefined && (groupFileCounts.get(norm(code)) ?? 0) > 1)
          errors.push(`Duplicate parent account code "${code}" in this file`);
      }
      const hasProblem = errors.length > 0;
      return {
        ...row,
        code,
        status: hasProblem ? 'invalid' : row.status,
        errors,
        codeEditable: hasProblem || override !== undefined,
      };
    });
    const groupByOriginalCode = new Map(
      fileGroups.map((g, i) => [norm(g.code), effectiveGroups[i]]),
    );
    const existingGroupByCode = new Map(groups.map((g) => [norm(g.code), g]));

    // --- Accounts: code must be in the type's range and the band of its parent account (or,
    // with none, its classification) ---
    const parentCodeFor = (row: ParsedGLAccountRow): string => {
      if (!row.parentAccountCode) return row.classificationCode;
      const key = norm(row.parentAccountCode);
      return groupByOriginalCode.get(key)?.code ?? existingGroupByCode.get(key)?.code ?? '';
    };
    const accountProblem = (row: ParsedGLAccountRow, code: string) => {
      const range = row.category ? outOfRangeFor(code, row.category) : undefined;
      if (range) return rangeMessage(row);
      const parentCode = parentCodeFor(row);
      return parentCode ? bandProblem(code, parentCode) : undefined;
    };
    const parentIsBlocked = (row: ParsedGLAccountRow) => {
      if (!row.parentAccountCode) return false;
      const parent = groupByOriginalCode.get(norm(row.parentAccountCode));
      return !!parent && (parent.status === 'invalid' || !!ignored[`group-${parent.rowNumber}`]);
    };

    const accountFileCounts = new Map<string, number>();
    for (const row of accounts) {
      if (row.status === 'existing' || (row.errors.length > 0 && !row.codeRange)) continue;
      const override = codeOverrides[row.rowNumber];
      if (override === undefined && accountProblem(row, row.code)) continue;
      const key = norm(override ?? row.code);
      accountFileCounts.set(key, (accountFileCounts.get(key) ?? 0) + 1);
    }
    const effectiveAccounts: EditableRow<ParsedGLAccountRow>[] = accounts.map((row) => {
      if (row.status === 'existing') return row;
      // Errors other than the (fixable) range problem stay as the parser reported them
      if (row.errors.length > 0) return row;
      if (parentIsBlocked(row)) {
        return {
          ...row,
          status: 'invalid',
          errors: [
            ignored[`group-${groupByOriginalCode.get(norm(row.parentAccountCode))?.rowNumber}`]
              ? `Parent account "${row.parentAccountCode}" is ignored`
              : `Parent account "${row.parentAccountCode}" has a code that needs fixing first`,
          ],
        };
      }
      const override = codeOverrides[row.rowNumber];
      const code = (override ?? row.code).trim();
      const errors: string[] = [];
      if (override !== undefined && !/^\d+$/.test(code)) errors.push('Code must be numeric');
      else {
        const problem = accountProblem(row, code);
        if (problem) errors.push(problem);
        else if (override !== undefined && takenAccountCodes.has(norm(code)))
          errors.push(`Account code "${code}" already exists`);
        else if (override !== undefined && (accountFileCounts.get(norm(code)) ?? 0) > 1)
          errors.push(`Duplicate account code "${code}" in this file`);
      }
      const hasProblem = errors.length > 0;
      return {
        ...row,
        code,
        // The server looks the parent up by the code it was created with, so follow edits
        parentAccountCode: row.parentAccountCode
          ? (groupByOriginalCode.get(norm(row.parentAccountCode))?.code ?? row.parentAccountCode)
          : '',
        status: hasProblem ? 'invalid' : 'new',
        errors,
        codeEditable: hasProblem || override !== undefined,
      };
    });

    return { groupRows: effectiveGroups, accountRows: effectiveAccounts };
  }, [result, groupOverrides, codeOverrides, ignored, groups, existingAccounts]);

  const isIgnored = (prefix: string, row: { rowNumber: number }) =>
    !!ignored[`${prefix}-${row.rowNumber}`];

  const newClassifications =
    result?.classifications.filter((r) => r.status === 'new' && !isIgnored('classification', r)) ??
    [];
  const newGroups = groupRows.filter((r) => r.status === 'new' && !isIgnored('group', r));
  const newAccounts = accountRows.filter((r) => r.status === 'new' && !isIgnored('account', r));
  // The preview only needs to show rows that will actually do something — rows that already
  // exist are silently reused for cross-referencing and would otherwise clutter every import
  // with the tenant's entire existing chart of accounts.
  const visibleClassifications =
    result?.classifications.filter((r) => r.status !== 'existing') ?? [];
  const visibleGroups = groupRows.filter((r) => r.status !== 'existing');
  const visibleAccounts = accountRows.filter((r) => r.status !== 'existing');
  const hasInvalidRows =
    (result?.classifications.some(
      (r) => r.status === 'invalid' && !isIgnored('classification', r),
    ) ??
      false) ||
    groupRows.some((r) => r.status === 'invalid' && !isIgnored('group', r)) ||
    accountRows.some((r) => r.status === 'invalid' && !isIgnored('account', r));
  const ignoredCount = Object.values(ignored).filter(Boolean).length;
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
              {hasInvalidRows && ' — some rows need fixing (or ignoring)'}
              {ignoredCount > 0 && ` · ${ignoredCount} ignored`}
            </p>

            {visibleClassifications.length > 0 && (
              <ImportSection
                title="Classifications"
                rows={visibleClassifications}
                results={results}
                ignored={ignored}
                onToggleIgnore={toggleIgnore}
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
                ignored={ignored}
                onToggleIgnore={toggleIgnore}
                prefix="group"
                columns={['Code', 'Name', 'Classification']}
                renderRow={(row) => [
                  row.code || '—',
                  row.name || '—',
                  row.classificationCode || '—',
                ]}
                renderCode={(row) =>
                  row.codeEditable ? (
                    <CodeInput
                      value={groupOverrides[row.rowNumber] ?? row.code}
                      invalid={row.status === 'invalid'}
                      label={`Parent account code for row ${row.rowNumber}`}
                      onChange={(value) =>
                        setGroupOverrides((prev) => ({ ...prev, [row.rowNumber]: value }))
                      }
                    />
                  ) : undefined
                }
              />
            )}

            {visibleAccounts.length > 0 && (
              <ImportSection
                title="Accounts"
                rows={visibleAccounts}
                results={results}
                ignored={ignored}
                onToggleIgnore={toggleIgnore}
                prefix="account"
                columns={['Code', 'Name', 'Type']}
                renderRow={(row) => [row.code || '—', row.name || '—', row.categoryLabel || '—']}
                renderCode={(row) =>
                  row.codeEditable ? (
                    <CodeInput
                      value={codeOverrides[row.rowNumber] ?? row.code}
                      invalid={row.status === 'invalid'}
                      label={`Account code for row ${row.rowNumber}`}
                      onChange={(value) =>
                        setCodeOverrides((prev) => ({ ...prev, [row.rowNumber]: value }))
                      }
                    />
                  ) : undefined
                }
              />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function CodeInput({
  value,
  invalid,
  label,
  onChange,
}: {
  value: string;
  invalid: boolean;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={cn(inputClass(invalid ? 'error' : undefined, 'py-1 text-xs font-mono'), 'w-24')}
    />
  );
}

function ImportSection<T extends { rowNumber: number; status: ImportRowStatus; errors: string[] }>({
  title,
  rows,
  results,
  ignored,
  onToggleIgnore,
  prefix,
  columns,
  renderRow,
  renderCode,
}: {
  title: string;
  rows: T[];
  results: Record<string, BulkImportRowResult>;
  ignored: Record<string, boolean>;
  onToggleIgnore: (key: string) => void;
  prefix: string;
  columns: string[];
  renderRow: (row: T) => [string, string, string];
  /** Replaces the plain-text code cell, e.g. with an editable input. Return undefined to keep the text. */
  renderCode?: (row: T) => React.ReactNode;
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
              const key = `${prefix}-${row.rowNumber}`;
              const isIgnored = !!ignored[key];
              return (
                <tr
                  key={row.rowNumber}
                  className={cn('border-t border-gray-100', isIgnored && 'opacity-50')}
                >
                  <td className="px-3 py-2 text-gray-400">{row.rowNumber}</td>
                  <td className="px-3 py-2 font-mono text-gray-700">{renderCode?.(row) ?? a}</td>
                  <td className="px-3 py-2 text-gray-700">{b}</td>
                  <td className="px-3 py-2 text-gray-500">{c}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      {isIgnored ? (
                        <span className="text-gray-500">Ignored — will not be imported</span>
                      ) : (
                        <StatusCell status={row.status} result={results[key]} errors={row.errors} />
                      )}
                      {(isIgnored || (row.status === 'invalid' && !results[key])) && (
                        <button
                          type="button"
                          onClick={() => onToggleIgnore(key)}
                          className="shrink-0 font-medium text-brand hover:underline"
                        >
                          {isIgnored ? 'Restore' : 'Ignore'}
                        </button>
                      )}
                    </div>
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
