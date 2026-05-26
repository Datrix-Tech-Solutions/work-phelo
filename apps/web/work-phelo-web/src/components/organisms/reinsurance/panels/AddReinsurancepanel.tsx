'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { ReinsurerFormValues, REINSURER_FORM_DEFAULTS } from '@/types/reinsurance';
import { ReinsurerFormFields } from '@/components/molecules/reinsurance/ReinsurerFormFields';

interface AddReinsurancePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddReinsurancePanel({ isOpen, onClose }: AddReinsurancePanelProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ReinsurerFormValues>({
    defaultValues: REINSURER_FORM_DEFAULTS,
  });

  const handleClose = () => {
    reset(REINSURER_FORM_DEFAULTS);
    onClose();
  };

  const onSubmit = (data: ReinsurerFormValues) => {
    // TODO: call useCreateCedant() mutation once API is ready
    console.log('Create Reinsurer:', data);
    handleClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Reinsurer"
      description="Fill in the details to create a new reinsurer."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save Reinsurer'}
          </Button>
        </div>
      }
    >
      <ReinsurerFormFields
        control={control}
        register={register}
        setValue={setValue}
        errors={errors}
      />
    </SidePanel>
  );
}
