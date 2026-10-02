import type ExcelJS from 'exceljs';
import type {
  AccountClassification,
  AccountGroup,
  CashFlowCategory,
  GLAccount,
  GLAccountCategory,
} from '@/types/accounting';
import {
  CASH_FLOW_VALUE_BY_LABEL,
  CATEGORY_VALUE_BY_LABEL,
} from '@/lib/accounting/glAccountImportShared';

export type ImportRowStatus = 'existing' | 'new' | 'invalid';

export interface ParsedClassificationRow {
  rowNumber: number;
  code: string;
  name: string;
  categoryLabel: string;
  category?: GLAccountCategory;
  cashFlowCategoryLabel: string;
  cashFlowCategory?: CashFlowCategory;
  status: ImportRowStatus;
  errors: string[];
}

export interface ParsedGroupRow {
  rowNumber: number;
  code: string;
  name: string;
  classificationCode: string;
  cashFlowCategoryLabel: string;
  cashFlowCategory?: CashFlowCategory;
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
  cashFlowCategoryLabel: string;
  cashFlowCategory?: CashFlowCategory;
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

/** Cash Flow Category is optional everywhere — blank means "inherit from the level above". */
function resolveCashFlowCategory(label: string, errors: string[]): CashFlowCategory | undefined {
  if (!label) return undefined;
  const value = CASH_FLOW_VALUE_BY_LABEL[label.trim().toLowerCase()];
  if (!value) errors.push(`Unknown cash flow category "${label}"`);
  return value;
}

/** Reads a filled-in template and validates every row against the live classification/group/
 *  account lookups plus any new classifications/parent accounts defined earlier in the same file,
 *  without creating anything yet. Dispatches to the Advanced (3-sheet) or Basic (1-sheet) parser
 *  based on which sheets are present, and both converge on the same result shape so the preview
 *  UI never needs to know which template was used. */
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

  const isAdvanced = Boolean(
    workbook.getWorksheet('Classifications') || workbook.getWorksheet('Parent Accounts'),
  );
  if (!isAdvanced && workbook.getWorksheet('Accounts')) {
    return parseBasicGLAccountWorkbook(workbook, options);
  }

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
      const cashFlowCategoryLabel = cellText(row, columnIndexByHeader, 'Cash Flow Category');
      if (!code && !name && !categoryLabel) return;

      const codeLower = code.trim().toLowerCase();
      const errors: string[] = [];
      let status: ImportRowStatus = 'new';
      let category: GLAccountCategory | undefined;
      let cashFlowCategory: CashFlowCategory | undefined;

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
        cashFlowCategory = resolveCashFlowCategory(cashFlowCategoryLabel, errors);
        status = errors.length === 0 ? 'new' : 'invalid';
      }

      if (code) seenCodes.add(codeLower);
      if (status === 'new' && category) newClassificationByCode.set(codeLower, category);

      classificationRows.push({
        rowNumber,
        code,
        name,
        categoryLabel,
        category,
        cashFlowCategoryLabel,
        cashFlowCategory,
        status,
        errors,
      });
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
      const cashFlowCategoryLabel = cellText(row, columnIndexByHeader, 'Cash Flow Category');
      if (!code && !name && !classificationCode) return;

      const codeLower = code.trim().toLowerCase();
      const errors: string[] = [];
      let status: ImportRowStatus;
      let cashFlowCategory: CashFlowCategory | undefined;

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
        cashFlowCategory = resolveCashFlowCategory(cashFlowCategoryLabel, errors);
        status = errors.length === 0 ? 'new' : 'invalid';
      }

      if (code) seenCodes.add(codeLower);
      if (status === 'new') newGroupCodes.add(codeLower);

      groupRows.push({
        rowNumber,
        code,
        name,
        classificationCode,
        cashFlowCategoryLabel,
        cashFlowCategory,
        status,
        errors,
      });
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
      const cashFlowCategoryLabel = cellText(row, columnIndexByHeader, 'Cash Flow Category');
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

      const cashFlowCategory = resolveCashFlowCategory(cashFlowCategoryLabel, errors);

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
        cashFlowCategoryLabel,
        cashFlowCategory,
        status: errors.length === 0 ? 'new' : 'invalid',
        errors,
      });
    });
  }

  return { classifications: classificationRows, groups: groupRows, accounts: accountRows };
}

interface BasicRow {
  rowNumber: number;
  code: string;
  name: string;
  categoryLabel: string;
  classificationCode: string;
  classificationName: string;
  parentAccountCode: string;
  parentAccountName: string;
  cashFlowCategoryLabel: string;
  description: string;
}

/** One row per account; classifications/parent accounts are inferred from the first occurrence
 *  of each code, so this walks the sheet twice — once to collect those definitions, once to
 *  validate every account row against them — then hands back the same three arrays the Advanced
 *  parser produces. */
function parseBasicGLAccountWorkbook(
  workbook: ExcelJS.Workbook,
  options: {
    classifications: AccountClassification[];
    groups: AccountGroup[];
    existingAccounts: GLAccount[];
  },
): GLAccountImportResult {
  const existingClassificationByCode = new Map(
    options.classifications.map((c) => [c.code.trim().toLowerCase(), c]),
  );
  const existingGroupByCode = new Map(options.groups.map((g) => [g.code.trim().toLowerCase(), g]));
  const existingAccountCodes = new Set(
    options.existingAccounts.map((a) => a.code.trim().toLowerCase()),
  );

  const sheet = workbook.getWorksheet('Accounts')!;
  const columnIndexByHeader = headerIndex(sheet);
  const rows: BasicRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const code = cellText(row, columnIndexByHeader, 'Account Code');
    const name = cellText(row, columnIndexByHeader, 'Account Name');
    const categoryLabel = cellText(row, columnIndexByHeader, 'Account Type');
    const classificationCode = cellText(row, columnIndexByHeader, 'Classification Code');
    const classificationName = cellText(row, columnIndexByHeader, 'Classification Name');
    const parentAccountCode = cellText(row, columnIndexByHeader, 'Parent Account Code');
    const parentAccountName = cellText(row, columnIndexByHeader, 'Parent Account Name');
    const cashFlowCategoryLabel = cellText(row, columnIndexByHeader, 'Cash Flow Category');
    const description = cellText(row, columnIndexByHeader, 'Description');
    if (!code && !name && !categoryLabel && !classificationCode && !parentAccountCode) return;
    rows.push({
      rowNumber,
      code,
      name,
      categoryLabel,
      classificationCode,
      classificationName,
      parentAccountCode,
      parentAccountName,
      cashFlowCategoryLabel,
      description,
    });
  });

  // Pass 1: derive classification/parent account definitions from first occurrence, and record
  // conflicts where a later row repeats a code with a different, non-blank name.
  interface ClassificationDef {
    rowNumber: number;
    name: string;
    categoryLabel: string;
    cashFlowCategoryLabel: string;
  }
  interface GroupDef {
    rowNumber: number;
    name: string;
    classificationCode: string;
    cashFlowCategoryLabel: string;
  }
  const classificationDefs = new Map<string, ClassificationDef>();
  const groupDefs = new Map<string, GroupDef>();
  const conflictErrorsByRowNumber = new Map<number, string[]>();
  const addConflict = (rowNumber: number, message: string) => {
    const list = conflictErrorsByRowNumber.get(rowNumber) ?? [];
    list.push(message);
    conflictErrorsByRowNumber.set(rowNumber, list);
  };

  for (const row of rows) {
    if (row.classificationCode) {
      const lower = row.classificationCode.trim().toLowerCase();
      if (!existingClassificationByCode.has(lower)) {
        const existingDef = classificationDefs.get(lower);
        if (!existingDef) {
          classificationDefs.set(lower, {
            rowNumber: row.rowNumber,
            name: row.classificationName,
            categoryLabel: row.categoryLabel,
            cashFlowCategoryLabel: '',
          });
        } else if (row.classificationName && row.classificationName !== existingDef.name) {
          addConflict(
            row.rowNumber,
            `Classification Name "${row.classificationName}" for code "${row.classificationCode}" doesn't match its earlier definition "${existingDef.name}" (row ${existingDef.rowNumber})`,
          );
        }
      }
    }
    if (row.parentAccountCode) {
      const lower = row.parentAccountCode.trim().toLowerCase();
      if (!existingGroupByCode.has(lower)) {
        const existingDef = groupDefs.get(lower);
        if (!existingDef) {
          groupDefs.set(lower, {
            rowNumber: row.rowNumber,
            name: row.parentAccountName,
            classificationCode: row.classificationCode,
            cashFlowCategoryLabel: '',
          });
        } else if (row.parentAccountName && row.parentAccountName !== existingDef.name) {
          addConflict(
            row.rowNumber,
            `Parent Account Name "${row.parentAccountName}" for code "${row.parentAccountCode}" doesn't match its earlier definition "${existingDef.name}" (row ${existingDef.rowNumber})`,
          );
        }
      }
    }
  }

  const resolveClassificationCategory = (code: string): GLAccountCategory | undefined => {
    const lower = code.trim().toLowerCase();
    const existing = existingClassificationByCode.get(lower)?.category;
    if (existing) return existing;
    const def = classificationDefs.get(lower);
    return def ? CATEGORY_VALUE_BY_LABEL[def.categoryLabel.trim().toLowerCase()] : undefined;
  };
  const classificationCodeIsKnown = (code: string): boolean => {
    const lower = code.trim().toLowerCase();
    return existingClassificationByCode.has(lower) || classificationDefs.has(lower);
  };
  const groupCodeIsKnown = (code: string): boolean => {
    const lower = code.trim().toLowerCase();
    return existingGroupByCode.has(lower) || groupDefs.has(lower);
  };
  const groupClassificationCode = (code: string): string | undefined => {
    const lower = code.trim().toLowerCase();
    return (
      existingGroupByCode.get(lower)?.classification.code ??
      groupDefs.get(lower)?.classificationCode
    );
  };

  // Classification rows: one per newly-defined code.
  const classificationRows: ParsedClassificationRow[] = [];
  for (const [lower, def] of classificationDefs) {
    const errors: string[] = [...(conflictErrorsByRowNumber.get(def.rowNumber) ?? [])];
    if (!def.name)
      errors.push(
        `Classification Name is required the first time code "${lower}" is used (row ${def.rowNumber})`,
      );
    const category = CATEGORY_VALUE_BY_LABEL[def.categoryLabel.trim().toLowerCase()];
    if (!def.categoryLabel) errors.push('Account type is required');
    else if (!category) errors.push(`Unknown account type "${def.categoryLabel}"`);
    const cashFlowCategory = resolveCashFlowCategory(def.cashFlowCategoryLabel, errors);
    classificationRows.push({
      rowNumber: def.rowNumber,
      code:
        rows.find((r) => r.classificationCode.trim().toLowerCase() === lower)?.classificationCode ??
        lower,
      name: def.name,
      categoryLabel: def.categoryLabel,
      category,
      cashFlowCategoryLabel: def.cashFlowCategoryLabel,
      cashFlowCategory,
      status: errors.length === 0 ? 'new' : 'invalid',
      errors,
    });
  }

  // Parent account rows: one per newly-defined code.
  const groupRows: ParsedGroupRow[] = [];
  for (const [lower, def] of groupDefs) {
    const errors: string[] = [...(conflictErrorsByRowNumber.get(def.rowNumber) ?? [])];
    if (!def.name)
      errors.push(
        `Parent Account Name is required the first time code "${lower}" is used (row ${def.rowNumber})`,
      );
    if (!def.classificationCode) errors.push('Classification code is required');
    else if (!classificationCodeIsKnown(def.classificationCode))
      errors.push(`Unknown classification code "${def.classificationCode}"`);
    const cashFlowCategory = resolveCashFlowCategory(def.cashFlowCategoryLabel, errors);
    groupRows.push({
      rowNumber: def.rowNumber,
      code:
        rows.find((r) => r.parentAccountCode.trim().toLowerCase() === lower)?.parentAccountCode ??
        lower,
      name: def.name,
      classificationCode: def.classificationCode,
      cashFlowCategoryLabel: def.cashFlowCategoryLabel,
      cashFlowCategory,
      status: errors.length === 0 ? 'new' : 'invalid',
      errors,
    });
  }

  // Pass 2: account rows, validated the same way as the Advanced parser's Accounts sheet.
  const accountRows: ParsedGLAccountRow[] = [];
  const seenAccountCodes = new Set<string>();
  for (const row of rows) {
    const codeLower = row.code.trim().toLowerCase();
    const errors: string[] = [...(conflictErrorsByRowNumber.get(row.rowNumber) ?? [])];

    if (!row.code) errors.push('Account code is required');
    else if (existingAccountCodes.has(codeLower))
      errors.push(`Account code "${row.code}" already exists`);
    else if (seenAccountCodes.has(codeLower))
      errors.push(`Duplicate account code "${row.code}" in this file`);

    if (!row.name) errors.push('Account name is required');

    const category = CATEGORY_VALUE_BY_LABEL[row.categoryLabel.trim().toLowerCase()];
    if (!row.categoryLabel) errors.push('Account type is required');
    else if (!category) errors.push(`Unknown account type "${row.categoryLabel}"`);

    if (!row.classificationCode) {
      errors.push('Classification code is required');
    } else if (!classificationCodeIsKnown(row.classificationCode)) {
      errors.push(`Unknown classification code "${row.classificationCode}"`);
    } else {
      const classificationCategory = resolveClassificationCategory(row.classificationCode);
      if (category && classificationCategory && classificationCategory !== category) {
        errors.push(
          `Classification "${row.classificationCode}" is ${classificationCategory}, not ${category}`,
        );
      }
    }

    if (row.parentAccountCode) {
      if (!groupCodeIsKnown(row.parentAccountCode)) {
        errors.push(`Unknown parent account code "${row.parentAccountCode}"`);
      } else {
        const parentClassificationCode = groupClassificationCode(row.parentAccountCode);
        if (
          parentClassificationCode &&
          row.classificationCode &&
          parentClassificationCode.trim().toLowerCase() !==
            row.classificationCode.trim().toLowerCase()
        ) {
          errors.push(
            `Parent account "${row.parentAccountCode}" belongs to classification "${parentClassificationCode}", not "${row.classificationCode}"`,
          );
        }
      }
    }

    const cashFlowCategory = resolveCashFlowCategory(row.cashFlowCategoryLabel, errors);

    if (row.code) seenAccountCodes.add(codeLower);

    accountRows.push({
      rowNumber: row.rowNumber,
      code: row.code,
      name: row.name,
      categoryLabel: row.categoryLabel,
      category,
      classificationCode: row.classificationCode,
      parentAccountCode: row.parentAccountCode,
      description: row.description,
      cashFlowCategoryLabel: row.cashFlowCategoryLabel,
      cashFlowCategory,
      status: errors.length === 0 ? 'new' : 'invalid',
      errors,
    });
  }

  return { classifications: classificationRows, groups: groupRows, accounts: accountRows };
}
