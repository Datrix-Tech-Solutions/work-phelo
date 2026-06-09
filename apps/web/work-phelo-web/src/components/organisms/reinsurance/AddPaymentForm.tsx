'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
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

  const form = useForm<AddPaymentFormValues>({ defaultValues: ADD_PAYMENT_DEFAULTS });
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = form;

  const onSubmit = async (values: AddPaymentFormValues) => {
    // TODO: call mutation once payments API is ready
    onPaymentRecorded?.(parseFloat(values.amount) || 0);

    const allocEntries = Object.entries(values.allocations ?? {});
    if (allocEntries.length > 0) {
      const parsed: Record<string, number> = {};
      allocEntries.forEach(([id, val]) => {
        parsed[id] = parseFloat(val) || 0;
      });
      onAllocationsRecorded?.(parsed);
    }

    setPanelOpen(false);
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
            <Button type="submit" form="add-payment-form" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Record Payment'}
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
