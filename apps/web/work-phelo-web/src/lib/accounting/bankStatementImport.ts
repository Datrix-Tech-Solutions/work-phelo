import type ExcelJS from 'exceljs';
import { cellText, headerIndex } from '@/lib/accounting/glAccountImportParser';
import type { BankStatementRow } from '@/store/bankStatementDraft.store';

export const BANK_STATEMENT_IMPORT_HEADERS = [
  'Date',
  'Description',
  'Reference',
  'Debit',
  'Credit',
  'Balance',
] as const;

const MAX_ROWS = 5000;

export interface ParsedBankStatement {
  rows: BankStatementRow[];
  /** Problems that stop the statement being used, each naming its sheet row. */
  errors: string[];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Reads a date cell: a real Excel date, ISO text (2026-08-05) or day-first text (05/08/2026). */
function parseDateCell(row: ExcelJS.Row, columns: Map<string, number>): string | null {
  const index = columns.get('Date');
  if (!index) return null;
  const value = row.getCell(index).value;
  if (value instanceof Date) {
    // Excel dates come back as UTC midnight of the calendar day shown in the sheet.
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }
  const text = cellText(row, columns, 'Date');
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  const dayFirst = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  const [year, month, day] = iso
    ? [iso[1], iso[2], iso[3]]
    : dayFirst
      ? [dayFirst[3], dayFirst[2], dayFirst[1]]
      : [];
  if (!year) return null;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const valid =
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day);
  return valid ? `${year}-${pad(Number(month))}-${pad(Number(day))}` : null;
}

function parseAmountCell(raw: string, label: string, errors: string[], prefix: string) {
  if (!raw) return undefined;
  const value = Number(raw.replace(/[,\s]/g, ''));
  if (!Number.isFinite(value)) {
    errors.push(`${prefix}: ${label} "${raw}" is not a number`);
    return undefined;
  }
  if (value < 0) {
    errors.push(`${prefix}: ${label} cannot be negative`);
    return undefined;
  }
  return Math.round(value * 100) / 100;
}

/** Reads the first sheet of a bank statement workbook in the browser. Nothing is uploaded or
 *  stored: the values are used for the reconcile page and the file is forgotten. Rows dated
 *  outside the period are reported rather than dropped. */
export async function parseBankStatementFile(
  file: File,
  period: { fromDate: string; toDate: string },
): Promise<ParsedBankStatement> {
  const ExcelJSModule = (await import('exceljs')).default;
  const workbook = new ExcelJSModule.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const sheet = workbook.getWorksheet('Bank Statement') ?? workbook.worksheets[0];
  if (!sheet) throw new Error('This file has no sheets');

  const columns = headerIndex(sheet);
  if (!columns.has('Date') || !columns.has('Debit') || !columns.has('Credit')) {
    throw new Error('Missing columns — use the template (Date, Debit, Credit)');
  }

  const rows: BankStatementRow[] = [];
  const errors: string[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const description = cellText(row, columns, 'Description');
    const reference = cellText(row, columns, 'Reference');
    // As the bank prints them: a debit is money out of the account, a credit is money in.
    const outRaw = cellText(row, columns, 'Debit');
    const inRaw = cellText(row, columns, 'Credit');
    const dateRaw = cellText(row, columns, 'Date');
    const balanceRaw = cellText(row, columns, 'Balance');
    if (!description && !reference && !inRaw && !outRaw && !dateRaw && !balanceRaw) return;

    const prefix = `Row ${rowNumber}`;
    const rowErrors: string[] = [];
    const date = parseDateCell(row, columns);
    if (!date) rowErrors.push(`${prefix}: date "${dateRaw}" is not recognised (use DD/MM/YYYY)`);
    else if (date < period.fromDate || date > period.toDate) {
      rowErrors.push(`${prefix}: ${date} is outside the reconciliation period`);
    }
    const moneyIn = parseAmountCell(inRaw, 'Credit', rowErrors, prefix);
    const moneyOut = parseAmountCell(outRaw, 'Debit', rowErrors, prefix);
    if (rowErrors.length === 0) {
      if (moneyIn && moneyOut)
        rowErrors.push(`${prefix}: a row cannot have both a debit and a credit`);
      else if (!moneyIn && !moneyOut) rowErrors.push(`${prefix}: needs a debit or a credit`);
    }
    const balance = balanceRaw ? Number(balanceRaw.replace(/[,\s]/g, '')) : undefined;
    if (balance !== undefined && !Number.isFinite(balance)) {
      rowErrors.push(`${prefix}: balance "${balanceRaw}" is not a number`);
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }
    rows.push({
      id: `bank-${rowNumber}`,
      date: date!,
      reference,
      description,
      moneyIn: moneyIn ?? 0,
      moneyOut: moneyOut ?? 0,
      balance,
    });
  });

  if (rows.length === 0 && errors.length === 0) errors.push('No statement rows found in this file');
  if (rows.length + errors.length > MAX_ROWS) {
    return { rows: [], errors: [`A statement can have at most ${MAX_ROWS} rows`] };
  }
  return { rows, errors };
}

export async function downloadBankStatementTemplate() {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet('Bank Statement');
  sheet.columns = BANK_STATEMENT_IMPORT_HEADERS.map((header) => ({
    header,
    key: header,
    width: header === 'Description' ? 40 : 18,
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    Date: '05/08/2026',
    Description: 'Example deposit',
    Reference: 'DEP-001',
    Debit: '',
    Credit: 1000,
    Balance: 2000,
  });
  sheet.addRow({
    Date: '09/08/2026',
    Description: 'Example charge',
    Reference: 'CHG-001',
    Debit: 25,
    Credit: '',
    Balance: 1975,
  });

  const notes = workbook.addWorksheet('Read Me');
  notes.columns = [{ header: '', key: 'note', width: 100 }];
  [
    'One row per bank statement line. Only the first sheet is read, and the file is not kept.',
    'Date: DD/MM/YYYY or YYYY-MM-DD. Every date must fall inside the reconciliation period.',
    'Use the columns as your bank prints them: Debit is money out of the account, Credit is money in. Each row needs one or the other, not both, as a positive number.',
    'Description, Reference and Balance are optional.',
  ].forEach((note) => notes.addRow([note]));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bank-statement-template.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
