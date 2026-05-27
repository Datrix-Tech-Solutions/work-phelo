'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { ReinsurerFormValues, REINSURER_FORM_DEFAULTS } from '@/types/reinsurance';
import { ReinsurerFormFields } from '@/components/molecules/reinsurance/ReinsurerFormFields';
import { useCreateReinsurer } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddReinsurancePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddReinsurancePanel({ isOpen, onClose }: AddReinsurancePanelProps) {
  const toast = useToast();
  const { mutateAsync: createReinsurer, isPending } = useCreateReinsurer();

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ReinsurerFormValues>({
    defaultValues: REINSURER_FORM_DEFAULTS,
  });

  const handleClose = () => {
    reset(REINSURER_FORM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: ReinsurerFormValues) => {
    try {
      await createReinsurer({
        name: data.name,
        emails: data.email.map((e) => e.value).filter(Boolean),
        phoneNumbers: data.phoneNumber.map((p) => p.value).filter(Boolean),
      });
      toast.success('Reinsurer created successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create reinsurer'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Reinsurer"
      description="Fill in the details to create a new reinsurer."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Reinsurer
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
