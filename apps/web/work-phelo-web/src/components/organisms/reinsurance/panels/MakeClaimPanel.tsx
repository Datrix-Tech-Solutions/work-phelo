'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import {
  MakeClaimFormFields,
  MakeClaimFormValues,
  MAKE_CLAIM_DEFAULTS,
} from '@/components/molecules/reinsurance/forms/MakeClaimFormFields';
import { useCreatePlacementClaim } from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { Facultative, PlacementClaim } from '@/types/reinsurance';

interface MakeClaimPanelProps {
  isOpen: boolean;
  onClose: () => void;
  placement?: Facultative;
  onSuccess?: (claim: PlacementClaim) => void;
}

export function MakeClaimPanel({ isOpen, onClose, placement, onSuccess }: MakeClaimPanelProps) {
  const form = useForm<MakeClaimFormValues>({ defaultValues: MAKE_CLAIM_DEFAULTS });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = form;

  const createClaim = useCreatePlacementClaim();
  const addToast = useToastStore((s) => s.addToast);

  const handleClose = () => {
    reset(MAKE_CLAIM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (values: MakeClaimFormValues) => {
    if (!placement) return;

    if (!placement.currency) {
      addToast({
        message: 'The placement must have a currency before recording a claim',
        type: 'error',
      });
      return;
    }

    try {
      const claim = await createClaim.mutateAsync({
        placementId: placement.id,
        occurrenceDate: new Date(`${values.occurrenceDate}T00:00:00.000Z`).toISOString(),
        reportedDate: new Date(`${values.reportedDate}T00:00:00.000Z`).toISOString(),
        claimCause: values.claimCause.trim(),
        ...(values.occurrenceDetails.trim()
          ? { occurrenceDetails: values.occurrenceDetails.trim() }
          : {}),
        currency: placement.currency,
        estimatedLossAmount: Number(values.estimatedLossAmount),
        ...(values.finalLossAmount ? { finalLossAmount: Number(values.finalLossAmount) } : {}),
      });

      addToast({ message: 'Claim recorded successfully', type: 'success' });
      onSuccess?.(claim);
      handleClose();
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Record Claim"
      description={placement ? `Loss event for ${placement.reference}` : 'Record a loss event'}
      footer={
        placement ? (
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              isLoading={isSubmitting}
              loadingText="Recording…"
              onClick={handleSubmit(onSubmit)}
            >
              Record Claim
            </Button>
          </div>
        ) : undefined
      }
    >
      {placement ? (
        <MakeClaimFormFields form={form} placement={placement} />
      ) : (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          Select a placement to record a claim
        </div>
      )}
    </SidePanel>
  );
}
