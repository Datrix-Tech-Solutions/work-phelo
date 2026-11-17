'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { FileUpload } from '@/components/atoms/FileUpload';
import { ImportPreviewSection, type ImportSectionData } from './ImportPreviewSection';
import type { BulkImportRowResult } from '@/lib/hr/bulkImportTypes';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

type ResultsByKey = Record<string, BulkImportRowResult[]>;

interface BulkUploadImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  onDownloadTemplate?: () => void;
  parseFile?: (file: File) => Promise<ImportSectionData[]>;
  onImport?: (sections: ImportSectionData[]) => Promise<ResultsByKey>;
  /** When true, employee sections show a checkbox per row to also give that employee a login. */
  canGrantAccess?: boolean;
}

export function BulkUploadImportDialog({
  isOpen,
  onClose,
  title,
  description,
  onDownloadTemplate,
  parseFile,
  onImport,
  canGrantAccess = false,
}: BulkUploadImportDialogProps) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [sections, setSections] = useState<ImportSectionData[] | null>(null);
  const [results, setResults] = useState<ResultsByKey | null>(null);

  const reset = () => {
    setFile(null);
    setSections(null);
    setResults(null);
    setIsParsing(false);
    setIsImporting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = async (selected: File | null) => {
    setFile(selected);
    setResults(null);
    if (!selected || !parseFile) {
      setSections(null);
      return;
    }
    setIsParsing(true);
    try {
      const parsed = await parseFile(selected);
      setSections(parsed);
      if (parsed.every((s) => s.rows.length === 0)) {
        toast.error('No rows found in this file');
      }
    } catch (error) {
      toast.error(extractError(error, 'Unable to read this file — is it the template?'));
      setSections(null);
    } finally {
      setIsParsing(false);
    }
  };

  const totalNew =
    sections?.reduce((sum, s) => sum + s.rows.filter((r) => r.status === 'new').length, 0) ?? 0;
  const hasInvalidRows = sections?.some((s) => s.rows.some((r) => r.status === 'invalid')) ?? false;

  const setAccess = (sectionKey: string, rowNumber: number | 'all', value: boolean) => {
    setSections(
      (current) =>
        current?.map((section) =>
          section.key !== sectionKey
            ? section
            : {
                ...section,
                rows: section.rows.map((row) => {
                  const r = row as typeof row & { email?: string };
                  const matches = rowNumber === 'all' || row.rowNumber === rowNumber;
                  if (!matches || row.status !== 'new' || !r.email) return row;
                  return { ...row, grantAccess: value };
                }),
              },
        ) ?? null,
    );
  };

  const updateRow = (sectionKey: string, rowNumber: number, patch: Record<string, unknown>) => {
    setSections(
      (current) =>
        current?.map((section) =>
          section.key !== sectionKey
            ? section
            : {
                ...section,
                rows: section.rows.map((row) =>
                  row.rowNumber !== rowNumber
                    ? row
                    : section.reviseRow
                      ? section.reviseRow(row, patch)
                      : { ...row, ...patch },
                ),
              },
        ) ?? null,
    );
  };

  const handleImport = async () => {
    if (!sections || !onImport) return;
    setIsImporting(true);
    try {
      const nextResults = await onImport(sections);
      setResults(nextResults);

      const allResults = Object.values(nextResults).flat();
      const createdCount = allResults.filter((r) => r.status === 'created').length;
      const accessFailures = allResults.filter((r) => r.access === 'failed').length;

      if (createdCount === totalNew && accessFailures === 0) {
        toast.success(`Created ${createdCount} item${createdCount === 1 ? '' : 's'}`);
        handleClose();
      } else if (createdCount === totalNew) {
        toast.error(
          `Created ${createdCount}, but access could not be granted for ${accessFailures} — see below`,
        );
      } else {
        toast.error(`Created ${createdCount} of ${totalNew} — see errors below`);
      }
    } catch (error) {
      toast.error(extractError(error, 'Unable to import — no items were created'));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      description={description}
      width="max-w-3xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="h-3.5 w-3.5" />}
            disabled={!onDownloadTemplate}
            onClick={onDownloadTemplate}
          >
            Download Template
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
              {results ? 'Close' : 'Cancel'}
            </Button>
            <Button
              onClick={handleImport}
              disabled={!onImport || totalNew === 0 || isImporting}
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

        {sections && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-gray-500">
              {totalNew} new item{totalNew === 1 ? '' : 's'} ready to create
              {hasInvalidRows && ' — some rows need fixing'}
            </p>

            {sections.map((section) => (
              <ImportPreviewSection
                key={section.key}
                title={section.title}
                rows={section.rows}
                columns={section.columns}
                supportsAccess={section.supportsAccess}
                onToggleAccess={
                  canGrantAccess && section.supportsAccess
                    ? (rowNumber, value) => setAccess(section.key, rowNumber, value)
                    : undefined
                }
                onToggleAllAccess={
                  canGrantAccess && section.supportsAccess
                    ? (value) => setAccess(section.key, 'all', value)
                    : undefined
                }
                onUpdateRow={(rowNumber, patch) => updateRow(section.key, rowNumber, patch)}
                results={results?.[section.key]}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
