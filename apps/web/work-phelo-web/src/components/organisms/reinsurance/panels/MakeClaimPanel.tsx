'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import {
  MakeClaimFormFields,
  MakeClaimFormValues,
  MAKE_CLAIM_DEFAULTS,
} from '@/components/molecules/reinsurance/forms/MakeClaimFormFields';
import { usePlacementClosings, useCreatePlacementPayment } from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { Facultative } from '@/types/reinsurance';

interface MakeClaimPanelProps {
  isOpen: boolean;
  onClose: () => void;
  placement?: Facultative;
  onSuccess?: () => void;
}

export function MakeClaimPanel({ isOpen, onClose, placement, onSuccess }: MakeClaimPanelProps) {
  const form = useForm<MakeClaimFormValues>({ defaultValues: MAKE_CLAIM_DEFAULTS });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = form;

  const { data: closings = [] } = usePlacementClosings(placement?.id ?? '');
  const createPayment = useCreatePlacementPayment();
  const addToast = useToastStore((s) => s.addToast);

  const handleClose = () => {
    reset(MAKE_CLAIM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (values: MakeClaimFormValues) => {
    if (!placement) return;

    const acceptedReinsurers = (placement.participants ?? []).filter(
      (p) => p.role !== 'BROKER' && p.status === 'ACCEPTED',
    );

    if (acceptedReinsurers.length === 0) {
      addToast({ message: 'No accepted reinsurers found for this placement', type: 'error' });
      return;
    }

    const closingByParticipantId = Object.fromEntries(closings.map((c) => [c.participantId, c.id]));

    const claimAmount = parseFloat(values.claimAmount) || 0;
    const rate = values.rate ? parseFloat(values.rate) : 1;
    const paymentCurrency = values.currency || placement.currency;
    const placementCurrency = placement.currency ?? values.currency;
    const needsConversion = !!values.rate && paymentCurrency !== placementCurrency;

    try {
      await Promise.all(
        acceptedReinsurers.map((participant) => {
          const share =
            participant.sharePercent != null ? parseFloat(participant.sharePercent) / 100 : 0;
          const rawAmount = share * claimAmount;
          const submittedAmount = needsConversion
            ? Math.round(rawAmount * rate * 100) / 100
            : Math.round(rawAmount * 100) / 100;

          const closingId = closingByParticipantId[participant.id];

          return createPayment.mutateAsync({
            placementId: placement.id,
            type: 'CLAIM_SETTLEMENT',
            direction: 'INBOUND',
            counterpartyId: participant.counterpartyId,
            ...(closingId ? { closingId } : {}),
            participantId: participant.id,
            amount: submittedAmount,
            currency: placementCurrency ?? paymentCurrency,
            paymentDate: new Date(values.claimDate).toISOString(),
            ...(values.claimCause ? { notes: values.claimCause } : {}),
          });
        }),
      );

      addToast({ message: 'Claim submitted successfully', type: 'success' });
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
      title="Make Claim"
      description={placement ? `Claim for ${placement.reference}` : 'Submit a claim'}
      footer={
        placement ? (
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              isLoading={isSubmitting}
              loadingText="Submitting…"
              onClick={handleSubmit(onSubmit)}
            >
              Submit Claim
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
