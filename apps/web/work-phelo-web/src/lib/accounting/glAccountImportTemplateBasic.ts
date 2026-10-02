import type { AccountClassification, AccountGroup, GLAccount } from '@/types/accounting';
import {
  BASIC_ACCOUNT_IMPORT_HEADERS,
  CATEGORY_LABEL_BY_VALUE,
} from '@/lib/accounting/glAccountImportShared';

/** Builds and downloads the compact, single-sheet .xlsx template. Every row is an account; the
 *  classification/parent account it belongs to only need a name the first time that code shows
 *  up in the file — repeat rows can just reuse the code. A second, unparsed sheet lists existing
 *  codes for reference so users don't have to go look them up elsewhere. */
export async function downloadGLAccountImportTemplateBasic(
  classifications: AccountClassification[],
  groups: AccountGroup[],
  existingAccounts: GLAccount[] = [],
) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  const accountsSheet = workbook.addWorksheet('Accounts');
  accountsSheet.columns = BASIC_ACCOUNT_IMPORT_HEADERS.map((header) => ({
    header,
    key: header,
    width: 24,
  }));
  accountsSheet.getRow(1).font = { bold: true };
  accountsSheet.addRow({
    'Account Code': '1101',
    'Account Name': 'Ecobank',
    'Account Type': 'Asset',
    'Classification Code': classifications[0]?.code ?? 'CASH',
    'Classification Name': classifications[0] ? '' : 'Cash and Bank',
    'Parent Account Code': groups[0]?.code ?? '',
    'Parent Account Name': groups[0] ? '' : '',
    'Cash Flow Category': '',
    Description: '',
  });

  if (classifications.length > 0 || groups.length > 0 || existingAccounts.length > 0) {
    const reference = workbook.addWorksheet('Existing Codes (reference only)');
    reference.columns = [
      { header: 'Type', key: 'type', width: 16 },
      { header: 'Code', key: 'code', width: 20 },
      { header: 'Name', key: 'name', width: 28 },
      { header: 'Account Type', key: 'category', width: 16 },
    ];
    reference.getRow(1).font = { bold: true };
    for (const classification of classifications) {
      reference.addRow({
        type: 'Classification',
        code: classification.code,
        name: classification.name,
        category: CATEGORY_LABEL_BY_VALUE[classification.category] ?? classification.category,
      });
    }
    for (const group of groups) {
      reference.addRow({
        type: 'Parent Account',
        code: group.code,
        name: group.name,
        category: CATEGORY_LABEL_BY_VALUE[group.classification.category] ?? '',
      });
    }
    for (const account of existingAccounts) {
      reference.addRow({
        type: 'Account',
        code: account.code,
        name: account.name,
        category: CATEGORY_LABEL_BY_VALUE[account.category] ?? account.category,
      });
    }
  }

  const notes = workbook.addWorksheet('Read Me');
  notes.columns = [{ header: '', key: 'note', width: 100 }];
  [
    'One row per account. Classification Code and Parent Account Code can point at an existing code (see the reference sheet) or a brand new one.',
    'The first time a new Classification Code or Parent Account Code appears in the file, fill in its matching Name column too. On later rows reusing the same code, you can leave the Name column blank.',
    'If you do repeat a Name on a later row, it must match what you used the first time — otherwise the import will flag it.',
    'Parent Account Code is optional — leave it blank if the account sits directly under its classification.',
    'Account Type must be one of: Asset, Liability, Equity, Revenue, Expense.',
    "A new parent account's classification must match the account type of the accounts filed under it.",
    'Cash Flow Category is optional and must be one of: Operating, Investing, Financing, Excluded / Non-cash. Leave it blank to inherit from the level above (parent account, then classification, then the default for the account type).',
    'Need to define a classification or parent account with more control (e.g. its own cash flow category) without an account under it yet? Use the Advanced template instead.',
  ].forEach((note) => notes.addRow([note]));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'chart-of-accounts-import-template-basic.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
