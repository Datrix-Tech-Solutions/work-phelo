'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { extractError } from '@/lib/extractError';
import { useToast } from '@/hooks/useToast';
import { downloadCodesExport, downloadItemsExport } from '@/lib/inventory/itemExport';
import type { InventoryItem } from '@/hooks/inventory/useInventoryItems';
import { useItemVariantsMap } from '@/hooks/inventory/useItemVariants';
import { useInventoryCategories } from '@/hooks/inventory/useInventoryCategories';
import { useSubcategories } from '@/hooks/inventory/useCategorySubcategories';
import { useInventoryUnits } from '@/hooks/inventory/useInventoryUnits';

interface ItemExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** The items to export: those the items page is showing after its search and filters. */
  items: InventoryItem[];
}

const OPTIONS = [
  { value: 'products', label: 'Products', hint: 'Every item with its details and prices.' },
  { value: 'codes', label: 'Codes', hint: 'Item names with their SKUs only.' },
] as const;

/** Pick what to export. Products has a row per variant; Codes lists each item's name and SKU. */
export function ItemExportDialog({ isOpen, onClose, items }: ItemExportDialogProps) {
  const toast = useToast();
  const [choice, setChoice] = useState<(typeof OPTIONS)[number]['value']>('products');
  const [isExporting, setIsExporting] = useState(false);
  const variantsByItem = useItemVariantsMap();
  const { categories } = useInventoryCategories();
  const { subcategories } = useSubcategories();
  const { units } = useInventoryUnits();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (choice === 'codes') {
        await downloadCodesExport(items);
      } else {
        await downloadItemsExport(items, {
          variantsByItem,
          categoryName: (id) => categories.find((c) => c.id === id)?.name ?? '',
          subcategoryName: (id) => subcategories.find((s) => s.id === id)?.name ?? '',
          unitName: (id) => units.find((u) => u.id === id)?.name ?? '',
        });
      }
      onClose();
    } catch (err) {
      toast.error(extractError(err, 'Could not export'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Items"
      description={`Choose what to export. Items shown on the page (matching the current search and filters): ${items.length}.`}
      footer={
        <div className="flex w-full items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleExport} isLoading={isExporting} loadingText="Exporting...">
            Export
          </Button>
        </div>
      }
    >
      <div role="radiogroup" className="flex flex-col gap-3">
        {OPTIONS.map((o) => {
          const selected = choice === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setChoice(o.value)}
              className={`flex flex-col items-start gap-0.5 rounded-lg border px-4 py-3 text-left transition-colors ${
                selected ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-sm font-semibold text-gray-900">{o.label}</span>
              <span className="text-xs text-gray-500">{o.hint}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
