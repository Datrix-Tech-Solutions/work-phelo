'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import {
  DepartmentFormFields,
  DeptForm,
} from '@/components/molecules/departments/DepartmentFormFields';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  onSuccess?: (name: string) => void;
}

export function CreateDepartmentPanel({ isOpen, onClose, tenantSlug, onSuccess }: Props) {
  const form = useForm<DeptForm>();

  const handleSubmit = (data: DeptForm) => {
    // TODO: Call create mutation here
    console.log('Creating department:', data);
    onSuccess?.(data.name);
    onClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="New Department"
      description="Add a new department to your organisation."
      width="w-[440px]"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit(handleSubmit)}>Create Department</Button>
        </div>
      }
    >
      <DepartmentFormFields form={form} employees={[]} />
    </SidePanel>
  );
}
