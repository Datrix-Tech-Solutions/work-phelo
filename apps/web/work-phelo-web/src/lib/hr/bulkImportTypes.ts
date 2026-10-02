export type ParsedRowStatus = 'new' | 'invalid';

export interface ParsedRowBase {
  rowNumber: number;
  status: ParsedRowStatus;
  errors: string[];
  warnings: string[];
}

export interface BranchImportRow extends ParsedRowBase {
  name: string;
  code?: string;
  country?: string;
  address?: string;
  city?: string;
  region?: string;
  phone?: string;
  email?: string;
  managerName?: string;
  isHeadOffice?: boolean;
}

export interface DepartmentImportRow extends ParsedRowBase {
  name: string;
  description?: string;
  managerName?: string;
  branchName?: string;
}

export interface EmployeeImportRow extends ParsedRowBase {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  gender?: string;
  departmentName: string;
  branchName?: string;
  jobTitle: string;
  managerName?: string;
  hireDate: string;
  employmentType: string;
  contractEndDate?: string;
  compensationType?: string;
  basicSalary?: number;
}

/** Mirrors the backend's BulkImportRowResult (apps/hr-service/src/common/bulk-import.types.ts). */
export interface BulkImportRowResult {
  rowNumber: number;
  status: 'created' | 'failed';
  id?: string;
  message?: string;
  warnings: string[];
}
