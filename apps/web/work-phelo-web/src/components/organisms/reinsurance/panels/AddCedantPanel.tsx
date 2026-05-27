'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { CedantFormFields } from '@/components/molecules/reinsurance/CedantFormFields';
import { CedantFormValues, CEDANT_FORM_DEFAULTS } from '@/types/reinsurance';
import { useCreateCedant } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddCedantPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddCedantPanel({ isOpen, onClose }: AddCedantPanelProps) {
  const toast = useToast();
  const { mutateAsync: createCedant, isPending } = useCreateCedant();

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CedantFormValues>({
    defaultValues: CEDANT_FORM_DEFAULTS,
  });

  const handleClose = () => {
    reset(CEDANT_FORM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: CedantFormValues) => {
    try {
      await createCedant({
        name: data.name,
        emails: data.emails.map((e) => e.value).filter(Boolean),
        phoneNumbers: data.phoneNumbers.map((p) => p.value).filter(Boolean),
      });
      toast.success('Cedant created successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create cedant'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Cedant"
      description="Fill in the details to create a new cedant."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Cedant
          </Button>
        </div>
      }
    >
      <CedantFormFields control={control} register={register} setValue={setValue} errors={errors} />
    </SidePanel>
  );
}
