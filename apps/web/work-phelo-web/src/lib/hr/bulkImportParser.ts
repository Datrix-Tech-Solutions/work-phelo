import type ExcelJS from 'exceljs';
import {
  BRANCH_IMPORT_HEADERS,
  DEPARTMENT_IMPORT_HEADERS,
  EMPLOYEE_IMPORT_HEADERS,
} from '@/lib/hr/employeeImportTemplate';
import type {
  BranchImportRow,
  DepartmentImportRow,
  EmployeeImportRow,
} from '@/lib/hr/bulkImportTypes';

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'];
const COMPENSATION_TYPES = ['SALARY', 'COMMISSION', 'SALARY_PLUS_COMMISSION'];
const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cellText(
  row: ExcelJS.Row,
  columnIndexByHeader: Map<string, number>,
  header: string,
): string {
  const index = columnIndexByHeader.get(header);
  if (!index) return '';
  const value = row.getCell(index).value;
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
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

function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function loadWorkbook(file: File): Promise<ExcelJS.Workbook> {
  const ExcelJSModule = (await import('exceljs')).default;
  const workbook = new ExcelJSModule.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);
  return workbook;
}

function parseBranchesSheet(sheet: ExcelJS.Worksheet | undefined): BranchImportRow[] {
  const rows: BranchImportRow[] = [];
  if (!sheet) return rows;
  const columnIndexByHeader = headerIndex(sheet);
  const seenNames = new Set<string>();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = cellText(row, columnIndexByHeader, BRANCH_IMPORT_HEADERS[0]);
    const code = cellText(row, columnIndexByHeader, BRANCH_IMPORT_HEADERS[1]);
    const country = cellText(row, columnIndexByHeader, BRANCH_IMPORT_HEADERS[2]);
    const address = cellText(row, columnIndexByHeader, BRANCH_IMPORT_HEADERS[3]);
    const city = cellText(row, columnIndexByHeader, BRANCH_IMPORT_HEADERS[4]);
    const region = cellText(row, columnIndexByHeader, BRANCH_IMPORT_HEADERS[5]);
    const phone = cellText(row, columnIndexByHeader, BRANCH_IMPORT_HEADERS[6]);
    const email = cellText(row, columnIndexByHeader, BRANCH_IMPORT_HEADERS[7]);
    const managerName = cellText(row, columnIndexByHeader, BRANCH_IMPORT_HEADERS[8]);
    const isHeadOfficeText = cellText(row, columnIndexByHeader, BRANCH_IMPORT_HEADERS[9]);
    if (!name && !code && !address && !city) return;

    const errors: string[] = [];
    const warnings: string[] = [];
    const nameLower = name.trim().toLowerCase();

    if (!name) errors.push('Branch Name is required');
    else if (seenNames.has(nameLower)) errors.push(`Duplicate branch name "${name}" in this file`);
    if (email && !EMAIL_RE.test(email)) errors.push(`"${email}" is not a valid email`);

    let isHeadOffice: boolean | undefined;
    const normalizedHeadOffice = isHeadOfficeText.trim().toLowerCase();
    if (normalizedHeadOffice === 'yes') isHeadOffice = true;
    else if (normalizedHeadOffice === 'no' || normalizedHeadOffice === '') isHeadOffice = false;
    else errors.push(`Is Head Office must be "Yes" or "No", got "${isHeadOfficeText}"`);

    if (name) seenNames.add(nameLower);

    rows.push({
      rowNumber,
      name,
      code: code || undefined,
      country: country || undefined,
      address: address || undefined,
      city: city || undefined,
      region: region || undefined,
      phone: phone || undefined,
      email: email || undefined,
      managerName: managerName || undefined,
      isHeadOffice,
      status: errors.length === 0 ? 'new' : 'invalid',
      errors,
      warnings,
    });
  });

  return rows;
}

function parseDepartmentsSheet(sheet: ExcelJS.Worksheet | undefined): DepartmentImportRow[] {
  const rows: DepartmentImportRow[] = [];
  if (!sheet) return rows;
  const columnIndexByHeader = headerIndex(sheet);
  const seenNames = new Set<string>();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = cellText(row, columnIndexByHeader, DEPARTMENT_IMPORT_HEADERS[0]);
    const description = cellText(row, columnIndexByHeader, DEPARTMENT_IMPORT_HEADERS[1]);
    const managerName = cellText(row, columnIndexByHeader, DEPARTMENT_IMPORT_HEADERS[2]);
    const branchName = cellText(row, columnIndexByHeader, DEPARTMENT_IMPORT_HEADERS[3]);
    if (!name && !description) return;

    const errors: string[] = [];
    const warnings: string[] = [];
    const nameLower = name.trim().toLowerCase();

    if (!name) errors.push('Department Name is required');
    else if (seenNames.has(nameLower))
      errors.push(`Duplicate department name "${name}" in this file`);

    if (name) seenNames.add(nameLower);

    rows.push({
      rowNumber,
      name,
      description: description || undefined,
      managerName: managerName || undefined,
      branchName: branchName || undefined,
      status: errors.length === 0 ? 'new' : 'invalid',
      errors,
      warnings,
    });
  });

  return rows;
}

function parseEmployeesSheet(sheet: ExcelJS.Worksheet | undefined): EmployeeImportRow[] {
  const rows: EmployeeImportRow[] = [];
  if (!sheet) return rows;
  const columnIndexByHeader = headerIndex(sheet);
  const seenEmails = new Set<string>();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const firstName = cellText(row, columnIndexByHeader, EMPLOYEE_IMPORT_HEADERS[0]);
    const lastName = cellText(row, columnIndexByHeader, EMPLOYEE_IMPORT_HEADERS[1]);
    const email = cellText(row, columnIndexByHeader, EMPLOYEE_IMPORT_HEADERS[2]);
    const phone = cellText(row, columnIndexByHeader, EMPLOYEE_IMPORT_HEADERS[3]);
    const gender = cellText(row, columnIndexByHeader, EMPLOYEE_IMPORT_HEADERS[4]);
    const departmentName = cellText(row, columnIndexByHeader, EMPLOYEE_IMPORT_HEADERS[5]);
    const branchName = cellText(row, columnIndexByHeader, EMPLOYEE_IMPORT_HEADERS[6]);
    const jobTitle = cellText(row, columnIndexByHeader, EMPLOYEE_IMPORT_HEADERS[7]);
    const managerName = cellText(row, columnIndexByHeader, EMPLOYEE_IMPORT_HEADERS[8]);
    const hireDate = cellText(row, columnIndexByHeader, EMPLOYEE_IMPORT_HEADERS[9]);
    const employmentType = cellText(row, columnIndexByHeader, EMPLOYEE_IMPORT_HEADERS[10]);
    const contractEndDate = cellText(row, columnIndexByHeader, EMPLOYEE_IMPORT_HEADERS[11]);
    const compensationType = cellText(row, columnIndexByHeader, EMPLOYEE_IMPORT_HEADERS[12]);
    const basicSalaryText = cellText(row, columnIndexByHeader, EMPLOYEE_IMPORT_HEADERS[13]);
    if (!firstName && !lastName && !email) return;

    const errors: string[] = [];
    const warnings: string[] = [];
    const emailLower = email.trim().toLowerCase();

    if (!firstName) errors.push('First Name is required');
    if (!lastName) errors.push('Last Name is required');
    if (!email) errors.push('Work Email is required');
    else if (!EMAIL_RE.test(email)) errors.push(`"${email}" is not a valid email`);
    else if (seenEmails.has(emailLower)) errors.push(`Duplicate email "${email}" in this file`);

    if (!departmentName) errors.push('Department is required');
    if (!jobTitle) errors.push('Job Title is required');

    if (!hireDate) errors.push('Date Hired is required');
    else if (!isValidDate(hireDate)) errors.push(`Date Hired "${hireDate}" must be YYYY-MM-DD`);

    const employmentTypeUpper = employmentType.trim().toUpperCase();
    if (!employmentType) errors.push('Employment Type is required');
    else if (!EMPLOYMENT_TYPES.includes(employmentTypeUpper)) {
      errors.push(`Employment Type must be one of: ${EMPLOYMENT_TYPES.join(', ')}`);
    }

    if (contractEndDate && !isValidDate(contractEndDate)) {
      errors.push(`Contract/Internship End Date "${contractEndDate}" must be YYYY-MM-DD`);
    }

    const compensationTypeUpper = compensationType.trim().toUpperCase();
    if (compensationType && !COMPENSATION_TYPES.includes(compensationTypeUpper)) {
      errors.push(`Compensation Type must be one of: ${COMPENSATION_TYPES.join(', ')}`);
    }

    const genderUpper = gender.trim().toUpperCase();
    if (gender && !GENDERS.includes(genderUpper)) {
      errors.push(`Gender must be one of: ${GENDERS.join(', ')}`);
    }

    let basicSalary: number | undefined;
    if (basicSalaryText) {
      const parsed = Number(basicSalaryText);
      if (Number.isNaN(parsed) || parsed < 0) {
        errors.push(`Basic Salary "${basicSalaryText}" must be a positive number`);
      } else {
        basicSalary = parsed;
      }
    }
    const needsSalary =
      compensationTypeUpper === 'SALARY' || compensationTypeUpper === 'SALARY_PLUS_COMMISSION';
    if (needsSalary && basicSalary === undefined) {
      errors.push('Basic Salary is required for this Compensation Type');
    }

    if (email) seenEmails.add(emailLower);

    rows.push({
      rowNumber,
      firstName,
      lastName,
      email,
      phone: phone || undefined,
      gender: gender ? genderUpper : undefined,
      departmentName,
      branchName: branchName || undefined,
      jobTitle,
      managerName: managerName || undefined,
      hireDate,
      employmentType: employmentTypeUpper,
      contractEndDate: contractEndDate || undefined,
      compensationType: compensationType ? compensationTypeUpper : undefined,
      basicSalary,
      status: errors.length === 0 ? 'new' : 'invalid',
      errors,
      warnings,
    });
  });

  return rows;
}

export async function parseBranchImportFile(file: File): Promise<BranchImportRow[]> {
  const workbook = await loadWorkbook(file);
  return parseBranchesSheet(workbook.getWorksheet('Branches'));
}

export async function parseDepartmentImportFile(file: File): Promise<DepartmentImportRow[]> {
  const workbook = await loadWorkbook(file);
  return parseDepartmentsSheet(workbook.getWorksheet('Departments'));
}

export async function parseEmployeeImportFile(file: File): Promise<EmployeeImportRow[]> {
  const workbook = await loadWorkbook(file);
  return parseEmployeesSheet(workbook.getWorksheet('Employees'));
}

export interface EmployeeAndDepartmentsImportResult {
  departments: DepartmentImportRow[];
  employees: EmployeeImportRow[];
}

export async function parseEmployeeAndDepartmentsImportFile(
  file: File,
): Promise<EmployeeAndDepartmentsImportResult> {
  const workbook = await loadWorkbook(file);
  return {
    departments: parseDepartmentsSheet(workbook.getWorksheet('Departments')),
    employees: parseEmployeesSheet(workbook.getWorksheet('Employees')),
  };
}

export interface CompanyImportResult {
  branches: BranchImportRow[];
  departments: DepartmentImportRow[];
  employees: EmployeeImportRow[];
}

export async function parseCompanyImportFile(file: File): Promise<CompanyImportResult> {
  const workbook = await loadWorkbook(file);
  return {
    branches: parseBranchesSheet(workbook.getWorksheet('Branches')),
    departments: parseDepartmentsSheet(workbook.getWorksheet('Departments')),
    employees: parseEmployeesSheet(workbook.getWorksheet('Employees')),
  };
}
