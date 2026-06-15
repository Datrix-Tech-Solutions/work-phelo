'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import {
  AddPaymentFormFields,
  AddPaymentFormValues,
  ADD_PAYMENT_DEFAULTS,
} from '@/components/molecules/reinsurance/forms/AddPaymentFormFields';
import {
  useFacultatives,
  useCreatePlacementPayment,
  useFacultativePlacement,
  usePlacementClosingEligibility,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { Facultative, PlacementPayment } from '@/types/reinsurance';
import { PaymentReceiptModal } from '@/components/organisms/reinsurance/documents/PaymentReceiptModal';

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
  const [receiptPrompt, setReceiptPrompt] = useState<{
    payment: PlacementPayment;
    placement: Facultative;
  } | null>(null);
  const [receiptData, setReceiptData] = useState<{
    payment: PlacementPayment;
    placement: Facultative;
  } | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const { data: facultatives = [] } = useFacultatives();
  const { data: singlePlacement } = useFacultativePlacement(placementId ?? '');
  const createPayment = useCreatePlacementPayment();
  const addToast = useToastStore((s) => s.addToast);

  const form = useForm<AddPaymentFormValues>({ defaultValues: ADD_PAYMENT_DEFAULTS });
  const selectedPlacementIds = useWatch({ control: form.control, name: 'businessIds' });
  const selectedCedantId = useWatch({ control: form.control, name: 'cedantId' });
  const eligiblePlacementIds = placementId
    ? [placementId]
    : facultatives
        .filter(
          (placement) =>
            placement.status !== 'CANCELLED' && placement.cedant.id === selectedCedantId,
        )
        .map((placement) => placement.id);
  const { confirmedPlacementIds, isLoading: isClosingEligibilityLoading } =
    usePlacementClosingEligibility(eligiblePlacementIds);
  const hasConfirmedClosings =
    selectedPlacementIds.length > 0 &&
    selectedPlacementIds.every((id) => confirmedPlacementIds.has(id));
  const isClosingBlocked =
    selectedPlacementIds.length > 0 && !isClosingEligibilityLoading && !hasConfirmedClosings;

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = form;

  const onSubmit = async (values: AddPaymentFormValues) => {
    if (
      values.businessIds.length === 0 ||
      values.businessIds.some((id) => !confirmedPlacementIds.has(id))
    ) {
      addToast({
        message: 'At least one confirmed closing is required before recording payment.',
        type: 'error',
      });
      return;
    }

    const selectedFacs = facultatives.filter((f) => values.businessIds.includes(f.id));
    if (selectedFacs.length === 0) return;

    const parsedAmount = parseFloat(values.amount) || 0;
    const hasAllocations = Object.keys(values.allocations).length > 0;

    const totalNetPremium = selectedFacs.reduce((sum, f) => {
      const facPremium = ((f.facultativeOffer ?? 0) / 100) * (f.premium ?? 0);
      return sum + facPremium * (1 - (f.commission ?? 0) / 100);
    }, 0);

    const allSameCurrency =
      selectedFacs.length <= 1 ||
      selectedFacs.every((f) => f.currency === selectedFacs[0].currency);

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
        let rawAmount: number;
        if (selectedFacs.length === 1) {
          rawAmount = parsedAmount;
        } else if (hasAllocations && values.allocations[f.id]) {
          rawAmount = parseFloat(values.allocations[f.id]) || 0;
        } else {
          const facPremium = ((f.facultativeOffer ?? 0) / 100) * (f.premium ?? 0);
          const netPremium = facPremium * (1 - (f.commission ?? 0) / 100);
          const proportion =
            totalNetPremium > 0 ? netPremium / totalNetPremium : 1 / selectedFacs.length;
          rawAmount = proportion * parsedAmount;
        }

        const paymentCurrency = values.currency;
        const placementCurrency = f.currency ?? values.currency;
        let submittedAmount = rawAmount;

        if (paymentCurrency !== placementCurrency) {
          const rateStr = allSameCurrency
            ? values.rate
            : (values.allocationRates[f.id] ?? values.rate);
          const rate = parseFloat(rateStr) || 1;
          submittedAmount = rawAmount * rate;
        }

        submittedAmount = Math.round(submittedAmount * 100) / 100;

        return createPayment.mutateAsync({
          placementId: f.id,
          type: 'PREMIUM_RECEIVED',
          direction: 'INBOUND',
          counterpartyId: values.cedantId,
          amount: submittedAmount,
          currency: placementCurrency,
          paymentDate: new Date(resolvedDate).toISOString(),
          reference,
          notes: notesStr,
        });
      });

      const results = await Promise.all(calls);

      onPaymentRecorded?.(parsedAmount);

      const allocEntries = Object.entries(values.allocations ?? {});
      if (allocEntries.length > 0) {
        const parsed: Record<string, number> = {};
        allocEntries.forEach(([id, val]) => {
          parsed[id] = parseFloat(val) || 0;
        });
        onAllocationsRecorded?.(parsed);
      }

      setPanelOpen(false);
      form.reset(ADD_PAYMENT_DEFAULTS);

      // Offer receipt generation when placement context is available
      const firstPayment = results[0];
      const receiptPlacement = singlePlacement ?? selectedFacs[0];
      if (firstPayment && receiptPlacement) {
        setReceiptPrompt({ payment: firstPayment, placement: receiptPlacement });
      } else {
        addToast({ message: 'Payment recorded successfully', type: 'success' });
      }
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  const handleGenerateReceipt = () => {
    if (receiptPrompt) setReceiptData(receiptPrompt);
    setReceiptPrompt(null);
    setReceiptOpen(true);
  };

  const handleLater = () => {
    addToast({ message: 'Payment recorded successfully', type: 'success' });
    setReceiptPrompt(null);
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
              disabled={isSubmitting || isClosingEligibilityLoading || isClosingBlocked}
              title={
                isClosingBlocked
                  ? 'At least one confirmed closing is required before recording payment.'
                  : undefined
              }
            >
              {isSubmitting ? 'Saving…' : 'Record Payment'}
            </Button>
          </div>
        }
      >
        <form id="add-payment-form" onSubmit={handleSubmit(onSubmit)}>
          {isClosingBlocked && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              At least one confirmed closing is required before recording payment.
            </div>
          )}
          <AddPaymentFormFields
            form={form}
            placementId={placementId}
            onPlacementsChange={onPlacementsChange}
            confirmedClosingPlacementIds={confirmedPlacementIds}
          />
        </form>
      </SidePanel>

      {/* Receipt prompt popup */}
      <Modal
        isOpen={!!receiptPrompt}
        onClose={handleLater}
        title="Generate Receipt"
        description="Payment recorded successfully. Would you like to generate a receipt?"
        footer={
          <>
            <Button variant="outline" onClick={handleLater}>
              Later
            </Button>
            <Button onClick={handleGenerateReceipt}>Generate</Button>
          </>
        }
      />

      {/* Receipt modal */}
      {receiptData && (
        <PaymentReceiptModal
          isOpen={receiptOpen}
          placement={receiptData.placement}
          payment={receiptData.payment}
          onPrint={() => {}}
          onClose={() => {
            setReceiptOpen(false);
            setReceiptData(null);
          }}
        />
      )}
    </>
  );
}
