export const EMPLOYEE_IMPORT_HEADERS = [
  'First Name *',
  'Last Name *',
  'Work Email *',
  'Phone Number',
  'Gender',
  'Department *',
  'Branch',
  'Job Title *',
  'Reporting Manager',
  'Date Hired *',
  'Employment Type *',
  'Contract/Internship End Date',
  'Compensation Type',
  'Basic Salary',
];

const EMPLOYEE_EXAMPLE_ROW = {
  'First Name *': 'Ama',
  'Last Name *': 'Boateng',
  'Work Email *': 'ama.boateng@example.com',
  'Phone Number': '0244000000',
  Gender: 'FEMALE',
  'Department *': 'Human Resources',
  Branch: 'Head Office',
  'Job Title *': 'HR Officer',
  'Reporting Manager': 'Kwame Mensah',
  'Date Hired *': '2026-01-15',
  'Employment Type *': 'FULL_TIME',
  'Contract/Internship End Date': '',
  'Compensation Type': 'SALARY',
  'Basic Salary': '4500',
};

export const DEPARTMENT_IMPORT_HEADERS = [
  'Department Name *',
  'Description',
  'Department Head',
  'Branch',
];

const DEPARTMENT_EXAMPLE_ROW = {
  'Department Name *': 'Human Resources',
  Description: 'Employee onboarding and benefits',
  'Department Head': 'Kwame Mensah',
  Branch: 'Head Office',
};

type NoteRow = string | string[];

const EMPLOYEE_NOTES: NoteRow[] = [
  'Columns marked with * are required.',
  'The first row below the header is a greyed-out example — replace or delete it, then add one row per employee.',
  'Branch must match the exact name of an existing branch. Leave blank if not applicable.',
  "Reporting Manager must match an existing employee's full name (First Last). Leave blank if none.",
  'Date Hired and Contract/Internship End Date must be in YYYY-MM-DD format.',
  ['Employment Type must be one of:', 'FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'],
  'Contract/Internship End Date only applies when Employment Type is CONTRACT or INTERN.',
  ['Compensation Type must be one of:', 'SALARY', 'COMMISSION', 'SALARY_PLUS_COMMISSION'],
  'Defaults to SALARY if left blank.',
  'Basic Salary is required when Compensation Type is SALARY or SALARY_PLUS_COMMISSION.',
  ['Gender must be one of:', 'MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'],
  'Gender is optional.',
  "Probation End Date isn't collected here — it's calculated automatically from your company's default probation period.",
];

const DEPARTMENT_NOTES: NoteRow[] = [
  "Department Head must match an existing employee's full name (First Last). Leave blank if none.",
  'Branch must match the exact name of an existing branch. Leave blank to default to the head office.',
];

export const BRANCH_IMPORT_HEADERS = [
  'Branch Name *',
  'Code',
  'Country',
  'Address',
  'City',
  'Region',
  'Phone',
  'Email',
  'Branch Manager',
  'Is Head Office',
];

const BRANCH_EXAMPLE_ROW = {
  'Branch Name *': 'Accra Office',
  Code: 'ACC',
  Country: 'Ghana',
  Address: '12 Independence Ave',
  City: 'Accra',
  Region: 'Greater Accra',
  Phone: '0244000000',
  Email: 'accra.office@example.com',
  'Branch Manager': 'Kwame Mensah',
  'Is Head Office': 'No',
};

const BRANCH_NOTES: NoteRow[] = [
  "Branch Manager must match an existing employee's full name (First Last). Leave blank if none.",
  ['Is Head Office must be one of:', 'Yes', 'No'],
  'Only one branch per company can be the head office — marking a new one will replace the current head office.',
];

function addEmployeesSheet(workbook: import('exceljs').Workbook) {
  const sheet = workbook.addWorksheet('Employees');
  sheet.columns = EMPLOYEE_IMPORT_HEADERS.map((header) => ({ header, key: header, width: 24 }));
  sheet.getRow(1).font = { bold: true };
  sheet.addRow(EMPLOYEE_EXAMPLE_ROW).eachCell((cell) => {
    cell.font = { italic: true, color: { argb: 'FF9CA3AF' } };
  });
}

function addDepartmentsSheet(workbook: import('exceljs').Workbook) {
  const sheet = workbook.addWorksheet('Departments');
  sheet.columns = DEPARTMENT_IMPORT_HEADERS.map((header) => ({ header, key: header, width: 28 }));
  sheet.getRow(1).font = { bold: true };
  sheet.addRow(DEPARTMENT_EXAMPLE_ROW).eachCell((cell) => {
    cell.font = { italic: true, color: { argb: 'FF9CA3AF' } };
  });
}

function addBranchesSheet(workbook: import('exceljs').Workbook) {
  const sheet = workbook.addWorksheet('Branches');
  sheet.columns = BRANCH_IMPORT_HEADERS.map((header) => ({ header, key: header, width: 24 }));
  sheet.getRow(1).font = { bold: true };
  sheet.addRow(BRANCH_EXAMPLE_ROW).eachCell((cell) => {
    cell.font = { italic: true, color: { argb: 'FF9CA3AF' } };
  });
}

function addReadMeSheet(workbook: import('exceljs').Workbook, rows: NoteRow[]) {
  const notes = workbook.addWorksheet('Read Me');
  notes.columns = [
    { header: '', key: 'note', width: 60 },
    { header: '', key: 'opt1', width: 22 },
    { header: '', key: 'opt2', width: 22 },
    { header: '', key: 'opt3', width: 22 },
    { header: '', key: 'opt4', width: 22 },
  ];
  rows.forEach((row) => notes.addRow(Array.isArray(row) ? row : [row]));
}

async function downloadWorkbook(workbook: import('exceljs').Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Builds and downloads the .xlsx template used to bulk-create employees. Department, Branch and
 *  Reporting Manager are entered by name (not ID) — the Read Me sheet explains how each is matched. */
export async function downloadEmployeeImportTemplate() {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  addEmployeesSheet(workbook);
  addReadMeSheet(workbook, [
    'Department must match the exact name of an existing department.',
    ...EMPLOYEE_NOTES,
  ]);

  await downloadWorkbook(workbook, 'employee-import-template.xlsx');
}

/** Builds and downloads the .xlsx template used to bulk-create departments together with their
 *  employees in one go. A row on the Employees sheet can reference either an existing department
 *  or a new one just added on the Departments sheet. */
export async function downloadEmployeeAndDepartmentsImportTemplate() {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  addDepartmentsSheet(workbook);
  addEmployeesSheet(workbook);
  addReadMeSheet(workbook, [
    'Department must match the exact name of an existing department, or a new one you added on the Departments sheet.',
    ...DEPARTMENT_NOTES,
    ...EMPLOYEE_NOTES,
  ]);

  await downloadWorkbook(workbook, 'employee-and-departments-import-template.xlsx');
}

/** Builds and downloads the .xlsx template used to bulk-create departments only. */
export async function downloadDepartmentImportTemplate() {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  addDepartmentsSheet(workbook);
  addReadMeSheet(workbook, [
    'Columns marked with * are required.',
    'The first row below the header is a greyed-out example — replace or delete it, then add one row per department.',
    ...DEPARTMENT_NOTES,
  ]);

  await downloadWorkbook(workbook, 'department-import-template.xlsx');
}

/** Builds and downloads the .xlsx template used to bulk-create branches only. */
export async function downloadBranchImportTemplate() {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  addBranchesSheet(workbook);
  addReadMeSheet(workbook, [
    'Columns marked with * are required.',
    'The first row below the header is a greyed-out example — replace or delete it, then add one row per branch.',
    ...BRANCH_NOTES,
  ]);

  await downloadWorkbook(workbook, 'branch-import-template.xlsx');
}

/** Builds and downloads the .xlsx template used to bulk-create branches, departments and employees
 *  together in one file. Sheets are ordered Branches → Departments → Employees so each sheet can
 *  reference names either already existing or just added earlier in the same file. */
export async function downloadCompanyImportTemplate() {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  addBranchesSheet(workbook);
  addDepartmentsSheet(workbook);
  addEmployeesSheet(workbook);
  addReadMeSheet(workbook, [
    'Columns marked with * are required.',
    'The first row below the header is a greyed-out example on each sheet — replace or delete it, then add one row per record.',
    'Fill in the sheets in order: Branches, then Departments, then Employees — later sheets can reference names added on earlier ones.',
    'Branch on the Departments and Employees sheets must match an existing branch name, or a new one you added on the Branches sheet.',
    'Department on the Employees sheet must match an existing department name, or a new one you added on the Departments sheet.',
    ...BRANCH_NOTES,
    "Department Head must match an existing employee's full name (First Last). Leave blank if none.",
    "Reporting Manager on the Employees sheet must match an existing employee's full name (First Last). Leave blank if none.",
    'Date Hired and Contract/Internship End Date must be in YYYY-MM-DD format.',
    ['Employment Type must be one of:', 'FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'],
    'Contract/Internship End Date only applies when Employment Type is CONTRACT or INTERN.',
    ['Compensation Type must be one of:', 'SALARY', 'COMMISSION', 'SALARY_PLUS_COMMISSION'],
    'Defaults to SALARY if left blank.',
    'Basic Salary is required when Compensation Type is SALARY or SALARY_PLUS_COMMISSION.',
    ['Gender must be one of:', 'MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'],
    'Gender is optional.',
    "Probation End Date isn't collected here — it's calculated automatically from your company's default probation period.",
  ]);

  await downloadWorkbook(workbook, 'company-import-template.xlsx');
}
