import { cellText, headerIndex } from '@/lib/accounting/glAccountImportParser';
import type { EntityType, SubledgerAccount } from '@/types/accounting';

export const ENTITY_IMPORT_HEADERS = [
  'Entity Type',
  'Entity Name',
  'Contact Person',
  'Phone',
  'Address',
] as const;

export interface ParsedEntityRow {
  rowNumber: number;
  typeLabel: string;
  /** Upper-cased tenant entity type name, as the create endpoint expects it. */
  type?: string;
  /** The type's ID prefix (e.g. "SUP"), used to generate the code after the row is accepted. */
  prefix?: string;
  name: string;
  contactName: string;
  phone: string;
  address: string;
  errors: string[];
}

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

/** Phone numbers are stored as +<country code><digits>. Accepts local numbers with a leading 0
 *  (swapped for the tenant's dial code) and numbers already carrying a + country code. */
export function normalizePhone(raw: string, dialCode: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const digits = trimmed.replace(/[\s\-().]/g, '');
  let result: string;
  if (digits.startsWith('+')) result = digits;
  else if (digits.startsWith('00')) result = `+${digits.slice(2)}`;
  else if (digits.startsWith('0')) result = `${dialCode}${digits.slice(1)}`;
  else result = `${dialCode}${digits}`;
  return /^\+\d{7,15}$/.test(result) ? result : null;
}

export async function parseEntityImportFile(
  file: File,
  options: { entityTypes: EntityType[]; dialCode: string },
): Promise<ParsedEntityRow[]> {
  const ExcelJSModule = (await import('exceljs')).default;
  const workbook = new ExcelJSModule.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const sheet = workbook.getWorksheet('Entities') ?? workbook.worksheets[0];
  if (!sheet) throw new Error('This file has no sheets');

  const columns = headerIndex(sheet);
  if (!columns.has('Entity Type') || !columns.has('Entity Name')) {
    throw new Error('Missing columns — use the template (Entity Type, Entity Name, …)');
  }

  const typeByName = new Map(options.entityTypes.map((t) => [normalize(t.name), t]));

  const rows: ParsedEntityRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const typeLabel = cellText(row, columns, 'Entity Type');
    const name = cellText(row, columns, 'Entity Name');
    const contactName = cellText(row, columns, 'Contact Person');
    const phoneRaw = cellText(row, columns, 'Phone');
    const address = cellText(row, columns, 'Address');
    if (!typeLabel && !name && !contactName && !phoneRaw && !address) return;

    const errors: string[] = [];
    const entityType = typeLabel ? typeByName.get(normalize(typeLabel)) : undefined;
    if (!typeLabel) errors.push('Entity type is required');
    else if (!entityType) errors.push(`Unknown entity type "${typeLabel}"`);
    else if (!entityType.code?.trim()) {
      errors.push(`Entity type "${entityType.name}" has no ID prefix — set one under Types first`);
    }

    if (!name) errors.push('Entity name is required');
    else if (name.length > 160) errors.push('Entity name is too long (max 160 characters)');

    const phone = normalizePhone(phoneRaw, options.dialCode);
    if (phone === null) errors.push(`Phone "${phoneRaw}" is not a valid number`);

    rows.push({
      rowNumber,
      typeLabel,
      type: entityType?.name.trim().toUpperCase(),
      prefix: entityType?.code?.trim() || undefined,
      name,
      contactName,
      phone: phone ?? phoneRaw,
      address,
      errors,
    });
  });
  return rows;
}

/** Hands out the next free `PREFIX-0001` style code per prefix, continuing from the highest
 *  number already used by existing entities and counting up across the batch. */
export function createCodeGenerator(existing: SubledgerAccount[]) {
  const highest = new Map<string, number>();
  const bump = (prefix: string, n: number) =>
    highest.set(prefix, Math.max(highest.get(prefix) ?? 0, n));

  return (prefix: string): string => {
    const key = prefix.toUpperCase();
    if (!highest.has(key)) {
      const pattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`, 'i');
      let max = 0;
      for (const entity of existing) {
        const match = pattern.exec(entity.code);
        if (match) max = Math.max(max, Number(match[1]));
      }
      bump(key, max);
    }
    const next = (highest.get(key) ?? 0) + 1;
    bump(key, next);
    return `${prefix}-${String(next).padStart(4, '0')}`;
  };
}

export async function downloadEntityImportTemplate(entityTypes: EntityType[]) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet('Entities');
  sheet.columns = ENTITY_IMPORT_HEADERS.map((header) => ({
    header,
    key: header,
    width: header === 'Address' ? 36 : 24,
  }));
  sheet.getRow(1).font = { bold: true };
  // Phone is text so a leading 0 or + isn't stripped by the spreadsheet app.
  sheet.getColumn('Phone').numFmt = '@';
  sheet.addRow({
    'Entity Type': entityTypes[0]?.name ?? 'Supplier',
    'Entity Name': 'Entity Company Ltd.',
    'Contact Person': 'Jane Doe',
    Phone: '0241234567',
    Address: '12 Example Street, Accra',
  });

  const reference = workbook.addWorksheet('Entity Types (reference only)');
  reference.columns = [
    { header: 'Entity Type', key: 'name', width: 28 },
    { header: 'ID Prefix', key: 'code', width: 14 },
  ];
  reference.getRow(1).font = { bold: true };
  for (const type of entityTypes) reference.addRow({ name: type.name, code: type.code ?? '' });

  const notes = workbook.addWorksheet('Read Me');
  notes.columns = [{ header: '', key: 'note', width: 100 }];
  [
    'One row per entity. Only the first sheet is read.',
    'Entity Type must be one of the types listed on the reference sheet (capitalisation is ignored).',
    'There is no code column — the Entity ID is generated automatically from the type’s ID prefix when the entity is created.',
    'Phone can be a local number (0241234567) or include a country code (+233241234567).',
    'Contact Person, Phone and Address are optional.',
  ].forEach((note) => notes.addRow([note]));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'entities-import-template.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
