'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { useCreateEntityType } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddEntityTypePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type FormValues = {
  name: string;
};

const DEFAULTS: FormValues = { name: '' };

export function AddEntityTypePanel({ isOpen, onClose }: AddEntityTypePanelProps) {
  const toast = useToast();
  const { mutateAsync: createEntityType, isPending } = useCreateEntityType();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    try {
      // Accounting relation isn't captured here — new types default to NONE until it's set
      // some other way (there's no edit flow for entity types yet).
      await createEntityType({ name: values.name, accountingRelation: 'NONE' });
      toast.success('Type created successfully');
      handleClose();
    } catch (error) {
      toast.error(extractError(error, 'Failed to create type'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Type"
      description="Define a new entity type available in the Type field."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Adding…" onClick={handleSubmit(onSubmit)}>
            Add Type
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <FormField
          label="Name"
          registration={register('name', { required: 'Name is required' })}
          error={errors.name}
          placeholder="e.g. Landlord"
        />
      </div>
    </SidePanel>
  );
}
