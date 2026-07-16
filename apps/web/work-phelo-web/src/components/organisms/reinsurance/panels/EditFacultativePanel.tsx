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
} from '@/types/reinsurance';
import { useUpdateFacultative, useUpdateFacultativeStatus, useRiskTypes } from '@/hooks';
import { extractError } from '@/lib/extractError';
import {
  extractPlacementCustomFields,
  mergePlacementRiskDetails,
  splitPlacementDetails,
} from '@/lib/reinsurance/placementFormDetails';
import { useToastStore } from '@/store/toast.store';

interface EditFacultativePanelProps {
  isOpen: boolean;
  placement: Facultative;
  onClose: () => void;
  mode?: 'edit' | 'reopen';
}

function placementToFormValues(
  placement: Facultative,
  allRiskTypes: RiskType[],
): FacultativeFormValues {
  const selectedRiskType = allRiskTypes.find((rt) => rt.id === placement.riskTypeId);
  const schemaKeys = new Set(
    (selectedRiskType?.fields ?? []).filter((f) => f.isActive).map((f) => f.fieldKey),
  );

  const extraRiskFields = extractPlacementCustomFields(
    placement.businessDetails,
    placement.offerDetails,
    schemaKeys,
  );

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
    comment: placement.description ?? '',
    riskDetails: mergePlacementRiskDetails(placement.businessDetails, placement.offerDetails),
    extraRiskFields,
  };
}

export function EditFacultativePanel({
  isOpen,
  placement,
  onClose,
  mode = 'edit',
}: EditFacultativePanelProps) {
  const isReopen = mode === 'reopen';
  const { mutateAsync: updateFacultative } = useUpdateFacultative();
  const { mutateAsync: updateFacultativeStatus } = useUpdateFacultativeStatus(placement.id);
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
      // Reopening moves the placement out of its terminal PLACED/CLOSED status first — a
      // CLOSED placement can't have its fields edited directly until it's out of that status.
      if (isReopen) {
        await updateFacultativeStatus({ status: 'CLOSING' });
      }

      const selectedRiskType = allRiskTypes.find((rt) => rt.id === values.riskType);
      const { businessDetails, offerDetails } = splitPlacementDetails(
        values.riskDetails,
        selectedRiskType?.fields ?? [],
        values.extraRiskFields ?? [],
      );

      await updateFacultative({
        id: placement.id,
        riskTypeId: values.riskType || undefined,
        reference: values.reference,
        title: values.title,
        description: values.comment,
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
      useToastStore.getState().addToast({
        message: isReopen ? 'Offer reopened for editing' : 'Placement updated successfully',
        type: 'success',
      });
      handleClose();
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={isReopen ? 'Reopen Facultative Placement' : 'Edit Facultative Placement'}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            isLoading={isSubmitting}
            loadingText={isReopen ? 'Reopening…' : 'Saving…'}
          >
            {isReopen ? 'Reopen Offer' : 'Save Changes'}
          </Button>
        </div>
      }
    >
      <FacultativeFormFields form={form} />
    </SidePanel>
  );
}
