import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  BranchImportRow,
  DepartmentImportRow,
  EmployeeImportRow,
  BulkImportRowResult,
} from '@/lib/hr/bulkImportTypes';

export interface CompanyBulkImportResult {
  branches: BulkImportRowResult[];
  departments: BulkImportRowResult[];
  employees: BulkImportRowResult[];
}

export function useBulkImportCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rows: {
      branches?: BranchImportRow[];
      departments?: DepartmentImportRow[];
      employees?: EmployeeImportRow[];
    }) => {
      const payload = {
        branches: rows.branches?.map((row) => ({
          rowNumber: row.rowNumber,
          name: row.name,
          code: row.code,
          country: row.country,
          address: row.address,
          city: row.city,
          region: row.region,
          phone: row.phone,
          email: row.email,
          managerName: row.managerName,
          isHeadOffice: row.isHeadOffice,
        })),
        departments: rows.departments?.map((row) => ({
          rowNumber: row.rowNumber,
          name: row.name,
          description: row.description,
          managerName: row.managerName,
          branchName: row.branchName,
        })),
        employees: rows.employees?.map((row) => ({
          rowNumber: row.rowNumber,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          phone: row.phone,
          gender: row.gender,
          departmentName: row.departmentName,
          branchName: row.branchName,
          jobTitle: row.jobTitle,
          managerName: row.managerName,
          hireDate: row.hireDate,
          employmentType: row.employmentType,
          contractEndDate: row.contractEndDate,
          compensationType: row.compensationType,
          basicSalary: row.basicSalary,
        })),
      };
      const res = await api.post<CompanyBulkImportResult>('/hr/bulk-import/company', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['branch-options'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['department-options'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
