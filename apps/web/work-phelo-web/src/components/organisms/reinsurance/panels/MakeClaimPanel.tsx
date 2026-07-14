'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  MakeClaimFormFields,
  MakeClaimFormValues,
  MAKE_CLAIM_DEFAULTS,
} from '@/components/molecules/reinsurance/forms/MakeClaimFormFields';
import { useCreatePlacementClaim, useUpdatePlacementClaim, useFacultatives } from '@/hooks';
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
  /** Fires as the user narrows down a placement in the built-in picker (only used when `placement` isn't passed in). */
  onPlacementChange?: (placementId: string) => void;
}

export function MakeClaimPanel({
  isOpen,
  onClose,
  placement,
  claim,
  onSuccess,
  onPlacementChange,
}: MakeClaimPanelProps) {
  const isEditing = !!claim;
  const showPicker = !placement;

  const { data: facultatives = [] } = useFacultatives();
  const [cedantId, setCedantId] = useState('');
  const [businessId, setBusinessId] = useState('');

  const pickedPlacement = useMemo(
    () => facultatives.find((f) => f.id === businessId),
    [facultatives, businessId],
  );
  const effectivePlacement = placement ?? pickedPlacement;

  const cedantOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const f of facultatives) {
      if (f.status !== 'CANCELLED') seen.set(f.cedant.id, f.cedant.name);
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [facultatives]);

  const businessOptions = useMemo(
    () =>
      facultatives
        .filter((f) => f.cedant.id === cedantId && f.status !== 'CANCELLED')
        .map((f) => ({
          value: f.id,
          label: f.policyNumber ?? f.reference,
          sublabel: [f.classOfBusiness, f.title].filter(Boolean).join(' · '),
        })),
    [facultatives, cedantId],
  );

  const form = useForm<MakeClaimFormValues>({ defaultValues: MAKE_CLAIM_DEFAULTS });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = form;

  const createClaim = useCreatePlacementClaim();
  const updateClaim = useUpdatePlacementClaim(effectivePlacement?.id ?? '', claim?.id ?? '');
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
        reset({ ...MAKE_CLAIM_DEFAULTS, currency: effectivePlacement?.currency ?? '' });
      }
    } else {
      reset(MAKE_CLAIM_DEFAULTS);
      if (showPicker) {
        setCedantId('');
        setBusinessId('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, claim, reset]);

  const handleClose = () => {
    reset(MAKE_CLAIM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (values: MakeClaimFormValues) => {
    if (!effectivePlacement) return;

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
        const newClaim = await createClaim.mutateAsync({
          placementId: effectivePlacement.id,
          ...payload,
        });
        await api.post(
          `/operations/reinsurance/placements/${effectivePlacement.id}/claims/${newClaim.id}/allocations/generate`,
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
      description={
        effectivePlacement ? `Claim for ${effectivePlacement.reference}` : 'Submit a claim'
      }
      footer={
        effectivePlacement ? (
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
      {showPicker && (
        <div className="flex flex-col gap-5 mb-5">
          <SearchSelect
            label="Cedant"
            placeholder="Select cedant…"
            options={cedantOptions}
            value={cedantId}
            onChange={(val) => {
              setCedantId(val);
              setBusinessId('');
              onPlacementChange?.('');
            }}
          />
          {cedantId && (
            <SearchSelect
              label="Business"
              placeholder="Select business…"
              options={businessOptions}
              value={businessId}
              onChange={(val) => {
                setBusinessId(val);
                onPlacementChange?.(val);
              }}
            />
          )}
          {effectivePlacement && <hr className="border-gray-100" />}
        </div>
      )}

      {effectivePlacement && (
        <MakeClaimFormFields
          form={form}
          placement={effectivePlacement}
          hidePlacementInfo={showPicker}
        />
      )}
    </SidePanel>
  );
}
