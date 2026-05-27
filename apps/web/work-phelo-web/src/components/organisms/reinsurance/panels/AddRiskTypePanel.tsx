'use client';

import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { RiskTypeFormValues, RISK_TYPE_FORM_DEFAULTS } from '@/types/reinsurance';
import { useCreateRiskType, useRiskClassOptions } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddRiskTypePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddRiskTypePanel({ isOpen, onClose }: AddRiskTypePanelProps) {
  const toast = useToast();
  const { mutateAsync: createRiskType, isPending } = useCreateRiskType();
  const { data: riskClassOptions = [] } = useRiskClassOptions();

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<RiskTypeFormValues>({
    defaultValues: RISK_TYPE_FORM_DEFAULTS,
  });

  const riskClassId = useWatch({ control, name: 'riskClassId' });

  const handleClose = () => {
    reset(RISK_TYPE_FORM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: RiskTypeFormValues) => {
    try {
      await createRiskType({ name: data.name, riskClassId: data.riskClassId });
      toast.success('Risk type created successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create risk type'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Risk Type"
      description="Create a new risk type and assign it to a risk class."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Risk Type
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Risk Type Name"
          registration={register('name', { required: 'Risk type name is required' })}
          error={errors.name}
          placeholder="e.g. Fire & Allied Perils"
        />

        <SearchSelect
          label="Risk Class"
          placeholder="Select a risk class…"
          value={riskClassId}
          onChange={(v) => setValue('riskClassId', v)}
          options={riskClassOptions}
          error={errors.riskClassId?.message}
        />
      </div>
    </SidePanel>
  );
}
