'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Input } from '@/components/atoms/Input';
import { useRequestClientPayment } from '@/hooks/marketing/useClients';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { formatMoney } from '@/lib/formatMoney';
import type { BillingTransaction } from '@/types/marketing';

interface Props {
  clientId: string;
  clientName: string;
  /** The posted invoice being paid. */
  invoice: BillingTransaction;
  onClose: () => void;
}

function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={strong ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'}>
        {value}
      </span>
    </div>
  );
}

/**
 * The client has paid (part of) an invoice. This only tells Accounting — it records the payment
 * itself, choosing the bank, and can turn it down.
 */
export function ClientPaymentModal({ clientId, clientName, invoice, onClose }: Props) {
  const toast = useToast();
  const request = useRequestClientPayment(clientId);
  // One id per open form: sending the same submission again never raises a second request.
  const [submissionId] = useState(() => crypto.randomUUID());
  const claimable = invoice.claimableAmount ?? '0';
  const [amount, setAmount] = useState(() => Number(claimable).toFixed(2));
  const [paymentDate, setPaymentDate] = useState(today);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; paymentDate?: string }>({});

  const currency = invoice.currency;

  function handleSend() {
    const next: typeof errors = {};
    const trimmed = amount.trim();
    if (!trimmed || !(Number(trimmed) > 0)) {
      next.amount = 'Enter an amount greater than zero.';
    } else if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      next.amount = 'Use at most two decimal places.';
    } else if (Number(trimmed) > Number(claimable)) {
      next.amount = `The most that can be requested is ${currency} ${formatMoney(claimable)}.`;
    }
    if (!paymentDate) next.paymentDate = 'Choose the date the client paid.';
    else if (paymentDate > today()) next.paymentDate = 'The payment date cannot be in the future.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    request.mutate(
      {
        submissionId,
        invoiceId: invoice.id,
        amount: Number(trimmed),
        paymentDate,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Payment request sent to Accounting');
          onClose();
        },
        onError: (error) =>
          toast.error(apiErrorMessage(error, 'Failed to send the payment request')),
      },
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Make Payment"
      description={`${clientName} — Accounting will record it and choose the bank.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={request.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSend} isLoading={request.isPending} loadingText="Sending…">
            Send to Accounting
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
          <SummaryRow
            label="Invoice"
            value={invoice.documentNumber ?? invoice.transactionTypeName}
          />
          <SummaryRow label="Invoice amount" value={`${currency} ${formatMoney(invoice.amount)}`} />
          <SummaryRow
            label="Outstanding"
            value={`${currency} ${formatMoney(invoice.outstandingAmount)}`}
          />
          {Number(invoice.pendingAmount ?? 0) > 0 && (
            <SummaryRow
              label="Already requested"
              value={`${currency} ${formatMoney(invoice.pendingAmount)}`}
            />
          )}
          <div className="border-t border-gray-100 pt-2">
            <SummaryRow
              label="Available to request"
              value={`${currency} ${formatMoney(claimable)}`}
              strong
            />
          </div>
        </div>

        <Input
          label={`Amount paid (${currency})`}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
        />
        <DatePicker
          label="Payment date"
          value={paymentDate}
          onChange={setPaymentDate}
          disableFuture
          error={errors.paymentDate}
        />
        <Input
          label="Reference (optional)"
          placeholder="e.g. transfer or cheque number"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          maxLength={100}
        />
        <Input
          label="Note (optional)"
          placeholder="e.g. First instalment"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </div>
    </Modal>
  );
}
