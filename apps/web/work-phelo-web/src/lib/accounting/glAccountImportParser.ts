import type ExcelJS from 'exceljs';
import type {
  AccountClassification,
  AccountGroup,
  GLAccount,
  GLAccountCategory,
} from '@/types/accounting';
import { CATEGORY_VALUE_BY_LABEL } from '@/lib/accounting/glAccountImportShared';

export type ImportRowStatus = 'existing' | 'new' | 'invalid';

export interface ParsedClassificationRow {
  rowNumber: number;
  code: string;
  name: string;
  categoryLabel: string;
  category?: GLAccountCategory;
  status: ImportRowStatus;
  errors: string[];
}

export interface ParsedGroupRow {
  rowNumber: number;
  code: string;
  name: string;
  classificationCode: string;
  status: ImportRowStatus;
  errors: string[];
}

export interface ParsedGLAccountRow {
  rowNumber: number;
  code: string;
  name: string;
  categoryLabel: string;
  category?: GLAccountCategory;
  classificationCode: string;
  parentAccountCode: string;
  description: string;
  status: ImportRowStatus;
  errors: string[];
}

export interface GLAccountImportResult {
  classifications: ParsedClassificationRow[];
  groups: ParsedGroupRow[];
  accounts: ParsedGLAccountRow[];
}

function cellText(
  row: ExcelJS.Row,
  columnIndexByHeader: Map<string, number>,
  header: string,
): string {
  const index = columnIndexByHeader.get(header);
  if (!index) return '';
  const value = row.getCell(index).value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in value) {
    return String((value as { text: unknown }).text ?? '').trim();
  }
  if (typeof value === 'object' && 'result' in value) {
    return String((value as { result: unknown }).result ?? '').trim();
  }
  return String(value).trim();
}

function headerIndex(sheet: ExcelJS.Worksheet): Map<string, number> {
  const map = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const text = String(cell.value ?? '').trim();
    if (text) map.set(text, colNumber);
  });
  return map;
}

/** Reads a filled-in template and validates every row against the live classification/group/
 *  account lookups plus any new classifications/parent accounts defined earlier in the same file,
 *  without creating anything yet. */
export async function parseGLAccountImportFile(
  file: File,
  options: {
    classifications: AccountClassification[];
    groups: AccountGroup[];
    existingAccounts: GLAccount[];
  },
): Promise<GLAccountImportResult> {
  const ExcelJSModule = (await import('exceljs')).default;
  const workbook = new ExcelJSModule.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const existingClassificationByCode = new Map(
    options.classifications.map((c) => [c.code.trim().toLowerCase(), c]),
  );
  const existingGroupByCode = new Map(options.groups.map((g) => [g.code.trim().toLowerCase(), g]));
  const existingAccountCodes = new Set(
    options.existingAccounts.map((a) => a.code.trim().toLowerCase()),
  );

  // --- Classifications sheet ---
  const classificationRows: ParsedClassificationRow[] = [];
  const newClassificationByCode = new Map<string, GLAccountCategory>();
  const classificationSheet = workbook.getWorksheet('Classifications');
  if (classificationSheet) {
    const columnIndexByHeader = headerIndex(classificationSheet);
    const seenCodes = new Set<string>();

    classificationSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const code = cellText(row, columnIndexByHeader, 'Classification Code');
      const name = cellText(row, columnIndexByHeader, 'Classification Name');
      const categoryLabel = cellText(row, columnIndexByHeader, 'Account Type');
      if (!code && !name && !categoryLabel) return;

      const codeLower = code.trim().toLowerCase();
      const errors: string[] = [];
      let status: ImportRowStatus = 'new';
      let category: GLAccountCategory | undefined;

      if (code && existingClassificationByCode.has(codeLower)) {
        status = 'existing';
      } else {
        if (!code) errors.push('Classification code is required');
        else if (seenCodes.has(codeLower))
          errors.push(`Duplicate classification code "${code}" in this file`);
        if (!name) errors.push('Classification name is required');
        category = CATEGORY_VALUE_BY_LABEL[categoryLabel.trim().toLowerCase()];
        if (!categoryLabel) errors.push('Account type is required');
        else if (!category) errors.push(`Unknown account type "${categoryLabel}"`);
        status = errors.length === 0 ? 'new' : 'invalid';
      }

      if (code) seenCodes.add(codeLower);
      if (status === 'new' && category) newClassificationByCode.set(codeLower, category);

      classificationRows.push({ rowNumber, code, name, categoryLabel, category, status, errors });
    });
  }

  const resolveClassificationCategory = (code: string): GLAccountCategory | undefined => {
    const lower = code.trim().toLowerCase();
    return existingClassificationByCode.get(lower)?.category ?? newClassificationByCode.get(lower);
  };
  const classificationCodeIsKnown = (code: string): boolean => {
    const lower = code.trim().toLowerCase();
    return existingClassificationByCode.has(lower) || newClassificationByCode.has(lower);
  };

  // --- Parent Accounts sheet ---
  const groupRows: ParsedGroupRow[] = [];
  const newGroupCodes = new Set<string>();
  const groupSheet = workbook.getWorksheet('Parent Accounts');
  if (groupSheet) {
    const columnIndexByHeader = headerIndex(groupSheet);
    const seenCodes = new Set<string>();

    groupSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const code = cellText(row, columnIndexByHeader, 'Parent Account Code');
      const name = cellText(row, columnIndexByHeader, 'Parent Account Name');
      const classificationCode = cellText(row, columnIndexByHeader, 'Classification Code');
      if (!code && !name && !classificationCode) return;

      const codeLower = code.trim().toLowerCase();
      const errors: string[] = [];
      let status: ImportRowStatus;

      if (code && existingGroupByCode.has(codeLower)) {
        status = 'existing';
      } else {
        if (!code) errors.push('Parent account code is required');
        else if (seenCodes.has(codeLower))
          errors.push(`Duplicate parent account code "${code}" in this file`);
        if (!name) errors.push('Parent account name is required');
        if (!classificationCode) errors.push('Classification code is required');
        else if (!classificationCodeIsKnown(classificationCode)) {
          errors.push(`Unknown classification code "${classificationCode}"`);
        }
        status = errors.length === 0 ? 'new' : 'invalid';
      }

      if (code) seenCodes.add(codeLower);
      if (status === 'new') newGroupCodes.add(codeLower);

      groupRows.push({ rowNumber, code, name, classificationCode, status, errors });
    });
  }

  const groupCodeIsKnown = (code: string): boolean => {
    const lower = code.trim().toLowerCase();
    return existingGroupByCode.has(lower) || newGroupCodes.has(lower);
  };
  const groupClassificationCode = (code: string): string | undefined => {
    const lower = code.trim().toLowerCase();
    return (
      existingGroupByCode.get(lower)?.classification.code ??
      groupRows.find((g) => g.code.trim().toLowerCase() === lower)?.classificationCode
    );
  };

  // --- Accounts sheet ---
  const accountRows: ParsedGLAccountRow[] = [];
  const accountSheet = workbook.getWorksheet('Accounts');
  if (accountSheet) {
    const columnIndexByHeader = headerIndex(accountSheet);
    const seenCodes = new Set<string>();

    accountSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const code = cellText(row, columnIndexByHeader, 'Account Code');
      const name = cellText(row, columnIndexByHeader, 'Account Name');
      const categoryLabel = cellText(row, columnIndexByHeader, 'Account Type');
      const classificationCode = cellText(row, columnIndexByHeader, 'Classification Code');
      const parentAccountCode = cellText(row, columnIndexByHeader, 'Parent Account Code');
      const description = cellText(row, columnIndexByHeader, 'Description');
      if (!code && !name && !categoryLabel && !classificationCode && !parentAccountCode) return;

      const codeLower = code.trim().toLowerCase();
      const errors: string[] = [];

      if (!code) errors.push('Account code is required');
      else if (existingAccountCodes.has(codeLower))
        errors.push(`Account code "${code}" already exists`);
      else if (seenCodes.has(codeLower))
        errors.push(`Duplicate account code "${code}" in this file`);

      if (!name) errors.push('Account name is required');

      const category = CATEGORY_VALUE_BY_LABEL[categoryLabel.trim().toLowerCase()];
      if (!categoryLabel) errors.push('Account type is required');
      else if (!category) errors.push(`Unknown account type "${categoryLabel}"`);

      if (!classificationCode) {
        errors.push('Classification code is required');
      } else if (!classificationCodeIsKnown(classificationCode)) {
        errors.push(`Unknown classification code "${classificationCode}"`);
      } else {
        const classificationCategory = resolveClassificationCategory(classificationCode);
        if (category && classificationCategory && classificationCategory !== category) {
          errors.push(
            `Classification "${classificationCode}" is ${classificationCategory}, not ${category}`,
          );
        }
      }

      if (parentAccountCode) {
        if (!groupCodeIsKnown(parentAccountCode)) {
          errors.push(`Unknown parent account code "${parentAccountCode}"`);
        } else {
          const parentClassificationCode = groupClassificationCode(parentAccountCode);
          if (
            parentClassificationCode &&
            classificationCode &&
            parentClassificationCode.trim().toLowerCase() !==
              classificationCode.trim().toLowerCase()
          ) {
            errors.push(
              `Parent account "${parentAccountCode}" belongs to classification "${parentClassificationCode}", not "${classificationCode}"`,
            );
          }
        }
      }

      if (code) seenCodes.add(codeLower);

      accountRows.push({
        rowNumber,
        code,
        name,
        categoryLabel,
        category,
        classificationCode,
        parentAccountCode,
        description,
        status: errors.length === 0 ? 'new' : 'invalid',
        errors,
      });
    });
  }

  return { classifications: classificationRows, groups: groupRows, accounts: accountRows };
}
