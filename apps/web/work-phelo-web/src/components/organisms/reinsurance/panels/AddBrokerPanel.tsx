'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { BROKER_FORM_DEFAULTS, BrokerFormValues } from '@/types/reinsurance';
import { BrokerFormFields } from '@/components/molecules/reinsurance/BrokerFormFields';
import { useCreateBroker } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddBrokerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddBrokerPanel({ isOpen, onClose }: AddBrokerPanelProps) {
  const toast = useToast();
  const { mutateAsync: createBroker, isPending } = useCreateBroker();

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<BrokerFormValues>({
    defaultValues: BROKER_FORM_DEFAULTS,
  });

  const handleClose = () => {
    reset(BROKER_FORM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: BrokerFormValues) => {
    try {
      await createBroker({
        name: data.name,
        emails: data.email.map((e) => e.value).filter(Boolean),
        phoneNumbers: data.phoneNumber.map((p) => p.value).filter(Boolean),
      });
      toast.success('Broker created successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create broker'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Broker"
      description="Fill in the details to create a new broker."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Broker
          </Button>
        </div>
      }
    >
      <BrokerFormFields control={control} register={register} setValue={setValue} errors={errors} />
    </SidePanel>
  );
}
