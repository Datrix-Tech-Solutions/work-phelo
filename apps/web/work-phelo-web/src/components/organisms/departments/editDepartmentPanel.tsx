'use client';

import { useEffect } from 'react';
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
  editTarget: any;
}

export function EditDepartmentPanel({ isOpen, onClose, tenantSlug, editTarget }: Props) {
  const form = useForm<DeptForm>();

  useEffect(() => {
    if (editTarget) {
      form.reset({
        name: editTarget.name,
        description: editTarget.description,
        managerId: editTarget.managerId,
      });
    }
  }, [editTarget, form]);

  const handleSubmit = (data: DeptForm) => {
    console.log('Updating department:', data);
    onClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Department"
      description={`Editing "${editTarget?.name}"`}
      width="w-[440px]"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit(handleSubmit)}>Save Changes</Button>
        </div>
      }
    >
      <DepartmentFormFields form={form} employees={[]} />
    </SidePanel>
  );
}
