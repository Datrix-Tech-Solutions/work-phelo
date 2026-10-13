'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { FileUpload } from '@/components/atoms/FileUpload';
import {
  createCodeGenerator,
  downloadEntityImportTemplate,
  parseEntityImportFile,
  type ParsedEntityRow,
} from '@/lib/accounting/entityImport';
import { useCreateSubledger, useEntityTypes, useSubledgers } from '@/hooks';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface ImportEntitiesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type RowResult = { status: 'created'; code: string } | { status: 'failed'; message: string };

export function ImportEntitiesDialog({ isOpen, onClose }: ImportEntitiesDialogProps) {
  const toast = useToast();
  const { dialCode } = useTenantConfig();
  const { data: entityTypes = [] } = useEntityTypes();
  const { data: existingEntities = [] } = useSubledgers();
  const { mutateAsync: createSubledger } = useCreateSubledger();

  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [rows, setRows] = useState<ParsedEntityRow[] | null>(null);
  const [results, setResults] = useState<Record<number, RowResult>>({});

  const reset = () => {
    setFile(null);
    setRows(null);
    setResults({});
    setIsParsing(false);
    setIsImporting(false);
  };

  const handleClose = () => {
    if (isImporting) return;
    reset();
    onClose();
  };

  const handleFileChange = async (selected: File | null) => {
    setFile(selected);
    setResults({});
    if (!selected) {
      setRows(null);
      return;
    }
    setIsParsing(true);
    try {
      const parsed = await parseEntityImportFile(selected, { entityTypes, dialCode });
      if (parsed.length === 0) toast.error('No rows found in this file');
      setRows(parsed);
    } catch (error) {
      toast.error(extractError(error, 'Unable to read this file — is it the template?'));
      setRows(null);
    } finally {
      setIsParsing(false);
    }
  };

  const issueCount = rows?.filter((r) => r.errors.length > 0).length ?? 0;
  // Rows already created (a retry after a partial failure) are never sent again.
  const pending = rows?.filter((r) => results[r.rowNumber]?.status !== 'created') ?? [];
  const canImport = rows !== null && rows.length > 0 && issueCount === 0 && pending.length > 0;

  const handleImport = async () => {
    if (!canImport) return;
    setIsImporting(true);
    const nextCode = createCodeGenerator(existingEntities);
    const nextResults = { ...results };
    let created = 0;

    // One at a time so each generated code is committed before the next is handed out.
    for (const row of pending) {
      try {
        const subledger = await createSubledger({
          code: nextCode(row.prefix!),
          name: row.name,
          type: row.type!,
          contactName: row.contactName || undefined,
          phone: row.phone || undefined,
          address: row.address || undefined,
        });
        nextResults[row.rowNumber] = { status: 'created', code: subledger.code };
        created += 1;
      } catch (error) {
        nextResults[row.rowNumber] = {
          status: 'failed',
          message: extractError(error, 'Failed to create entity'),
        };
      }
    }
    setResults(nextResults);
    setIsImporting(false);

    if (created === pending.length) {
      toast.success(`Created ${created} entit${created === 1 ? 'y' : 'ies'}`);
      reset();
      onClose();
    } else {
      toast.error(`Created ${created} of ${pending.length} — see errors below`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Entities"
      description="Upload the filled template to create entities in bulk. Each entity's ID is generated automatically once it is created."
      width="max-w-5xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="h-3.5 w-3.5" />}
            onClick={() => downloadEntityImportTemplate(entityTypes)}
          >
            Template
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
              {rows ? 'Close' : 'Cancel'}
            </Button>
            <Button
              onClick={handleImport}
              disabled={!canImport}
              isLoading={isImporting}
              loadingText="Importing…"
            >
              Import {pending.length > 0 ? pending.length : ''}{' '}
              {pending.length === 1 ? 'entity' : 'entities'}
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
          hint="Only .xlsx files exported from the template are supported."
        />

        {isParsing && <p className="text-sm text-gray-500">Reading file…</p>}

        {rows && rows.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className={issueCount > 0 ? 'text-xs text-red-600' : 'text-xs text-green-600'}>
              {issueCount > 0
                ? `${issueCount} row${issueCount === 1 ? '' : 's'} need${issueCount === 1 ? 's' : ''} fixing in the file before you can import — fix it and upload again`
                : `${rows.length} entit${rows.length === 1 ? 'y' : 'ies'} ready to import`}
            </p>

            <div className="max-h-96 overflow-auto rounded-lg border border-gray-100">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Row</th>
                    <th className="px-3 py-2 font-semibold">Type</th>
                    <th className="px-3 py-2 font-semibold">Name</th>
                    <th className="px-3 py-2 font-semibold">Contact Person</th>
                    <th className="px-3 py-2 font-semibold">Phone</th>
                    <th className="px-3 py-2 font-semibold">Address</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const result = results[row.rowNumber];
                    return (
                      <tr key={row.rowNumber} className="border-t border-gray-100 align-top">
                        <td className="px-3 py-2 text-gray-400">{row.rowNumber}</td>
                        <td className="px-3 py-2 text-gray-700">{row.typeLabel || '—'}</td>
                        <td className="px-3 py-2 text-gray-700">{row.name || '—'}</td>
                        <td className="px-3 py-2 text-gray-700">{row.contactName || '—'}</td>
                        <td className="px-3 py-2 text-gray-700">{row.phone || '—'}</td>
                        <td className="px-3 py-2 text-gray-700">{row.address || '—'}</td>
                        <td className="px-3 py-2">
                          {result?.status === 'created' ? (
                            <span className="text-green-600">Created as {result.code}</span>
                          ) : result?.status === 'failed' ? (
                            <span className="text-red-600">{result.message}</span>
                          ) : row.errors.length > 0 ? (
                            <span className="text-red-600">{row.errors.join('; ')}</span>
                          ) : (
                            <span className="text-green-600">Ready</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
