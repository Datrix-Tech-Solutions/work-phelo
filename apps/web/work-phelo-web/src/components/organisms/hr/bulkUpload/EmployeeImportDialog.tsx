'use client';

import { SearchSelect } from '@/components/atoms/SearchSelect';
import { BulkUploadImportDialog } from '@/components/organisms/hr/bulkUpload/BulkUploadImportDialog';
import type {
  ImportCellContext,
  ImportSectionData,
} from '@/components/organisms/hr/bulkUpload/ImportPreviewSection';
import { downloadEmployeeImportTemplate } from '@/lib/hr/employeeImportTemplate';
import { parseEmployeeImportFile } from '@/lib/hr/bulkImportParser';
import type { EmployeeImportRow } from '@/lib/hr/bulkImportTypes';
import { useBulkImportEmployees } from '@/hooks/hr/useEmployees';
import { useDepartmentOptions } from '@/hooks/hr/useDepartments';
import { useGrantImportedAccess } from '@/hooks/hr/useGrantImportedAccess';

const normalize = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
const isDepartmentError = (e: string) => e.startsWith('Department');

/**
 * Marks rows whose department is not one of the existing ones, so it can be picked in the preview
 * instead of failing at import. Pass `departmentNames` only when the departments already exist
 * (not when the same file is creating them).
 */
function checkDepartments(
  rows: EmployeeImportRow[],
  departmentNames: string[],
): EmployeeImportRow[] {
  const known = new Set(departmentNames.map(normalize));
  return rows.map((row) => {
    if (!row.departmentName || known.has(normalize(row.departmentName))) return row;
    const errors = [...row.errors, `Department "${row.departmentName}" not found`];
    return { ...row, errors, status: 'invalid' };
  });
}

export function employeeSection(
  rows: EmployeeImportRow[],
  departmentNames?: string[],
): ImportSectionData {
  return {
    key: 'employees',
    title: 'Employees',
    supportsAccess: true,
    rows,
    reviseRow: (row, patch) => {
      const next = { ...row, ...patch } as EmployeeImportRow;
      if (!('departmentName' in patch)) return next;
      // A department was chosen: drop its errors, and the row is ready if nothing else is wrong.
      const errors = next.errors.filter((e) => !isDepartmentError(e));
      return { ...next, errors, status: errors.length === 0 ? 'new' : 'invalid' };
    },
    columns: [
      {
        header: 'Name',
        render: (r: EmployeeImportRow) => `${r.firstName} ${r.lastName}`.trim() || '—',
      },
      { header: 'Email', render: (r: EmployeeImportRow) => r.email || '—' },
      {
        header: 'Department',
        render: (r: EmployeeImportRow, ctx: ImportCellContext) =>
          departmentNames && !ctx.locked && r.errors.some(isDepartmentError) ? (
            <div className="min-w-44">
              <SearchSelect
                size="xs"
                placeholder="Select department"
                options={departmentNames.map((name) => ({ value: name, label: name }))}
                value=""
                clearable={false}
                onChange={(name) => name && ctx.update({ departmentName: name })}
              />
            </div>
          ) : (
            r.departmentName || '—'
          ),
      },
      { header: 'Job Title', render: (r: EmployeeImportRow) => r.jobTitle || '—' },
      { header: 'Hire Date', render: (r: EmployeeImportRow) => r.hireDate || '—' },
    ],
  };
}

interface EmployeeImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/** The employee-only import pop-up, usable from anywhere (e.g. the employee directory). */
export function EmployeeImportDialog({ isOpen, onClose }: EmployeeImportDialogProps) {
  const bulkImportEmployees = useBulkImportEmployees();
  const { canGrantAccess, grantAccess } = useGrantImportedAccess();
  const { data: departments, refetch: refetchDepartments } = useDepartmentOptions();

  return (
    <BulkUploadImportDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Import Employees"
      description="Download the template, fill it in, then upload it here to bulk-create employees. Tick System access to also invite someone as a user."
      canGrantAccess={canGrantAccess}
      onDownloadTemplate={downloadEmployeeImportTemplate}
      parseFile={async (file) => {
        const rows = await parseEmployeeImportFile(file);
        const names = (departments ?? (await refetchDepartments()).data ?? []).map((d) => d.name);
        return [employeeSection(checkDepartments(rows, names), names)];
      }}
      onImport={async (sections) => {
        const employees = (sections[0]?.rows ?? []).filter(
          (r) => (r as EmployeeImportRow).status === 'new',
        ) as EmployeeImportRow[];
        const result = await bulkImportEmployees.mutateAsync(employees);
        return { employees: await grantAccess(employees, result) };
      }}
    />
  );
}
