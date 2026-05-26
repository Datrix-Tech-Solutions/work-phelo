'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { BROKER_FORM_DEFAULTS, BrokerFormValues } from '@/types/reinsurance';
import { BrokerFormFields } from '@/components/molecules/reinsurance/BrokerFormFields';

interface AddBrokerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddBrokerPanel({ isOpen, onClose }: AddBrokerPanelProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BrokerFormValues>({
    defaultValues: BROKER_FORM_DEFAULTS,
  });

  const handleClose = () => {
    reset(BROKER_FORM_DEFAULTS);
    onClose();
  };

  const onSubmit = (data: BrokerFormValues) => {
    // TODO: call useCreateCedant() mutation once API is ready
    console.log('Create broker:', data);
    handleClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Broker"
      description="Fill in the details to create a new broker."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save Broker'}
          </Button>
        </div>
      }
    >
      <BrokerFormFields control={control} register={register} setValue={setValue} errors={errors} />
    </SidePanel>
  );
}
