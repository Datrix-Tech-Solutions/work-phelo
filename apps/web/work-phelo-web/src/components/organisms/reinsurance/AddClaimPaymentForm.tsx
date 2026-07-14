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
import { useFacultatives, useCreatePlacementPayment } from '@/hooks';
import { extractError } from '@/lib/extractError';
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

  const { data: facultatives = [] } = useFacultatives();
  const createPayment = useCreatePlacementPayment();
  const addToast = useToastStore((s) => s.addToast);

  const form = useForm<AddClaimPaymentFormValues>({ defaultValues: ADD_CLAIM_PAYMENT_DEFAULTS });
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = form;

  const onSubmit = async (values: AddClaimPaymentFormValues) => {
    const selectedFacs = facultatives.filter((f) => values.businessIds.includes(f.id));
    if (selectedFacs.length === 0) return;

    const parsedAmount = parseFloat(values.amount) || 0;
    const hasAllocations = Object.keys(values.allocations).length > 0;

    const resolvedDate =
      values.paymentType === 'cheque'
        ? values.valueDate
        : values.paymentDate || new Date().toISOString();

    const refParts: string[] = [];
    if (values.chequeNumber) refParts.push(values.chequeNumber);
    if (values.bankName) refParts.push(values.bankName);
    const reference = refParts.join(' — ') || undefined;

    const notesStr = values.paymentType === 'cheque' ? 'Cheque payment' : 'Bank transfer';

    try {
      const calls = selectedFacs.map(async (f) => {
        let submittedAmount: number;
        if (selectedFacs.length === 1) {
          submittedAmount = parsedAmount;
        } else if (hasAllocations && values.allocations[f.id]) {
          submittedAmount = parseFloat(values.allocations[f.id]) || 0;
        } else {
          submittedAmount = parsedAmount / selectedFacs.length;
        }

        submittedAmount = Math.round(submittedAmount * 100) / 100;

        return createPayment.mutateAsync({
          placementId: f.id,
          type: 'CLAIM_SETTLEMENT',
          direction: 'OUTBOUND',
          counterpartyId: values.cedantId,
          amount: submittedAmount,
          currency: values.currency,
          paymentDate: new Date(resolvedDate).toISOString(),
          reference,
          notes: notesStr,
        });
      });

      await Promise.all(calls);

      onPlacementsChange?.([]);
      setPanelOpen(false);
      form.reset(ADD_CLAIM_PAYMENT_DEFAULTS);
      addToast({ message: 'Claim payment recorded successfully', type: 'success' });
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
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
              {isSubmitting ? 'Saving…' : 'Record Payment'}
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
