import type ExcelJS from 'exceljs';
import { cellText, headerIndex } from '@/lib/accounting/glAccountImportParser';

export const ITEM_IMPORT_HEADERS = [
  'Name',
  'SKU',
  'Category',
  'Subcategory',
  'Unit',
  'Unit Symbol',
  'Variants',
  'Description',
  'Cost Price',
  'Selling Price',
  'Reorder Level',
  'Max Stock',
  'Perishable',
  'Status',
] as const;

/** One row as the service's bulk-import endpoint takes it. */
export interface ItemImportPayloadRow {
  name: string;
  sku: string;
  category: string;
  subcategory?: string;
  unit: string;
  unitSymbol?: string;
  variants?: string[];
  description?: string;
  costPrice?: string;
  sellingPrice?: string;
  reorderLevel?: string;
  maxStock?: string;
  isPerishable: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}

export type ItemImportRowStatus = 'new' | 'existing' | 'invalid';

export interface ParsedItemRow {
  rowNumber: number;
  payload: ItemImportPayloadRow;
  status: ItemImportRowStatus;
  errors: string[];
  /** What this row will create besides the item, e.g. `Category "Stationery"`. */
  creates: string[];
}

export interface ItemImportLookups {
  categories: { id: string; name: string; status: string }[];
  subcategories: { categoryId: string; name: string; status: string }[];
  units: { name: string; status: string }[];
  skus: string[];
}

const norm = (value: string) => value.trim().toLowerCase();
const DECIMAL = /^\d{1,14}(\.\d{1,4})?$/;
const YES = new Set(['yes', 'y', 'true', '1']);
const NO = new Set(['no', 'n', 'false', '0']);

/** Builds and downloads the .xlsx template. */
export async function downloadItemImportTemplate() {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet('Items');
  sheet.columns = ITEM_IMPORT_HEADERS.map((header) => ({ header, key: header, width: 18 }));
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    Name: 'A4 Paper',
    SKU: 'PAPER-001',
    Category: 'Stationery',
    Subcategory: 'Paper',
    Unit: 'Box',
    'Unit Symbol': 'box',
    Variants: 'A4, A3',
    Description: '5 reams per box',
    'Cost Price': 120,
    'Selling Price': 150,
    'Reorder Level': 10,
    'Max Stock': 100,
    Perishable: 'No',
    Status: 'Active',
  });

  const notes = workbook.addWorksheet('Read Me');
  notes.columns = [{ header: '', key: 'note', width: 110 }];
  [
    'Replace the example row on the "Items" sheet with your items, one per row.',
    'Required: Name, SKU, Category and Unit. Everything else is optional.',
    'Category, Subcategory and Unit are matched by name (capital letters do not matter). Any that do not exist yet are created for you.',
    'A subcategory belongs to the category on its row.',
    "Variants: list the item's variants in one cell, separated by commas (for example Small, Medium, Large). Leave it blank for an item without variants.",
    'Unit Symbol is only used when the unit has to be created. It defaults to the start of the unit name (up to 10 characters).',
    'A SKU that already exists is skipped, so nothing is changed or duplicated.',
    'Prices and levels are plain numbers with up to 4 decimal places. Max Stock cannot be below Reorder Level.',
    'Perishable: Yes or No (default No). Status: Active or Inactive (default Active).',
    'Opening stock is not imported here. Add it afterwards with Stock In.',
  ].forEach((note) => notes.addRow([note]));

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'inventory-items-import-template.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Reads a filled-in template and checks every row against what the company already has, without
 *  creating anything. Categories, subcategories and units that don't exist are not errors: they are
 *  listed on the row as things the import will create. */
export async function parseItemImportFile(
  file: File,
  lookups: ItemImportLookups,
): Promise<ParsedItemRow[]> {
  const ExcelJSModule = (await import('exceljs')).default;
  const workbook = new ExcelJSModule.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet: ExcelJS.Worksheet | undefined =
    workbook.getWorksheet('Items') ?? workbook.worksheets[0];
  if (!sheet) throw new Error('No sheet found');

  const columns = headerIndex(sheet);
  for (const required of ['Name', 'SKU', 'Category', 'Unit']) {
    if (!columns.has(required)) throw new Error(`Missing the "${required}" column`);
  }

  const existingSkus = new Set(lookups.skus.map(norm));
  const categoryByName = new Map(lookups.categories.map((c) => [norm(c.name), c]));
  const subcategoryKeys = new Map(
    lookups.subcategories.map((s) => [`${s.categoryId}|${norm(s.name)}`, s]),
  );
  const unitByName = new Map(lookups.units.map((u) => [norm(u.name), u]));
  // Parents an earlier row in this file will already have created.
  const newCategories = new Set<string>();
  const newSubcategories = new Set<string>();
  const newUnits = new Set<string>();
  const seenSkus = new Set<string>();

  const rows: ParsedItemRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const text = (header: string) => cellText(row, columns, header);
    const name = text('Name');
    const sku = text('SKU');
    const category = text('Category');
    const subcategory = text('Subcategory');
    const unit = text('Unit');
    if (!name && !sku && !category && !unit) return;

    const errors: string[] = [];
    const creates: string[] = [];

    if (!name) errors.push('Name is required');
    else if (name.length > 150) errors.push('Name is longer than 150 characters');
    if (!sku) errors.push('SKU is required');
    else if (sku.length > 100) errors.push('SKU is longer than 100 characters');
    if (!category) errors.push('Category is required');
    if (!unit) errors.push('Unit is required');
    const unitSymbol = text('Unit Symbol');
    if (unitSymbol.length > 10) errors.push('Unit symbol is longer than 10 characters');

    // Comma-separated, each name once (ignoring case), the first spelling kept.
    const variants: string[] = [];
    for (const name of text('Variants').split(',')) {
      const trimmed = name.trim();
      if (!trimmed || variants.some((v) => norm(v) === norm(trimmed))) continue;
      if (trimmed.length > 100)
        errors.push(`Variant "${trimmed.slice(0, 20)}..." is longer than 100 characters`);
      else variants.push(trimmed);
    }
    if (variants.length > 50) errors.push('More than 50 variants on one item');

    const number = (header: string) => {
      const value = text(header);
      if (!value) return undefined;
      if (!DECIMAL.test(value)) {
        errors.push(`${header} must be a number, 0 or more, with up to 4 decimals`);
        return undefined;
      }
      return value;
    };
    const costPrice = number('Cost Price');
    const sellingPrice = number('Selling Price');
    const reorderLevel = number('Reorder Level');
    const maxStock = number('Max Stock');
    if (reorderLevel && maxStock && Number(maxStock) < Number(reorderLevel))
      errors.push('Max Stock is below the Reorder Level');

    const perishableText = norm(text('Perishable'));
    let isPerishable = false;
    if (perishableText && YES.has(perishableText)) isPerishable = true;
    else if (perishableText && !NO.has(perishableText)) errors.push('Perishable must be Yes or No');

    const statusText = norm(text('Status'));
    let status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE';
    if (statusText === 'inactive') status = 'INACTIVE';
    else if (statusText && statusText !== 'active')
      errors.push('Status must be Active or Inactive');

    // What the import will create, and what it can't use.
    const existingCategory = category ? categoryByName.get(norm(category)) : undefined;
    if (category) {
      if (existingCategory) {
        if (existingCategory.status !== 'ACTIVE')
          errors.push(`Category "${existingCategory.name}" is inactive`);
      } else if (!newCategories.has(norm(category))) creates.push(`Category "${category}"`);
    }
    if (category && subcategory) {
      const existing = existingCategory
        ? subcategoryKeys.get(`${existingCategory.id}|${norm(subcategory)}`)
        : undefined;
      const key = `${norm(category)}|${norm(subcategory)}`;
      if (existing) {
        if (existing.status !== 'ACTIVE') errors.push(`Subcategory "${existing.name}" is inactive`);
      } else if (!newSubcategories.has(key)) creates.push(`Subcategory "${subcategory}"`);
    }
    const existingUnit = unit ? unitByName.get(norm(unit)) : undefined;
    if (unit) {
      if (existingUnit) {
        if (existingUnit.status !== 'ACTIVE')
          errors.push(`Unit "${existingUnit.name}" is inactive`);
      } else if (!newUnits.has(norm(unit))) creates.push(`Unit "${unit}"`);
    }

    let rowStatus: ItemImportRowStatus = 'new';
    if (sku) {
      const skuKey = norm(sku);
      if (existingSkus.has(skuKey)) rowStatus = 'existing';
      else if (seenSkus.has(skuKey))
        errors.push(`SKU "${sku}" appears more than once in this file`);
      seenSkus.add(skuKey);
    }
    if (errors.length > 0) rowStatus = 'invalid';

    // Only a row that will actually be imported makes its category, subcategory or unit new.
    if (rowStatus === 'new') {
      if (category) newCategories.add(norm(category));
      if (category && subcategory) newSubcategories.add(`${norm(category)}|${norm(subcategory)}`);
      if (unit) newUnits.add(norm(unit));
    }

    rows.push({
      rowNumber,
      status: rowStatus,
      errors,
      creates: rowStatus === 'new' ? creates : [],
      payload: {
        name,
        sku,
        category,
        subcategory: subcategory || undefined,
        unit,
        unitSymbol: unitSymbol || undefined,
        variants: variants.length > 0 ? variants : undefined,
        description: text('Description') || undefined,
        costPrice,
        sellingPrice,
        reorderLevel,
        maxStock,
        isPerishable,
        status,
      },
    });
  });
  return rows;
}
