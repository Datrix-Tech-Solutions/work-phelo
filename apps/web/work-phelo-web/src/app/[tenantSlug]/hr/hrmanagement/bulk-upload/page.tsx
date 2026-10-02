'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useHrManagementAccess } from '@/hooks/hr/useHrManagementAccess';
import { Button } from '@/components/atoms/Button';
import { frostedAvatarStyle, cardClass } from '@/lib/utils';
import { Building2, Users, FolderTree, GitBranch } from 'lucide-react';
import { BulkUploadImportDialog } from '@/components/organisms/hr/bulkUpload/BulkUploadImportDialog';
import type { ImportSectionData } from '@/components/organisms/hr/bulkUpload/ImportPreviewSection';
import {
  downloadEmployeeImportTemplate,
  downloadEmployeeAndDepartmentsImportTemplate,
  downloadDepartmentImportTemplate,
  downloadBranchImportTemplate,
  downloadCompanyImportTemplate,
} from '@/lib/hr/employeeImportTemplate';
import {
  parseBranchImportFile,
  parseDepartmentImportFile,
  parseEmployeeImportFile,
  parseEmployeeAndDepartmentsImportFile,
  parseCompanyImportFile,
} from '@/lib/hr/bulkImportParser';
import type {
  BranchImportRow,
  DepartmentImportRow,
  EmployeeImportRow,
  BulkImportRowResult,
} from '@/lib/hr/bulkImportTypes';
import { useBulkImportBranches } from '@/hooks/hr/useBranches';
import { useBulkImportDepartments } from '@/hooks/hr/useDepartments';
import { useBulkImportEmployees } from '@/hooks/hr/useEmployees';
import { useBulkImportCompany } from '@/hooks/hr/useBulkImportCompany';

type BulkUploadOption = {
  key: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
};

const UPLOAD_OPTIONS: BulkUploadOption[] = [
  { key: 'company', label: 'Full Company Data Upload', icon: Building2, color: '#2563eb' },
  { key: 'employee', label: 'Employee Data Upload', icon: Users, color: '#16a34a' },
  { key: 'department', label: 'Department Data Upload', icon: FolderTree, color: '#d97706' },
  { key: 'branch', label: 'Branch Data Upload', icon: GitBranch, color: '#9333ea' },
];

const UPLOAD_SUB_OPTIONS: Record<string, { key: string; label: string }[]> = {
  company: [{ key: 'company', label: 'Full Company Data' }],
  employee: [
    { key: 'employee-only', label: 'Employee Only' },
    { key: 'employee-and-departments', label: 'Employee and Departments' },
  ],
  department: [{ key: 'department', label: 'Department Only' }],
  branch: [{ key: 'branch', label: 'Branch Only' }],
};

function branchSection(rows: BranchImportRow[]): ImportSectionData {
  return {
    key: 'branches',
    title: 'Branches',
    rows,
    columns: [
      { header: 'Name', render: (r: BranchImportRow) => r.name || '—' },
      { header: 'Code', render: (r: BranchImportRow) => r.code || '—' },
      { header: 'Manager', render: (r: BranchImportRow) => r.managerName || '—' },
      { header: 'Head Office', render: (r: BranchImportRow) => (r.isHeadOffice ? 'Yes' : 'No') },
    ],
  };
}

function departmentSection(rows: DepartmentImportRow[]): ImportSectionData {
  return {
    key: 'departments',
    title: 'Departments',
    rows,
    columns: [
      { header: 'Name', render: (r: DepartmentImportRow) => r.name || '—' },
      { header: 'Head', render: (r: DepartmentImportRow) => r.managerName || '—' },
      { header: 'Branch', render: (r: DepartmentImportRow) => r.branchName || '—' },
    ],
  };
}

function employeeSection(rows: EmployeeImportRow[]): ImportSectionData {
  return {
    key: 'employees',
    title: 'Employees',
    rows,
    columns: [
      {
        header: 'Name',
        render: (r: EmployeeImportRow) => `${r.firstName} ${r.lastName}`.trim() || '—',
      },
      { header: 'Email', render: (r: EmployeeImportRow) => r.email || '—' },
      { header: 'Department', render: (r: EmployeeImportRow) => r.departmentName || '—' },
      { header: 'Job Title', render: (r: EmployeeImportRow) => r.jobTitle || '—' },
      { header: 'Hire Date', render: (r: EmployeeImportRow) => r.hireDate || '—' },
    ],
  };
}

function newRows<Row extends { status: 'new' | 'invalid' }>(rows: Row[]): Row[] {
  return rows.filter((r) => r.status === 'new');
}

export default function BulkUploadPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const user = useAuthStore((s) => s.user);
  const { hasAnyManagementAccess } = useHrManagementAccess();
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedSubOption, setSelectedSubOption] = useState<string | null>(null);
  const subOptions = selected ? UPLOAD_SUB_OPTIONS[selected] : undefined;
  const [importDialogKey, setImportDialogKey] = useState<string | null>(null);

  const bulkImportBranches = useBulkImportBranches();
  const bulkImportDepartments = useBulkImportDepartments();
  const bulkImportEmployees = useBulkImportEmployees();
  const bulkImportCompany = useBulkImportCompany();

  const IMPORT_DIALOG_CONFIG: Record<
    string,
    {
      title: string;
      description: string;
      onDownloadTemplate: () => void;
      parseFile: (file: File) => Promise<ImportSectionData[]>;
      onImport: (sections: ImportSectionData[]) => Promise<Record<string, BulkImportRowResult[]>>;
    }
  > = {
    company: {
      title: 'Import Company Data',
      description:
        'Download the template, fill it in, then upload it here to bulk-create your company data.',
      onDownloadTemplate: downloadCompanyImportTemplate,
      parseFile: async (file) => {
        const { branches, departments, employees } = await parseCompanyImportFile(file);
        return [
          branchSection(branches),
          departmentSection(departments),
          employeeSection(employees),
        ];
      },
      onImport: async (sections) => {
        const branches = newRows(
          (sections.find((s) => s.key === 'branches')?.rows ?? []) as BranchImportRow[],
        );
        const departments = newRows(
          (sections.find((s) => s.key === 'departments')?.rows ?? []) as DepartmentImportRow[],
        );
        const employees = newRows(
          (sections.find((s) => s.key === 'employees')?.rows ?? []) as EmployeeImportRow[],
        );
        const result = await bulkImportCompany.mutateAsync({ branches, departments, employees });
        return {
          branches: result.branches,
          departments: result.departments,
          employees: result.employees,
        };
      },
    },
    'employee-only': {
      title: 'Import Employees',
      description:
        'Download the template, fill it in, then upload it here to bulk-create employees.',
      onDownloadTemplate: downloadEmployeeImportTemplate,
      parseFile: async (file) => [employeeSection(await parseEmployeeImportFile(file))],
      onImport: async (sections) => {
        const employees = newRows((sections[0]?.rows ?? []) as EmployeeImportRow[]);
        const result = await bulkImportEmployees.mutateAsync(employees);
        return { employees: result };
      },
    },
    'employee-and-departments': {
      title: 'Import Employees and Departments',
      description:
        'Download the template, fill it in, then upload it here to bulk-create employees along with their departments.',
      onDownloadTemplate: downloadEmployeeAndDepartmentsImportTemplate,
      parseFile: async (file) => {
        const { departments, employees } = await parseEmployeeAndDepartmentsImportFile(file);
        return [departmentSection(departments), employeeSection(employees)];
      },
      onImport: async (sections) => {
        const departments = newRows(
          (sections.find((s) => s.key === 'departments')?.rows ?? []) as DepartmentImportRow[],
        );
        const employees = newRows(
          (sections.find((s) => s.key === 'employees')?.rows ?? []) as EmployeeImportRow[],
        );
        const result = await bulkImportCompany.mutateAsync({ departments, employees });
        return { departments: result.departments, employees: result.employees };
      },
    },
    department: {
      title: 'Import Departments',
      description:
        'Download the template, fill it in, then upload it here to bulk-create departments.',
      onDownloadTemplate: downloadDepartmentImportTemplate,
      parseFile: async (file) => [departmentSection(await parseDepartmentImportFile(file))],
      onImport: async (sections) => {
        const departments = newRows((sections[0]?.rows ?? []) as DepartmentImportRow[]);
        const result = await bulkImportDepartments.mutateAsync(departments);
        return { departments: result };
      },
    },
    branch: {
      title: 'Import Branches',
      description:
        'Download the template, fill it in, then upload it here to bulk-create branches.',
      onDownloadTemplate: downloadBranchImportTemplate,
      parseFile: async (file) => [branchSection(await parseBranchImportFile(file))],
      onImport: async (sections) => {
        const branches = newRows((sections[0]?.rows ?? []) as BranchImportRow[]);
        const result = await bulkImportBranches.mutateAsync(branches);
        return { branches: result };
      },
    },
  };

  const importDialogConfig = importDialogKey ? IMPORT_DIALOG_CONFIG[importDialogKey] : undefined;

  useEffect(() => {
    if (user !== null && !hasAnyManagementAccess) {
      router.replace(`/${params.tenantSlug}/hr`);
    }
  }, [hasAnyManagementAccess, router, user, params.tenantSlug]);

  if (user !== null && !hasAnyManagementAccess) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Bulk Upload</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-6 flex-1 min-h-0">
        <div className="flex flex-col gap-2">
          {UPLOAD_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <Button
                key={option.key}
                type="button"
                variant={selected === option.key ? 'primary' : 'secondary'}
                className="justify-start items-center gap-3 h-20 py-3 whitespace-normal text-left"
                onClick={() => {
                  setSelected(option.key);
                  setSelectedSubOption(null);
                }}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white backdrop-blur-sm border border-white/30"
                  style={frostedAvatarStyle(option.color)}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="leading-tight">{option.label}</span>
                  {option.description && (
                    <span className="text-xs font-normal opacity-70 leading-tight">
                      {option.description}
                    </span>
                  )}
                </div>
              </Button>
            );
          })}
        </div>

        <div className={cardClass('p-4 flex flex-col gap-4 h-full')}>
          <div className="flex items-center justify-between shrink-0">
            <h3 className="text-sm font-semibold text-gray-900">Upload History</h3>
            {subOptions && (
              <div className="flex gap-2">
                {subOptions.map((subOption) => (
                  <Button
                    key={subOption.key}
                    type="button"
                    variant={selectedSubOption === subOption.key ? 'primary' : 'secondary'}
                    className="h-10"
                    onClick={() => {
                      setSelectedSubOption(subOption.key);
                      setImportDialogKey(subOption.key);
                    }}
                  >
                    {subOption.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0" />
        </div>
      </div>

      <BulkUploadImportDialog
        isOpen={importDialogConfig !== undefined}
        onClose={() => setImportDialogKey(null)}
        title={importDialogConfig?.title ?? ''}
        description={importDialogConfig?.description ?? ''}
        onDownloadTemplate={importDialogConfig?.onDownloadTemplate}
        parseFile={importDialogConfig?.parseFile}
        onImport={importDialogConfig?.onImport}
      />
    </div>
  );
}
