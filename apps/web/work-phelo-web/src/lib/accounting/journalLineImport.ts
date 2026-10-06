import { cellText, headerIndex } from '@/lib/accounting/glAccountImportParser';
import { CATEGORY_LABEL_BY_VALUE } from '@/lib/accounting/glAccountImportShared';
import type { GLAccount, GLAccountCategory } from '@/types/accounting';

export const JOURNAL_LINE_IMPORT_HEADERS = [
  'Account Code',
  'Account Name',
  'Description',
  'Debit',
  'Credit',
] as const;

export interface ParsedJournalLineRow {
  rowNumber: number;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number | '';
  credit: number | '';
  /** Problems with the row itself (amounts), independent of account matching. */
  errors: string[];
}

/** Case-, whitespace- and padding-insensitive form used for every account comparison. */
export const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

/** One key per distinct account reference in the file, so a value that appears on many rows is
 *  resolved once and applied to all of them. */
export const accountRefKey = (row: Pick<ParsedJournalLineRow, 'accountCode' | 'accountName'>) =>
  `${normalizeText(row.accountCode)}|${normalizeText(row.accountName)}`;

function parseAmount(raw: string, label: string, errors: string[]): number | '' {
  if (!raw) return '';
  const value = Number(raw.replace(/[,\s]/g, ''));
  if (!Number.isFinite(value)) {
    errors.push(`${label} "${raw}" is not a number`);
    return '';
  }
  if (value < 0) {
    errors.push(`${label} cannot be negative`);
    return '';
  }
  return value === 0 ? '' : Math.round(value * 100) / 100;
}

export async function parseJournalLineImportFile(file: File): Promise<ParsedJournalLineRow[]> {
  const ExcelJSModule = (await import('exceljs')).default;
  const workbook = new ExcelJSModule.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const sheet = workbook.getWorksheet('Journal Lines') ?? workbook.worksheets[0];
  if (!sheet) throw new Error('This file has no sheets');

  const columns = headerIndex(sheet);
  const hasAccountColumn = columns.has('Account Code') || columns.has('Account Name');
  if (!hasAccountColumn || !columns.has('Debit') || !columns.has('Credit')) {
    throw new Error('Missing columns — use the template (Account Code/Name, Debit, Credit)');
  }

  const rows: ParsedJournalLineRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const accountCode = cellText(row, columns, 'Account Code');
    const accountName = cellText(row, columns, 'Account Name');
    const description = cellText(row, columns, 'Description');
    const debitRaw = cellText(row, columns, 'Debit');
    const creditRaw = cellText(row, columns, 'Credit');
    if (!accountCode && !accountName && !description && !debitRaw && !creditRaw) return;

    const errors: string[] = [];
    if (!accountCode && !accountName) errors.push('Account code or name is required');
    const debit = parseAmount(debitRaw, 'Debit', errors);
    const credit = parseAmount(creditRaw, 'Credit', errors);
    if (errors.length === 0) {
      if (debit !== '' && credit !== '')
        errors.push('A line cannot have both a debit and a credit');
      else if (debit === '' && credit === '') errors.push('A line needs a debit or a credit');
    }

    rows.push({ rowNumber, accountCode, accountName, description, debit, credit, errors });
  });
  return rows;
}

export type AccountMatch =
  | { status: 'matched'; account: GLAccount }
  | { status: 'ambiguous'; candidates: GLAccount[] }
  | { status: 'unavailable'; account: GLAccount; reason: string }
  | { status: 'unresolved' };

/** Why an account can't be posted to on this entry, or null if it can. */
export function postingBlocker(
  account: GLAccount,
  allowedClasses?: GLAccountCategory[],
): string | null {
  if (account.status !== 'ACTIVE') return 'is inactive';
  if (!account.allowPosting) return 'does not allow posting';
  if (allowedClasses && !allowedClasses.includes(account.category)) {
    return `is a ${CATEGORY_LABEL_BY_VALUE[account.category] ?? account.category} account, which isn't allowed on this entry`;
  }
  return null;
}

/** Matches by code first, then by normalized name. Accounts that exist but can't be posted to
 *  are reported as `unavailable` rather than silently skipped, so the user sees why. */
export function matchAccount(
  accounts: GLAccount[],
  ref: { accountCode: string; accountName: string },
  allowedClasses?: GLAccountCategory[],
): AccountMatch {
  const code = normalizeText(ref.accountCode);
  const name = normalizeText(ref.accountName);

  let found = code ? accounts.filter((a) => normalizeText(a.code) === code) : [];
  if (found.length === 0 && name) {
    found = accounts.filter((a) => normalizeText(a.name) === name);
  }

  const usable = found.filter((a) => !postingBlocker(a, allowedClasses));
  if (usable.length === 1) return { status: 'matched', account: usable[0] };
  if (usable.length > 1) return { status: 'ambiguous', candidates: usable };
  if (found.length > 0) {
    return {
      status: 'unavailable',
      account: found[0],
      reason: postingBlocker(found[0], allowedClasses)!,
    };
  }
  return { status: 'unresolved' };
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = temp;
    }
  }
  return prev[b.length];
}

/** Closest usable account (small typos only), for a one-click "did you mean". */
export function suggestAccount(
  usableAccounts: GLAccount[],
  ref: { accountCode: string; accountName: string },
): GLAccount | undefined {
  const target = normalizeText(ref.accountName || ref.accountCode);
  if (!target) return undefined;
  const threshold = Math.max(1, Math.min(3, Math.floor(target.length / 4)));
  let best: { account: GLAccount; distance: number } | undefined;
  for (const account of usableAccounts) {
    const distance = Math.min(
      editDistance(target, normalizeText(account.name)),
      editDistance(target, normalizeText(account.code)),
    );
    if (distance <= threshold && (!best || distance < best.distance)) {
      best = { account, distance };
    }
  }
  return best?.account;
}

export async function downloadJournalLineImportTemplate(usableAccounts: GLAccount[]) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet('Journal Lines');
  sheet.columns = JOURNAL_LINE_IMPORT_HEADERS.map((header) => ({
    header,
    key: header,
    width: header === 'Description' ? 36 : 22,
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    'Account Code': usableAccounts[0]?.code ?? '1101',
    'Account Name': '',
    Description: 'Example debit line',
    Debit: 1000,
    Credit: '',
  });
  sheet.addRow({
    'Account Code': usableAccounts[1]?.code ?? '4001',
    'Account Name': '',
    Description: 'Example credit line',
    Debit: '',
    Credit: 1000,
  });

  const reference = workbook.addWorksheet('Accounts (reference only)');
  reference.columns = [
    { header: 'Code', key: 'code', width: 16 },
    { header: 'Name', key: 'name', width: 36 },
    { header: 'Account Type', key: 'category', width: 16 },
  ];
  reference.getRow(1).font = { bold: true };
  for (const account of usableAccounts) {
    reference.addRow({
      code: account.code,
      name: account.name,
      category: CATEGORY_LABEL_BY_VALUE[account.category] ?? account.category,
    });
  }

  const notes = workbook.addWorksheet('Read Me');
  notes.columns = [{ header: '', key: 'note', width: 100 }];
  [
    'One row per journal line. Only the first sheet is read.',
    'Fill in Account Code or Account Name (or both). The code is matched first, then the name; capitalisation and extra spaces are ignored.',
    'Each line needs either a Debit or a Credit, not both.',
    'Accounts that cannot be matched are resolved in the preview before anything is added to the entry.',
  ].forEach((note) => notes.addRow([note]));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'journal-lines-import-template.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
