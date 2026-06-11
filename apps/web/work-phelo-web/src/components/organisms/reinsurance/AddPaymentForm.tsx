'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { useCreatePlacementPayment, useFacultatives } from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import {
  AddPaymentFormFields,
  AddPaymentFormValues,
  ADD_PAYMENT_DEFAULTS,
} from '@/components/molecules/reinsurance/forms/AddPaymentFormFields';

interface AddPaymentFormProps {
  placementId?: string;
  onPaymentRecorded?: (amount: number) => void;
  onAllocationsRecorded?: (allocations: Record<string, number>) => void;
  onPlacementsChange?: (placementIds: string[]) => void;
  defaultOpen?: boolean;
}

export default function AddPaymentForm({
  placementId,
  onPaymentRecorded,
  onAllocationsRecorded,
  onPlacementsChange,
  defaultOpen = false,
}: AddPaymentFormProps) {
  const [panelOpen, setPanelOpen] = useState(defaultOpen);
  const { data: facultatives = [] } = useFacultatives();
  const { mutateAsync: createPayment, isPending } = useCreatePlacementPayment(placementId);
  const toast = useToastStore.getState;

  const form = useForm<AddPaymentFormValues>({ defaultValues: ADD_PAYMENT_DEFAULTS });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = form;

  const onSubmit = async (values: AddPaymentFormValues) => {
    try {
      const selectedIds =
        values.businessIds.length > 0 ? values.businessIds : placementId ? [placementId] : [];
      const selectedPlacements = selectedIds
        .map((id) => facultatives.find((placement) => placement.id === id))
        .filter(Boolean);

      if (selectedPlacements.length === 0) {
        throw new Error('Select at least one placement to record payment against.');
      }

      const parsedAllocations: Record<string, number> = {};
      const totalAmount = parseFloat(values.amount) || 0;
      if (totalAmount <= 0) {
        throw new Error('Payment amount must be greater than zero.');
      }

      selectedPlacements.forEach((placement) => {
        const allocated = parseFloat(values.allocations?.[placement!.id] ?? '');
        parsedAllocations[placement!.id] =
          !Number.isNaN(allocated) && allocated > 0
            ? allocated
            : selectedPlacements.length === 1
              ? totalAmount
              : totalAmount / selectedPlacements.length;
      });

      const currencyMismatch = selectedPlacements.find(
        (placement) =>
          placement?.currency && values.currency && placement.currency !== values.currency,
      );
      if (currencyMismatch) {
        throw new Error('Payment currency must match each placement currency for this MVP.');
      }

      if (!values.currency && selectedPlacements.some((placement) => !placement?.currency)) {
        throw new Error('Currency is required to record a payment.');
      }

      const reference =
        values.paymentType === 'cheque'
          ? values.chequeNumber || undefined
          : values.bankName || undefined;
      const notes = [
        `Payment method: ${values.paymentType.replace('_', ' ')}`,
        values.bankName ? `Bank: ${values.bankName}` : null,
        values.chequeNumber ? `Cheque: ${values.chequeNumber}` : null,
      ]
        .filter(Boolean)
        .join(' | ');
      const paymentDate = values.valueDate
        ? new Date(values.valueDate).toISOString()
        : new Date().toISOString();

      await Promise.all(
        selectedPlacements.map((placement) =>
          createPayment({
            placementId: placement!.id,
            payload: {
              type: 'PREMIUM_RECEIVED',
              direction: 'INBOUND',
              counterpartyId: placement!.cedant.id,
              amount: parsedAllocations[placement!.id],
              currency: placement!.currency ?? values.currency,
              paymentDate,
              reference,
              notes,
            },
          }),
        ),
      );

      onPaymentRecorded?.(totalAmount);
      onAllocationsRecorded?.(parsedAllocations);
      toast().addToast({ message: 'Payment recorded successfully', type: 'success' });
      reset(ADD_PAYMENT_DEFAULTS);
      setPanelOpen(false);
    } catch (error) {
      toast().addToast({ message: extractError(error), type: 'error' });
    }
  };

  return (
    <>
      <Button onClick={() => setPanelOpen(true)}>Record Payment</Button>

      <SidePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        title="Record Payment"
        description="Enter the payment details below."
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-payment-form"
              disabled={isSubmitting || isPending}
              isLoading={isSubmitting || isPending}
              loadingText="Saving…"
            >
              Record Payment
            </Button>
          </div>
        }
      >
        <form id="add-payment-form" onSubmit={handleSubmit(onSubmit)}>
          <AddPaymentFormFields
            form={form}
            placementId={placementId}
            onPlacementsChange={onPlacementsChange}
          />
        </form>
      </SidePanel>
    </>
  );
}
