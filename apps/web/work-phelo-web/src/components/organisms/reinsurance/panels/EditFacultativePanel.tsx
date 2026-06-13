'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import FacultativeFormFields from '@/components/molecules/reinsurance/forms/FacultativeFormFields';
import {
  Facultative,
  FacultativeFormValues,
  FACULTATIVE_FORM_DEFAULTS,
  RiskType,
  RiskTypeField,
} from '@/types/reinsurance';
import { useUpdateFacultative, useRiskTypes } from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

interface EditFacultativePanelProps {
  isOpen: boolean;
  placement: Facultative;
  onClose: () => void;
}

function mergeRiskDetails(
  businessDetails: Record<string, unknown> | null,
  offerDetails: Record<string, unknown> | null,
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const [k, v] of Object.entries(businessDetails ?? {})) merged[k] = String(v ?? '');
  for (const [k, v] of Object.entries(offerDetails ?? {})) merged[k] = String(v ?? '');
  return merged;
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

function placementToFormValues(
  placement: Facultative,
  allRiskTypes: RiskType[],
): FacultativeFormValues {
  const selectedRiskType = allRiskTypes.find((rt) => rt.id === placement.riskTypeId);
  const schemaKeys = new Set(
    (selectedRiskType?.fields ?? []).filter((f) => f.isActive).map((f) => f.fieldKey),
  );

  const allDetails: Record<string, unknown> = {
    ...(placement.businessDetails ?? {}),
    ...(placement.offerDetails ?? {}),
  };
  const extraRiskFields = Object.entries(allDetails)
    .filter(([k]) => !schemaKeys.has(k))
    .map(([k, v]) => ({ label: k, value: String(v ?? '') }));

  return {
    ...FACULTATIVE_FORM_DEFAULTS,
    insuranceCompany: placement.cedant.id,
    riskType: placement.riskTypeId ?? '',
    reference: placement.reference,
    title: placement.title,
    sumInsured: placement.sumInsured ?? '',
    rate: placement.rate ?? '',
    premium: placement.premium ?? '',
    facultativeOffer: placement.facultativeOffer ?? '',
    commission: placement.commission ?? '',
    currency: placement.currency ?? '',
    periodFrom: placement.inceptionDate ?? '',
    periodTo: placement.expiryDate ?? '',
    riskDetails: mergeRiskDetails(placement.businessDetails, placement.offerDetails),
    extraRiskFields,
  };
}

export function EditFacultativePanel({ isOpen, placement, onClose }: EditFacultativePanelProps) {
  const { mutateAsync: updateFacultative } = useUpdateFacultative();
  const { data: allRiskTypes = [] } = useRiskTypes();

  const form = useForm<FacultativeFormValues>({
    defaultValues: placementToFormValues(placement, allRiskTypes),
  });

  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = form;

  useEffect(() => {
    if (isOpen) {
      reset(placementToFormValues(placement, allRiskTypes));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, placement, reset]);

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

      await updateFacultative({
        id: placement.id,
        riskTypeId: values.riskType || undefined,
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
        .addToast({ message: 'Placement updated successfully', type: 'success' });
      handleClose();
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Facultative Placement"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} isLoading={isSubmitting} loadingText="Saving…">
            Save Changes
          </Button>
        </div>
      }
    >
      <FacultativeFormFields form={form} />
    </SidePanel>
  );
}
