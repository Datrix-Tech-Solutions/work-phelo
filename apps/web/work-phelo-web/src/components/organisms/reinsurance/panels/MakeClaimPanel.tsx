'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import {
  MakeClaimFormFields,
  MakeClaimFormValues,
  MAKE_CLAIM_DEFAULTS,
} from '@/components/molecules/reinsurance/forms/MakeClaimFormFields';
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

  const handleClose = () => {
    reset(MAKE_CLAIM_DEFAULTS);
    onClose();
  };

  const onSubmit = async () => {
    // TODO: wire to claim API when available
    onSuccess?.();
    handleClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={placement ? 'Make Claim' : 'Make Claim'}
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
