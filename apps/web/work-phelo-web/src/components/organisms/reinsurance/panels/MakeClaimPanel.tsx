'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import {
  MakeClaimFormFields,
  MakeClaimFormValues,
  MAKE_CLAIM_DEFAULTS,
} from '@/components/molecules/reinsurance/forms/MakeClaimFormFields';
import { useCreatePlacementClaim, useUpdatePlacementClaim } from '@/hooks';
import { api } from '@/lib/api';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { Facultative, PlacementClaim } from '@/types/reinsurance';

interface MakeClaimPanelProps {
  isOpen: boolean;
  onClose: () => void;
  placement?: Facultative;
  claim?: PlacementClaim;
  onSuccess?: () => void;
}

export function MakeClaimPanel({
  isOpen,
  onClose,
  placement,
  claim,
  onSuccess,
}: MakeClaimPanelProps) {
  const isEditing = !!claim;

  const form = useForm<MakeClaimFormValues>({ defaultValues: MAKE_CLAIM_DEFAULTS });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = form;

  const createClaim = useCreatePlacementClaim();
  const updateClaim = useUpdatePlacementClaim(placement?.id ?? '', claim?.id ?? '');
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    if (isOpen) {
      if (claim) {
        reset({
          estimatedLossAmount: claim.estimatedLossAmount,
          occurrenceDate: claim.occurrenceDate.split('T')[0],
          reportedDate: claim.reportedDate.split('T')[0],
          claimCause: claim.claimCause,
          occurrenceDetails: claim.occurrenceDetails ?? '',
          currency: claim.currency,
        });
      } else {
        reset({ ...MAKE_CLAIM_DEFAULTS, currency: placement?.currency ?? '' });
      }
    } else {
      reset(MAKE_CLAIM_DEFAULTS);
    }
  }, [isOpen, claim, placement, reset]);

  const handleClose = () => {
    reset(MAKE_CLAIM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (values: MakeClaimFormValues) => {
    if (!placement) return;

    const payload = {
      occurrenceDate: new Date(values.occurrenceDate).toISOString(),
      reportedDate: new Date().toISOString(),
      claimCause: values.claimCause,
      currency: values.currency,
      estimatedLossAmount: parseFloat(values.estimatedLossAmount),
    };

    try {
      if (isEditing) {
        await updateClaim.mutateAsync(payload);
      } else {
        const newClaim = await createClaim.mutateAsync({ placementId: placement.id, ...payload });
        await api.post(
          `/operations/reinsurance/placements/${placement.id}/claims/${newClaim.id}/allocations/generate`,
        );
      }
      addToast({
        message: `Claim ${isEditing ? 'updated' : 'submitted'} successfully`,
        type: 'success',
      });
      onSuccess?.();
      handleClose();
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? 'Edit Claim' : 'Make Claim'}
      description={placement ? `Claim for ${placement.reference}` : 'Submit a claim'}
      footer={
        placement ? (
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              isLoading={isSubmitting}
              loadingText={isEditing ? 'Updating…' : 'Submitting…'}
              onClick={handleSubmit(onSubmit)}
            >
              {isEditing ? 'Update Claim' : 'Submit Claim'}
            </Button>
          </div>
        ) : undefined
      }
    >
      {placement ? (
        <MakeClaimFormFields form={form} placement={placement} />
      ) : (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          Select a placement to make a claim
        </div>
      )}
    </SidePanel>
  );
}
