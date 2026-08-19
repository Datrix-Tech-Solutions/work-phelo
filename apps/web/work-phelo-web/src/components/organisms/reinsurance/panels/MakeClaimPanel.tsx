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
import {
  useCreatePlacementClaim,
  useUpdatePlacementClaim,
  useClaimAllocations,
  useGenerateClaimAllocations,
  useGenerateClaimAllocationsMutation,
  useFacultatives,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { Facultative, PlacementClaim } from '@/types/reinsurance';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

interface MakeClaimPanelProps {
  isOpen: boolean;
  onClose: () => void;
  placement?: Facultative;
  claim?: PlacementClaim;
  onSuccess?: (claim: PlacementClaim) => void;
  onPlacementChange?: (placementId: string) => void;

  mode?: 'notification' | 'actual';
}

export function MakeClaimPanel({
  isOpen,
  onClose,
  placement,
  claim,
  onSuccess,
  onPlacementChange,
  mode = 'notification',
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
          label: displayPolicyNumber(f.policyNumber),
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
  const { data: existingAllocations = [] } = useClaimAllocations(
    effectivePlacement?.id ?? '',
    claim?.id ?? '',
  );
  const generateAllocations = useGenerateClaimAllocations(
    effectivePlacement?.id ?? '',
    claim?.id ?? '',
  );
  const generateAllocationsForClaim = useGenerateClaimAllocationsMutation();
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    if (isOpen) {
      if (claim) {
        reset({
          ...MAKE_CLAIM_DEFAULTS,
          estimatedLossAmount: claim.estimatedLossAmount,
          finalLossAmount: claim.finalLossAmount ?? '',
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

    const isActualCreate = mode === 'actual' && !isEditing;
    const amount = isActualCreate ? values.finalLossAmount : values.estimatedLossAmount;

    // Claims are always recorded in the placement's own currency — sum-insured checks and
    // allocations downstream all assume that. Picking a different currency just means the
    // amounts entered need converting via the rate before anything is sent.
    const businessCurrency = effectivePlacement.currency ?? values.currency;
    const needsConversion = values.currency !== businessCurrency;
    const rate = needsConversion ? parseFloat(values.rate) || 1 : 1;
    const convert = (raw: string) => {
      const parsed = parseFloat(raw);
      if (isNaN(parsed)) return parsed;
      return needsConversion ? Math.round(parsed * rate * 100) / 100 : parsed;
    };

    const payload = {
      occurrenceDate: new Date(values.occurrenceDate).toISOString(),
      reportedDate: new Date().toISOString(),
      claimCause: values.claimCause,
      currency: businessCurrency,
      estimatedLossAmount: convert(amount),
    };

    try {
      let allocationsGenerated = false;

      if (isEditing) {
        const updatedClaim = await updateClaim.mutateAsync({
          ...payload,
          finalLossAmount: values.finalLossAmount ? convert(values.finalLossAmount) : undefined,
        });
        onSuccess?.(updatedClaim);

        if (values.finalLossAmount && existingAllocations.length === 0) {
          try {
            await generateAllocations.mutateAsync();
            allocationsGenerated = true;
          } catch (allocationError) {
            addToast({
              message: `Claim updated, but allocations could not be generated: ${extractError(allocationError)}`,
              type: 'error',
            });
          }
        }
      } else {
        const newClaim = await createClaim.mutateAsync({
          placementId: effectivePlacement.id,
          ...payload,
          finalLossAmount: isActualCreate ? convert(amount) : undefined,
        });
        onSuccess?.(newClaim);

        if (isActualCreate) {
          try {
            await generateAllocationsForClaim.mutateAsync({
              placementId: effectivePlacement.id,
              claimId: newClaim.id,
            });
            allocationsGenerated = true;
          } catch (allocationError) {
            addToast({
              message: `Claim created, but allocations could not be generated: ${extractError(allocationError)}`,
              type: 'error',
            });
          }
        }
      }
      addToast({
        message: `Claim ${isEditing ? 'updated' : 'submitted'} successfully${
          allocationsGenerated ? ' — allocations generated' : ''
        }`,
        type: 'success',
      });
      handleClose();
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? 'Edit Claim' : mode === 'actual' ? 'Add Claim' : 'Make Claim'}
      description={
        effectivePlacement
          ? `Claim for ${displayPolicyNumber(effectivePlacement.policyNumber)}`
          : 'Submit a claim'
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
              {isEditing ? 'Update Claim' : mode === 'actual' ? 'Add Claim' : 'Submit Claim'}
            </Button>
          </div>
        ) : undefined
      }
    >
      {showPicker && (
        <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
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
          isEditing={isEditing}
          mode={mode}
        />
      )}
    </SidePanel>
  );
}
