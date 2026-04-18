'use client';

import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { RoleFormFields, RoleFormValues } from '@/components/molecules/roles/RoleFormFields';
import {
  PermissionMatrix,
  FeaturePermissions,
} from '@/components/molecules/roles/PermissionMatrix';

export interface CreateRoleSubmitValues extends RoleFormValues {
  featurePermissions: FeaturePermissions;
}

interface CreateRolePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: CreateRoleSubmitValues) => void;
  isSubmitting?: boolean;
}

export function CreateRolePanel({ isOpen, onClose, onSubmit, isSubmitting }: CreateRolePanelProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoleFormValues>({
    defaultValues: { name: '', description: '' },
  });

  const [featurePermissions, setFeaturePermissions] = useState<FeaturePermissions>({});

  const handleClose = useCallback(() => {
    reset();
    setFeaturePermissions({});
    onClose();
  }, [reset, onClose]);

  const onValid = (values: RoleFormValues) => {
    onSubmit({ ...values, featurePermissions });
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Role"
      description="Create a custom role and define what it can access."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            isLoading={isSubmitting}
            loadingText="Creating..."
            onClick={handleSubmit(onValid)}
          >
            Create Role
          </Button>
        </div>
      }
    >
      <RoleFormFields register={register} errors={errors} />

      <PermissionMatrix value={featurePermissions} onChange={setFeaturePermissions} />
    </SidePanel>
  );
}
