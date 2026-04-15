'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import {
  DepartmentFormFields,
  DeptForm,
} from '@/components/molecules/departments/DepartmentFormFields';
import { useCreateDepartment } from '@/hooks/useDepartments';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  onSuccess?: (name: string) => void;
}

export function CreateDepartmentPanel({ isOpen, onClose, onSuccess }: Props) {
  const form = useForm<DeptForm>();
  const { mutate: createDepartment, isPending } = useCreateDepartment();

  const handleSubmit = (data: DeptForm) => {
    createDepartment(
      { name: data.name, description: data.description || undefined },
      {
        onSuccess: () => {
          onSuccess?.(data.name);
          onClose();
          form.reset();
        },
      },
    );
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="New Department"
      description="Add a new department to your organisation."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
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
      <DepartmentFormFields form={form} employees={[]} />
    </SidePanel>
  );
}
