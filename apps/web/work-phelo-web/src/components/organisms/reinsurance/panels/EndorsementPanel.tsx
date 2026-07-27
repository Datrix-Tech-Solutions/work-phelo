'use client';

import { useEffect, useRef } from 'react';
import { useForm, UseFormReturn, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { FormSection } from '@/components/atoms/FormSection';
import FacultativeFormFields from '@/components/molecules/reinsurance/forms/FacultativeFormFields';
import { Facultative, FacultativeFormValues, FACULTATIVE_FORM_DEFAULTS } from '@/types/reinsurance';
import { useCreateEndorsement, useRiskTypes } from '@/hooks';
import { extractError } from '@/lib/extractError';
import {
  extractPlacementCustomFields,
  mergePlacementRiskDetails,
  splitPlacementDetails,
} from '@/lib/reinsurance/placementFormDetails';
import { useToastStore } from '@/store/toast.store';

type EndorsementFormValues = FacultativeFormValues & { effectiveDate: string };

interface EndorsementPanelProps {
  isOpen: boolean;
  placement: Facultative;
  onClose: () => void;
}

function placementToFormValues(placement: Facultative): EndorsementFormValues {
  return {
    ...FACULTATIVE_FORM_DEFAULTS,
    insuranceCompany: placement.cedant.id,
    riskType: placement.riskTypeId ?? '',
    reference: placement.reference,
    policyNumber: placement.policyNumber ?? '',
    title: placement.title,
    sumInsured: placement.sumInsured ?? '',
    rate: placement.rate ?? '',
    premium: placement.premium ?? '',
    facultativeOffer: placement.facultativeOffer ?? '',
    commission: placement.commission ?? '',
    currency: placement.currency ?? '',
    periodFrom: placement.inceptionDate ?? '',
    periodTo: placement.expiryDate ?? '',
    riskDetails: mergePlacementRiskDetails(placement.businessDetails, placement.offerDetails),
    extraRiskFields: extractPlacementCustomFields(
      placement.businessDetails,
      placement.offerDetails,
      new Set(),
    ),
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

  // Only reset when the panel transitions closed → open, not on every re-fetch of `placement`
  // while it's already open — otherwise unsaved edits (e.g. a newly added extra field) get
  // silently wiped by background query invalidations that happen on the same tab.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      reset(placementToFormValues(placement));
    }
    wasOpen.current = isOpen;
  }, [isOpen, placement, reset]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (values: EndorsementFormValues) => {
    try {
      const selectedRiskType = allRiskTypes.find((rt) => rt.id === values.riskType);
      const { businessDetails, offerDetails } = splitPlacementDetails(
        values.riskDetails,
        selectedRiskType?.fields ?? [],
        values.extraRiskFields ?? [],
      );

      const proposedSnapshot = {
        cedantId: values.insuranceCompany || undefined,
        riskTypeId: values.riskType || undefined,
        reference: values.reference,
        policyNumber: values.policyNumber,
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
          riskTypeId: proposedSnapshot.riskTypeId,
          cedantId: proposedSnapshot.cedantId,
          reference: proposedSnapshot.reference,
          policyNumber: proposedSnapshot.policyNumber,
          title: proposedSnapshot.title,
          sumInsured: proposedSnapshot.sumInsured,
          rate: proposedSnapshot.rate,
          premium: proposedSnapshot.premium,
          facultativeOffer: proposedSnapshot.facultativeOffer,
          commission: proposedSnapshot.commission,
          currency: proposedSnapshot.currency,
          inceptionDate: proposedSnapshot.inceptionDate,
          expiryDate: proposedSnapshot.expiryDate,
          ...(businessDetails ? { businessDetails } : {}),
          ...(offerDetails ? { offerDetails } : {}),
        },
        targetPercent:
          values.facultativeOffer === '' || values.facultativeOffer == null
            ? undefined
            : Number(values.facultativeOffer),
      });

      toast().addToast({
        message:
          'Endorsement created. The original placement remains unchanged until the endorsement is completed.',
        type: 'success',
      });
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
