import type ExcelJS from 'exceljs';
import { cellText, headerIndex } from '@/lib/accounting/glAccountImportParser';
import { geocodeForward, hasMapTilerKey } from '@/lib/maptiler';

export { cellText, headerIndex };

/** The CRM lists an import can add to when a sheet names something that does not exist yet. */
export type SettingSlug = 'business-types' | 'source-types' | 'products' | 'decision-makers';

export interface Need {
  slug: SettingSlug;
  name: string;
}

/** Gives the id of a CRM setting by name, once any missing ones have been created. */
export type ResolveSetting = (slug: SettingSlug, name: string) => string;

export interface ImportRecord<P> {
  /** The sheet row the record starts on. */
  rowNumber: number;
  name: string;
  contact: string;
  /** What the preview shows for the record's products or services. */
  items: string;
  location: string;
  /** Settings this record names that do not exist yet; they are created when the import runs. */
  needs: Need[];
  /** Present once the record passed every check; builds the payload after the needs exist. */
  build?: (resolve: ResolveSetting) => P;
  errors: string[];
  /** Worth knowing, but they do not stop the record being imported. */
  warnings: string[];
}

export const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

/** Finds a CRM setting or stage by the name typed in the sheet, ignoring case and spacing. */
export function byName<T extends { id: string; name: string }>(items: T[], label: string) {
  const wanted = normalize(label);
  return items.find((item) => normalize(item.name) === wanted);
}

/** A date as text: YYYY-MM-DD or DD/MM/YYYY. `null` is blank, `'invalid'` is unreadable. */
export function parseDateText(text: string): string | null | 'invalid' {
  const value = text.trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (local) {
    const [, d, m, y] = local;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return 'invalid';
}

/** A number as text. `null` is blank, `'invalid'` is not a non-negative number. */
export function parseNumberText(text: string): number | null | 'invalid' {
  const value = text.replace(/,/g, '').trim();
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 'invalid';
}

/** The cell as text; a real date becomes YYYY-MM-DD so it can be edited as one. */
export function cellValueText(
  row: ExcelJS.Row,
  columns: Map<string, number>,
  header: string,
): string {
  const index = columns.get(header);
  const value = index ? row.getCell(index).value : null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return cellText(row, columns, header);
}

export async function loadSheet(file: File, sheetName: string) {
  const ExcelJSModule = (await import('exceljs')).default;
  const workbook = new ExcelJSModule.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.getWorksheet(sheetName) ?? workbook.worksheets[0];
  if (!sheet) throw new Error('This file has no sheets');
  return sheet;
}

export interface Located {
  label: string;
  latitude: number;
  longitude: number;
}

/** The place as typed, then shorter forms of it, each also tried with the country added. */
function lookupCandidates(place: string, country: string | null): string[] {
  const parts = place
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const forms = parts.map((_, i) => parts.slice(i).join(', '));
  return [
    ...new Set(
      forms.flatMap((form) =>
        country && !normalize(form).includes(normalize(country))
          ? [form, `${form}, ${country}`]
          : [form],
      ),
    ),
  ];
}

/**
 * Turns the place names in a sheet into coordinates, one lookup per distinct place. A long address
 * that the map cannot match is retried with its leading parts dropped ("Plot 4, Osu, Accra" →
 * "Osu, Accra" → "Accra"). A place that still cannot be found maps to `null`, so its row can say
 * so instead of the whole import failing.
 */
export async function locatePlaces(
  places: string[],
  country: string | null,
): Promise<Map<string, Located | null>> {
  const found = new Map<string, Located | null>();
  for (const place of new Set(places.map((p) => p.trim()).filter(Boolean))) {
    let result: Located | null = null;
    if (hasMapTilerKey()) {
      for (const candidate of lookupCandidates(place, country)) {
        try {
          const [best] = await geocodeForward(candidate);
          if (best) {
            result = { label: best.placeName, latitude: best.lat, longitude: best.lng };
            break;
          }
        } catch {
          // Try the next, shorter form.
        }
      }
    }
    found.set(place, result);
  }
  return found;
}

export async function downloadTemplate(options: {
  filename: string;
  sheetName: string;
  headers: readonly string[];
  example: Record<string, string | number>;
  /** Columns holding text only, so a leading 0 or + isn't stripped by the spreadsheet app. */
  textColumns?: string[];
  notes: string[];
}) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet(options.sheetName);
  sheet.columns = options.headers.map((header) => ({ header, key: header, width: 26 }));
  sheet.getRow(1).font = { bold: true };
  for (const column of options.textColumns ?? []) sheet.getColumn(column).numFmt = '@';
  sheet.addRow(options.example);

  const notes = workbook.addWorksheet('Read Me');
  notes.columns = [{ header: '', key: 'note', width: 110 }];
  options.notes.forEach((note) => notes.addRow([note]));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = options.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
