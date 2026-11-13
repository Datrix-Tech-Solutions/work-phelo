import type { InventoryItem } from '@/hooks/inventory/useInventoryItems';

export const ITEM_EXPORT_HEADERS = [
  'Name',
  'SKU',
  'Variant',
  'Category',
  'Subcategory',
  'Unit',
  'Description',
  'Cost Price',
  'Selling Price',
  'Reorder Level',
  'Max Stock',
  'Perishable',
  'Status',
] as const;

export interface ItemExportLookups {
  /** Active variant names by item id. */
  variantsByItem: Record<string, string[]>;
  categoryName: (id: string) => string;
  subcategoryName: (id: string | null) => string;
  unitName: (id: string) => string;
}

/** One row per item, or one per variant for an item that has them: a variant's row repeats the
 *  item's name, SKU and details, and adds the variant's name. */
export function buildItemExportRows(items: InventoryItem[], lookups: ItemExportLookups) {
  return items.flatMap((item) => {
    const base = {
      Name: item.name,
      SKU: item.sku,
      Category: lookups.categoryName(item.categoryId),
      Subcategory: lookups.subcategoryName(item.subcategoryId),
      Unit: lookups.unitName(item.unitId),
      Description: item.description ?? '',
      'Cost Price': item.costPrice,
      'Selling Price': item.sellingPrice,
      'Reorder Level': item.reorderLevel,
      'Max Stock': item.maxStock,
      Perishable: item.isPerishable ? 'Yes' : 'No',
      Status: item.status === 'ACTIVE' ? 'Active' : 'Inactive',
    };
    const variants = lookups.variantsByItem[item.id] ?? [];
    return variants.length > 0
      ? variants.map((variant) => ({ ...base, Variant: variant }))
      : [{ ...base, Variant: '' }];
  });
}

async function downloadSheet(
  sheetName: string,
  fileName: string,
  headers: readonly string[],
  rows: object[],
) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = headers.map((header) => ({ header, key: header, width: 18 }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Builds and downloads the products as an .xlsx file. */
export function downloadItemsExport(items: InventoryItem[], lookups: ItemExportLookups) {
  return downloadSheet(
    'Products',
    'inventory-products.xlsx',
    ITEM_EXPORT_HEADERS,
    buildItemExportRows(items, lookups),
  );
}

export const CODE_EXPORT_HEADERS = ['Name', 'SKU'] as const;

/** One row per item: its name and SKU. */
export function buildCodeExportRows(items: InventoryItem[]) {
  return items.map((item) => ({ Name: item.name, SKU: item.sku }));
}

/** Builds and downloads the item names and SKUs as an .xlsx file. */
export function downloadCodesExport(items: InventoryItem[]) {
  return downloadSheet(
    'Codes',
    'inventory-codes.xlsx',
    CODE_EXPORT_HEADERS,
    buildCodeExportRows(items),
  );
}
