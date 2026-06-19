'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import FacultativeFormFields from '@/components/molecules/reinsurance/forms/FacultativeFormFields';
import {
  FacultativeFormValues,
  FACULTATIVE_FORM_DEFAULTS,
  RiskTypeField,
} from '@/types/reinsurance';
import { useCreateFacultative, useRiskTypes } from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

interface CreateFacultativePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function splitRiskDetails(
  riskDetails: Record<string, string>,
  fields: RiskTypeField[],
  extraRiskFields: { label: string; value: string }[],
): {
  businessDetails: Record<string, unknown> | undefined;
  offerDetails: Record<string, unknown> | undefined;
} {
  const businessDetails: Record<string, unknown> = {};
  const offerDetails: Record<string, unknown> = {};

  for (const field of fields.filter((f) => f.isActive)) {
    const val = riskDetails[field.fieldKey];
    if (val === undefined || val === '') continue;
    if (field.section === 'BUSINESS_DETAILS') {
      businessDetails[field.fieldKey] = val;
    } else if (field.section === 'OFFER_DETAILS') {
      offerDetails[field.fieldKey] = val;
    }
  }

  for (const { label, value } of extraRiskFields) {
    if (label.trim() && value.trim()) {
      businessDetails[label.trim()] = value.trim();
    }
  }

  return {
    businessDetails: Object.keys(businessDetails).length ? businessDetails : undefined,
    offerDetails: Object.keys(offerDetails).length ? offerDetails : undefined,
  };
}

export function CreateFacultativePanel({ isOpen, onClose }: CreateFacultativePanelProps) {
  const form = useForm<FacultativeFormValues>({
    defaultValues: FACULTATIVE_FORM_DEFAULTS,
  });

  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = form;

  const { mutateAsync: createFacultative } = useCreateFacultative();
  const { data: allRiskTypes = [] } = useRiskTypes();

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (values: FacultativeFormValues) => {
    try {
      const selectedRiskType = allRiskTypes.find((rt) => rt.id === values.riskType);
      const { businessDetails, offerDetails } = splitRiskDetails(
        values.riskDetails,
        selectedRiskType?.fields ?? [],
        values.extraRiskFields ?? [],
      );

      await createFacultative({
        cedantId: values.insuranceCompany,
        riskTypeId: values.riskType,
        reference: values.reference,
        title: values.title,
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
          <Button onClick={handleSubmit(onSubmit)} isLoading={isSubmitting} loadingText="Saving…">
            Save
          </Button>
        </div>
      }
    >
      <FacultativeFormFields form={form} />
    </SidePanel>
  );
}
