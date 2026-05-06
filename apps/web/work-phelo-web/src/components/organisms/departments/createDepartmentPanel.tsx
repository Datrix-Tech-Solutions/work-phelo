'use client';

import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import {
  DepartmentFormFields,
  DeptForm,
} from '@/components/molecules/departments/DepartmentFormFields';
import { useCreateDepartment } from '@/hooks/useDepartments';
import { Employee } from '@/types/hr';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  employees: Employee[];
  onSuccess?: (name: string) => void;
}

function CreateDepartmentForm({
  onClose,
  onSuccess,
  employees,
}: Omit<Props, 'isOpen' | 'tenantSlug'>) {
  const form = useForm<DeptForm>();
  const { mutate: createDepartment, isPending } = useCreateDepartment();

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSubmit = (data: DeptForm) => {
    createDepartment(
      { name: data.name, description: data.description || undefined },
      {
        onSuccess: () => {
          onSuccess?.(data.name);
          handleClose();
        },
      },
    );
  };

  return (
    <SidePanel
      isOpen
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
      <DepartmentFormFields form={form} employees={employees} />
    </SidePanel>
  );
}

export function CreateDepartmentPanel({ isOpen, onClose, onSuccess, employees }: Props) {
  if (!isOpen) {
    return (
      <SidePanel isOpen={false} onClose={onClose} title="">
        {null}
      </SidePanel>
    );
  }
  return <CreateDepartmentForm onClose={onClose} onSuccess={onSuccess} employees={employees} />;
}
