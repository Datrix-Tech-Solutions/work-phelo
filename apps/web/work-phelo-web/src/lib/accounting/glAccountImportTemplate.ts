import type { AccountClassification, AccountGroup } from '@/types/accounting';
import {
  ACCOUNT_IMPORT_HEADERS,
  CATEGORY_LABEL_BY_VALUE,
  CLASSIFICATION_IMPORT_HEADERS,
  GROUP_IMPORT_HEADERS,
} from '@/lib/accounting/glAccountImportShared';

const EXISTING_ROW_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FFF3F4F6' },
};

/** Builds and downloads the .xlsx template used to bulk-create classifications, parent accounts
 *  and accounts in one go. Existing classifications/parent accounts are pre-filled as reference —
 *  rows matching an existing code are skipped on import, so users just append new rows below. */
export async function downloadGLAccountImportTemplate(
  classifications: AccountClassification[],
  groups: AccountGroup[],
) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  const classificationsSheet = workbook.addWorksheet('Classifications');
  classificationsSheet.columns = CLASSIFICATION_IMPORT_HEADERS.map((header) => ({
    header,
    key: header,
    width: 24,
  }));
  classificationsSheet.getRow(1).font = { bold: true };
  for (const classification of classifications) {
    const row = classificationsSheet.addRow({
      'Classification Code': classification.code,
      'Classification Name': classification.name,
      'Account Type': CATEGORY_LABEL_BY_VALUE[classification.category] ?? classification.category,
    });
    row.eachCell((cell) => (cell.fill = EXISTING_ROW_FILL));
  }
  classificationsSheet.addRow({
    'Classification Code': '',
    'Classification Name': '',
    'Account Type': '',
  });

  const groupsSheet = workbook.addWorksheet('Parent Accounts');
  groupsSheet.columns = GROUP_IMPORT_HEADERS.map((header) => ({ header, key: header, width: 24 }));
  groupsSheet.getRow(1).font = { bold: true };
  for (const group of groups) {
    const row = groupsSheet.addRow({
      'Parent Account Code': group.code,
      'Parent Account Name': group.name,
      'Classification Code': group.classification.code,
    });
    row.eachCell((cell) => (cell.fill = EXISTING_ROW_FILL));
  }
  groupsSheet.addRow({
    'Parent Account Code': '',
    'Parent Account Name': '',
    'Classification Code': '',
  });

  const accountsSheet = workbook.addWorksheet('Accounts');
  accountsSheet.columns = ACCOUNT_IMPORT_HEADERS.map((header) => ({
    header,
    key: header,
    width: 24,
  }));
  accountsSheet.getRow(1).font = { bold: true };
  accountsSheet.addRow({
    'Account Code': '1101',
    'Account Name': 'Ecobank',
    'Account Type': 'Asset',
    'Classification Code': classifications[0]?.code ?? '',
    'Parent Account Code': groups[0]?.code ?? '',
    Description: '',
  });

  const notes = workbook.addWorksheet('Read Me');
  notes.columns = [{ header: '', key: 'note', width: 100 }];
  [
    'Grey rows in "Classifications" and "Parent Accounts" already exist — leave them as-is, they are just for reference.',
    'To add a new classification or parent account, add a new row below the grey ones on the matching sheet.',
    'The "Classification Code" and "Parent Account Code" columns on the Accounts sheet can point at either an existing code or a new one you just added.',
    'Account Type must be one of: Asset, Liability, Equity, Revenue, Expense.',
    "A new parent account's classification must match the account type of the accounts filed under it.",
  ].forEach((note) => notes.addRow([note]));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'chart-of-accounts-import-template.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
