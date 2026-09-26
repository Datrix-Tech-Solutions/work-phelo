'use client';

import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import {
  DepartmentFormFields,
  DeptForm,
} from '@/components/molecules/hr/departments/DepartmentFormFields';
import { useCreateDepartment } from '@/hooks/hr/useDepartments';
import { EmployeeOption } from '@/types/hr';
import { BranchOption } from '@/hooks/hr/useBranches';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  employees: EmployeeOption[];
  branches: BranchOption[];
  onSuccess?: (name: string) => void;
}

function CreateDepartmentForm({
  isOpen,
  onClose,
  onSuccess,
  employees,
  branches,
}: Omit<Props, 'tenantSlug'>) {
  const form = useForm<DeptForm>();
  const { mutate: createDepartment, isPending } = useCreateDepartment();

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSubmit = (data: DeptForm) => {
    createDepartment(
      {
        name: data.name,
        description: data.description || undefined,
        branchId: data.branchId || undefined,
      },
      {
        onSuccess: () => {
          form.reset({ name: '', description: '', managerId: undefined, branchId: undefined });
          onSuccess?.(data.name);
          handleClose();
        },
      },
    );
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="New Department"
      description="Add a new department to your organisation."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            isLoading={isPending}
            loadingText="Creating..."
            onClick={form.handleSubmit(handleSubmit)}
          >
            Create Department
          </Button>
        </div>
      }
    >
      <DepartmentFormFields form={form} employees={employees} branches={branches} />
    </SidePanel>
  );
}

export function CreateDepartmentPanel({ isOpen, onClose, onSuccess, employees, branches }: Props) {
  return (
    <CreateDepartmentForm
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
      employees={employees}
      branches={branches}
    />
  );
}
