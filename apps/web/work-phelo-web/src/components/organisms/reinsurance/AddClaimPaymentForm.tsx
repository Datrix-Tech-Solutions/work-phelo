'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import {
  AddClaimPaymentFormFields,
  AddClaimPaymentFormValues,
  ADD_CLAIM_PAYMENT_DEFAULTS,
} from '@/components/molecules/reinsurance/forms/AddClaimPaymentFormFields';
import { useToastStore } from '@/store/toast.store';

interface AddClaimPaymentFormProps {
  onPlacementsChange?: (placementIds: string[]) => void;
  defaultOpen?: boolean;
}

export default function AddClaimPaymentForm({
  onPlacementsChange,
  defaultOpen = false,
}: AddClaimPaymentFormProps) {
  const [panelOpen, setPanelOpen] = useState(defaultOpen);

  const addToast = useToastStore((s) => s.addToast);

  const form = useForm<AddClaimPaymentFormValues>({ defaultValues: ADD_CLAIM_PAYMENT_DEFAULTS });
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = form;

  const onSubmit = async () => {
    addToast({
      message:
        'Claim settlement payments are deferred until the claims recovery settlement flow is implemented.',
      type: 'error',
    });
  };

  return (
    <>
      <Button onClick={() => setPanelOpen(true)}>Make Payment</Button>

      <SidePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        title="Record Claim Payment"
        description="Select the cedant and claim, then enter the payment details below."
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="add-claim-payment-form" disabled={isSubmitting}>
              Settlement Deferred
            </Button>
          </div>
        }
      >
        <form id="add-claim-payment-form" onSubmit={handleSubmit(onSubmit)}>
          <AddClaimPaymentFormFields
            form={form}
            onPlacementsChange={(ids) => {
              onPlacementsChange?.(ids);
            }}
          />
        </form>
      </SidePanel>
    </>
  );
}
