'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import {
  AddPaymentFormFields,
  AddPaymentFormValues,
  ADD_PAYMENT_DEFAULTS,
} from '@/components/molecules/reinsurance/forms/AddPaymentFormFields';
import {
  usePaymentEligibleFacultatives,
  useCreatePlacementPayment,
  useFacultativePlacement,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { summarizePlacementPaymentFinancials } from '@/lib/reinsurance/payment-calculations';
import { useToastStore } from '@/store/toast.store';
import { api } from '@/lib/api';
import { Facultative, PlacementParticipantClosing, PlacementPayment } from '@/types/reinsurance';
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
  const [paymentGuardError, setPaymentGuardError] = useState<string | null>(null);

  const { data: facultatives = [] } = usePaymentEligibleFacultatives();
  const { data: singlePlacement } = useFacultativePlacement(placementId ?? '');
  const createPayment = useCreatePlacementPayment();
  const addToast = useToastStore((s) => s.addToast);

  const form = useForm<AddPaymentFormValues>({ defaultValues: ADD_PAYMENT_DEFAULTS });
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = form;

  const onSubmit = async (values: AddPaymentFormValues) => {
    setPaymentGuardError(null);
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
      const financialChecks = await Promise.all(
        selectedFacs.map(async (f) => {
          const [closingsRes, paymentsRes] = await Promise.all([
            api.get(`/operations/reinsurance/placements/${f.id}/closings`),
            api.get(`/operations/reinsurance/placements/${f.id}/payments`),
          ]);
          const closings = (closingsRes.data?.items ??
            closingsRes.data ??
            []) as PlacementParticipantClosing[];
          const payments = (paymentsRes.data?.items ??
            paymentsRes.data ??
            []) as PlacementPayment[];
          return {
            placement: f,
            summary: summarizePlacementPaymentFinancials({
              placementId: f.id,
              closings,
              payments,
            }),
          };
        }),
      );
      const missingConfirmedClosing = financialChecks.find(
        (check) => check.summary.confirmedClosingCount === 0,
      );
      if (missingConfirmedClosing) {
        const message = `At least one confirmed closing is required before recording payment for ${missingConfirmedClosing.placement.reference}.`;
        setPaymentGuardError(message);
        addToast({ message, type: 'error' });
        return;
      }

      const unsafeCurrency = financialChecks.find((check) => check.summary.warnings.length > 0);
      if (unsafeCurrency) {
        const message = `${unsafeCurrency.placement.reference} has mixed confirmed closing currencies. Record payments separately by currency.`;
        setPaymentGuardError(message);
        addToast({ message, type: 'error' });
        return;
      }

      const noOutstanding = financialChecks.find((check) => check.summary.outstanding <= 0);
      if (noOutstanding) {
        const message = `${noOutstanding.placement.reference} has no outstanding confirmed closing premium.`;
        setPaymentGuardError(message);
        addToast({ message, type: 'error' });
        return;
      }

      const totalOutstanding = financialChecks.reduce(
        (sum, check) => sum + check.summary.outstanding,
        0,
      );
      const allSameCurrency =
        financialChecks.length <= 1 ||
        financialChecks.every(
          (check) => check.summary.currency === financialChecks[0].summary.currency,
        );

      const calls = selectedFacs.map(async (f) => {
        const financial = financialChecks.find((check) => check.placement.id === f.id);
        if (!financial) throw new Error(`Missing confirmed closing totals for ${f.reference}`);

        let rawAmount: number;
        if (selectedFacs.length === 1) {
          rawAmount = parsedAmount;
        } else if (hasAllocations && values.allocations[f.id]) {
          rawAmount = parseFloat(values.allocations[f.id]) || 0;
        } else {
          const proportion =
            totalOutstanding > 0
              ? financial.summary.outstanding / totalOutstanding
              : 1 / selectedFacs.length;
          rawAmount = proportion * parsedAmount;
        }

        const paymentCurrency = values.currency;
        const placementCurrency = financial.summary.currency ?? f.currency ?? values.currency;
        let submittedAmount = rawAmount;

        if (paymentCurrency !== placementCurrency) {
          const rateStr = allSameCurrency
            ? values.rate
            : (values.allocationRates[f.id] ?? values.rate);
          const rate = parseFloat(rateStr) || 1;
          submittedAmount = rawAmount * rate;
        }

        submittedAmount = Math.round(submittedAmount * 100) / 100;
        if (submittedAmount > financial.summary.outstanding + 0.01) {
          throw new Error(
            `Payment for ${f.reference} exceeds outstanding confirmed closing premium of ${placementCurrency} ${financial.summary.outstanding.toLocaleString(
              undefined,
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
            )}.`,
          );
        }

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
            <Button type="submit" form="add-payment-form" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Record Payment'}
            </Button>
          </div>
        }
      >
        {panelOpen && (
          <form id="add-payment-form" onSubmit={handleSubmit(onSubmit)}>
            {paymentGuardError && (
              <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                {paymentGuardError}
              </p>
            )}
            <AddPaymentFormFields
              form={form}
              placementId={placementId}
              onPlacementsChange={onPlacementsChange}
            />
          </form>
        )}
      </SidePanel>

      {/* Receipt prompt popup */}
      <Modal
        isOpen={!!receiptPrompt}
        onClose={handleLater}
        title="Preview Receipt"
        description="Payment recorded successfully. Would you like to preview a receipt?"
        footer={
          <>
            <Button variant="outline" onClick={handleLater}>
              Later
            </Button>
            <Button onClick={handleGenerateReceipt}>Preview</Button>
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
