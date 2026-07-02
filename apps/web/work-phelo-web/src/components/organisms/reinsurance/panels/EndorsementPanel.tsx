'use client';

import { useEffect } from 'react';
import { useForm, UseFormReturn, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { FormSection } from '@/components/atoms/FormSection';
import FacultativeFormFields from '@/components/molecules/reinsurance/forms/FacultativeFormFields';
import {
  Facultative,
  FacultativeFormValues,
  FACULTATIVE_FORM_DEFAULTS,
  RiskTypeField,
} from '@/types/reinsurance';
import { useCreateEndorsement, useRiskTypes } from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

type EndorsementFormValues = FacultativeFormValues & { effectiveDate: string };

interface EndorsementPanelProps {
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
): {
  businessDetails: Record<string, unknown> | undefined;
  offerDetails: Record<string, unknown> | undefined;
} {
  const businessDetails: Record<string, unknown> = {};
  const offerDetails: Record<string, unknown> = {};
  for (const field of fields.filter((f) => f.isActive)) {
    const val = riskDetails[field.fieldKey];
    if (val === undefined || val === '') continue;
    if (field.section === 'BUSINESS_DETAILS') businessDetails[field.fieldKey] = val;
    else if (field.section === 'OFFER_DETAILS') offerDetails[field.fieldKey] = val;
  }
  return {
    businessDetails: Object.keys(businessDetails).length ? businessDetails : undefined,
    offerDetails: Object.keys(offerDetails).length ? offerDetails : undefined,
  };
}

function placementToFormValues(placement: Facultative): EndorsementFormValues {
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
    comment: '',
    effectiveDate: new Date().toISOString().split('T')[0],
  };
}

export function EndorsementPanel({ isOpen, placement, onClose }: EndorsementPanelProps) {
  const { mutateAsync: createEndorsement, isPending } = useCreateEndorsement(placement.id);
  const { data: allRiskTypes = [] } = useRiskTypes();
  const toast = useToastStore.getState;

  const form = useForm<EndorsementFormValues>({
    defaultValues: placementToFormValues(placement),
  });

  const {
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    if (isOpen) reset(placementToFormValues(placement));
  }, [isOpen, placement, reset]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (values: EndorsementFormValues) => {
    try {
      const selectedRiskType = allRiskTypes.find((rt) => rt.id === values.riskType);
      const { businessDetails, offerDetails } = splitRiskDetails(
        values.riskDetails,
        selectedRiskType?.fields ?? [],
      );

      const placementUpdate = {
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
      };

      await createEndorsement({
        type: 'POLICY_AMENDMENT',
        effectiveDate: new Date(values.effectiveDate).toISOString(),
        reason: values.comment?.trim() || 'Policy endorsement',
        proposedSnapshot: {
          riskTypeId: placementUpdate.riskTypeId,
          reference: placementUpdate.reference,
          title: placementUpdate.title,
          sumInsured: placementUpdate.sumInsured,
          rate: placementUpdate.rate,
          premium: placementUpdate.premium,
          facultativeOffer: placementUpdate.facultativeOffer,
          commission: placementUpdate.commission,
          currency: placementUpdate.currency,
          inceptionDate: placementUpdate.inceptionDate,
          expiryDate: placementUpdate.expiryDate,
          ...(businessDetails ? { businessDetails } : {}),
          ...(offerDetails ? { offerDetails } : {}),
        },
      });

      toast().addToast({ message: 'Endorsement created successfully', type: 'success' });
      handleClose();
    } catch (error) {
      toast().addToast({ message: extractError(error), type: 'error' });
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Endorse Bound Policy"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} isLoading={isPending} loadingText="Saving…">
            Create Endorsement
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-7">
        <FormSection title="Endorsement Details">
          <Controller
            name="effectiveDate"
            control={control}
            rules={{ required: 'Effective date is required' }}
            render={({ field }) => (
              <DatePicker
                label="Effective Date"
                value={field.value}
                onChange={field.onChange}
                error={errors.effectiveDate?.message}
              />
            )}
          />
        </FormSection>

        <FacultativeFormFields
          form={form as unknown as UseFormReturn<FacultativeFormValues>}
          commentLabel="Reason for Endorsement"
        />
      </div>
    </SidePanel>
  );
}
