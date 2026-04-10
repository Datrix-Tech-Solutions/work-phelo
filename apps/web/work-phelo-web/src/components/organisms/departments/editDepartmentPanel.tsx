'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import {
  DepartmentFormFields,
  DeptForm,
} from '@/components/molecules/departments/DepartmentFormFields';
import { useUpdateDepartment } from '@/hooks/useDepartments';
import { useToast } from '@/hooks/useToast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  editTarget: { id: string; name: string; description?: string; managerId?: string } | null;
}

export function EditDepartmentPanel({ isOpen, onClose, editTarget }: Props) {
  const form = useForm<DeptForm>();
  const toast = useToast();
  const { mutate: updateDepartment, isPending } = useUpdateDepartment();

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
    if (!editTarget) return;
    updateDepartment(
      { id: editTarget.id, name: data.name, description: data.description || undefined },
      {
        onSuccess: () => {
          toast.success('Department updated');
          onClose();
        },
        onError: () => toast.error('Failed to update department'),
      },
    );
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
          <Button
            isLoading={isPending}
            loadingText="Saving..."
            onClick={form.handleSubmit(handleSubmit)}
          >
            Save Changes
          </Button>
        </div>
      }
    >
      <DepartmentFormFields form={form} employees={[]} />
    </SidePanel>
  );
}
