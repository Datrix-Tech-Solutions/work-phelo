'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { CedantFormFields } from '@/components/molecules/reinsurance/CedantFormFields';
import { CedantFormValues, CEDANT_FORM_DEFAULTS } from '@/types/reinsurance';

interface AddCedantPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddCedantPanel({ isOpen, onClose }: AddCedantPanelProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CedantFormValues>({
    defaultValues: CEDANT_FORM_DEFAULTS,
  });

  const handleClose = () => {
    reset(CEDANT_FORM_DEFAULTS);
    onClose();
  };

  const onSubmit = (data: CedantFormValues) => {
    // TODO: call useCreateCedant() mutation once API is ready
    console.log('Create cedant:', data);
    handleClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Cedant"
      description="Fill in the details to create a new cedant."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save Cedant'}
          </Button>
        </div>
      }
    >
      <CedantFormFields control={control} register={register} setValue={setValue} errors={errors} />
    </SidePanel>
  );
}
