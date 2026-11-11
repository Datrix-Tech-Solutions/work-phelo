'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { FileUpload } from '@/components/atoms/FileUpload';
import { extractError } from '@/lib/extractError';
import { useToast } from '@/hooks/useToast';
import {
  downloadItemImportTemplate,
  parseItemImportFile,
  type ParsedItemRow,
} from '@/lib/inventory/itemImport';
import {
  useBulkImportItems,
  useInventoryItems,
  type ItemImportResult,
} from '@/hooks/inventory/useInventoryItems';
import { useInventoryCategories } from '@/hooks/inventory/useInventoryCategories';
import { useInventoryUnits } from '@/hooks/inventory/useInventoryUnits';
import { useSubcategories } from '@/hooks/inventory/useCategorySubcategories';

interface ItemImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const CATEGORY = ['category', 'categories'] as const;
const SUBCATEGORY = ['subcategory', 'subcategories'] as const;

/** Bulk-creates items from the .xlsx template. Categories, subcategories and units that are not in
 *  the company yet are created along with the items. */
export function ItemImportDialog({ isOpen, onClose }: ItemImportDialogProps) {
  const toast = useToast();
  const { items } = useInventoryItems();
  const { categories } = useInventoryCategories();
  const { subcategories } = useSubcategories();
  const { units } = useInventoryUnits();
  const { bulkImport, isPending } = useBulkImportItems();

  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedItemRow[] | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [outcome, setOutcome] = useState<ItemImportResult | null>(null);

  const reset = () => {
    setFile(null);
    setRows(null);
    setOutcome(null);
    setIsParsing(false);
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (selected: File | null) => {
    setFile(selected);
    setOutcome(null);
    if (!selected) {
      setRows(null);
      return;
    }
    setIsParsing(true);
    try {
      const parsed = await parseItemImportFile(selected, {
        categories,
        subcategories,
        units,
        skus: items.map((i) => i.sku),
      });
      setRows(parsed);
      if (parsed.length === 0) toast.error('No rows found in this file');
    } catch (error) {
      toast.error(extractError(error, 'Unable to read this file. Is it the template?'));
      setRows(null);
    } finally {
      setIsParsing(false);
    }
  };

  const ready = useMemo(() => (rows ?? []).filter((r) => r.status === 'new'), [rows]);
  const counts = useMemo(() => {
    const all = rows ?? [];
    const created = (prefix: string) =>
      new Set(ready.flatMap((r) => r.creates.filter((c) => c.startsWith(prefix)))).size;
    return {
      ready: ready.length,
      existing: all.filter((r) => r.status === 'existing').length,
      invalid: all.filter((r) => r.status === 'invalid').length,
      categories: created('Category'),
      subcategories: created('Subcategory'),
      units: created('Unit'),
    };
  }, [rows, ready]);

  const resultBySku = useMemo(
    () => new Map((outcome?.results ?? []).map((r) => [r.sku.toLowerCase(), r])),
    [outcome],
  );

  const handleImport = async () => {
    if (ready.length === 0) return;
    try {
      const result = await bulkImport(ready.map((r) => r.payload));
      setOutcome(result);
      const created = result.results.filter((r) => r.status === 'created').length;
      const failed = result.results.filter((r) => r.status === 'failed').length;
      if (failed === 0) toast.success(`${plural(created, 'item')} imported`);
      else toast.error(`${created} imported, ${failed} failed. See the list below.`);
    } catch (error) {
      toast.error(extractError(error, 'Could not import the items'));
    }
  };

  const statusCell = (row: ParsedItemRow) => {
    const result = resultBySku.get(row.payload.sku.toLowerCase());
    if (outcome && row.status === 'new' && result) {
      if (result.status === 'created') return <span className="text-green-600">Created</span>;
      if (result.status === 'failed') return <span className="text-red-600">{result.message}</span>;
      return <span className="text-amber-600">{result.message}</span>;
    }
    if (row.status === 'invalid')
      return <span className="text-red-600">{row.errors.join('; ')}</span>;
    if (row.status === 'existing') return <span className="text-gray-400">Already exists</span>;
    return (
      <span className="text-green-600">
        Ready{row.creates.length > 0 && ` · adds ${row.creates.join(', ')}`}
      </span>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Items"
      description="Download the template, fill it in, then upload it here. Categories, subcategories and units that don't exist yet are created for you."
      width="max-w-4xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="h-3.5 w-3.5" />}
            onClick={() => downloadItemImportTemplate()}
          >
            Download Template
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isPending}>
              {outcome ? 'Close' : 'Cancel'}
            </Button>
            {!outcome && (
              <Button
                onClick={handleImport}
                isLoading={isPending}
                loadingText="Importing..."
                disabled={ready.length === 0}
              >
                {ready.length > 0 ? `Import ${plural(ready.length, 'Item')}` : 'Import'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FileUpload
          label="Items file (.xlsx)"
          accept=".xlsx"
          value={file}
          onChange={handleFile}
          hint={isParsing ? 'Reading file...' : undefined}
        />

        {rows && rows.length > 0 && (
          <>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600">
              <span>
                <span className="font-semibold text-green-600">{counts.ready}</span> ready
              </span>
              <span>
                <span className="font-semibold text-gray-900">{counts.existing}</span> already exist
                (skipped)
              </span>
              <span>
                <span className="font-semibold text-red-600">{counts.invalid}</span> with errors
              </span>
              {(counts.categories > 0 || counts.subcategories > 0 || counts.units > 0) && (
                <span>
                  Will also create{' '}
                  {[
                    counts.categories > 0 && plural(counts.categories, ...CATEGORY),
                    counts.subcategories > 0 && plural(counts.subcategories, ...SUBCATEGORY),
                    counts.units > 0 && plural(counts.units, 'unit'),
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              )}
            </div>

            <div className="max-h-96 overflow-auto rounded-xl border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-gray-50 text-xs font-bold text-gray-900">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Unit</th>
                    <th className="px-3 py-2">Variants</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td className="px-3 py-2 text-gray-500">{row.rowNumber}</td>
                      <td className="px-3 py-2 font-semibold text-gray-900">{row.payload.name}</td>
                      <td className="px-3 py-2 font-mono text-gray-600">{row.payload.sku}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {row.payload.category}
                        {row.payload.subcategory && ` / ${row.payload.subcategory}`}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{row.payload.unit}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {row.payload.variants?.join(', ') ?? '—'}
                      </td>
                      <td className="px-3 py-2">{statusCell(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {outcome && (
          <p className="text-sm text-gray-600">
            {[
              outcome.createdCategories.length > 0 &&
                `${plural(outcome.createdCategories.length, ...CATEGORY)} created`,
              outcome.createdSubcategories.length > 0 &&
                `${plural(outcome.createdSubcategories.length, ...SUBCATEGORY)} created`,
              outcome.createdUnits.length > 0 &&
                `${plural(outcome.createdUnits.length, 'unit')} created`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>
    </Modal>
  );
}
