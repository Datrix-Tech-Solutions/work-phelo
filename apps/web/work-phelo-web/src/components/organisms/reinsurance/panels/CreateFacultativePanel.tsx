'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import FacultativeFormFields from '@/components/molecules/reinsurance/forms/FacultativeFormFields';
import { FacultativeFormValues, FACULTATIVE_FORM_DEFAULTS } from '@/types/reinsurance';
import { useCreateFacultative, useNextFacultativeReference, useRiskTypes } from '@/hooks';
import { extractError } from '@/lib/extractError';
import { normalizeComment, splitPlacementDetails } from '@/lib/reinsurance/placementFormDetails';
import { useToastStore } from '@/store/toast.store';

interface CreateFacultativePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateFacultativePanel({ isOpen, onClose }: CreateFacultativePanelProps) {
  const form = useForm<FacultativeFormValues>({
    defaultValues: FACULTATIVE_FORM_DEFAULTS,
  });

  const {
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting },
  } = form;

  const { mutateAsync: createFacultative } = useCreateFacultative();
  const { data: allRiskTypes = [] } = useRiskTypes();
  const { data: generatedReference } = useNextFacultativeReference(isOpen);

  useEffect(() => {
    if (isOpen && generatedReference) {
      setValue('reference', generatedReference);
    }
  }, [isOpen, generatedReference, setValue]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (values: FacultativeFormValues) => {
    try {
      const selectedRiskType = allRiskTypes.find((rt) => rt.id === values.riskType);
      const { businessDetails, offerDetails } = splitPlacementDetails(
        values.riskDetails,
        selectedRiskType?.fields ?? [],
        values.extraRiskFields ?? [],
      );

      await createFacultative({
        cedantId: values.insuranceCompany,
        riskTypeId: values.riskType,
        reference: values.reference,
        policyNumber: values.policyNumber || undefined,
        title: values.title,
        description: normalizeComment(values.comment),
        sumInsured: values.sumInsured as number,
        rate: values.rate as number,
        premium: values.premium as number,
        facultativeOffer: values.facultativeOffer as number,
        commission: values.commission as number,
        currency: values.currency,
        inceptionDate: values.periodFrom || undefined,
        expiryDate: values.periodTo || undefined,
        businessDetails,
        offerDetails,
      });
      useToastStore
        .getState()
        .addToast({ message: 'Placement created successfully', type: 'success' });
      handleClose();
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Facultative Placement Slip"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            isLoading={isSubmitting}
            disabled={!generatedReference}
            loadingText="Saving…"
          >
            Save
          </Button>
        </div>
      }
    >
      <FacultativeFormFields form={form} />
    </SidePanel>
  );
}
