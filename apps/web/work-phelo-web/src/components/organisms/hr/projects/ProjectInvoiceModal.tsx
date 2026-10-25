'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import {
  ClientBillingErrors,
  ClientBillingFields,
  ClientBillingValues,
  resolveEntityTypeId,
  toBillingInput,
  validateBilling,
} from '@/components/molecules/marketing/ClientBillingFields';
import { useBillingOptions, useClient, useRaiseClientBilling } from '@/hooks/marketing/useClients';
import { useRecordProjectInvoice } from '@/hooks/hr/useProjectInvoices';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import type { BillingLine } from '@/lib/projectBilling';

interface Props {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  /** What is going on the invoice. */
  lines: BillingLine[];
  isOpen: boolean;
  onClose: () => void;
  onSent: () => void;
}

const sum = (lines: BillingLine[]) =>
  Math.round(lines.reduce((total, l) => total + l.amount, 0) * 100) / 100;

/** Raises the invoice for the chosen lines, through marketing, which sends it to Accounting. */
export function ProjectInvoiceModal({
  projectId,
  projectName,
  clientId,
  clientName,
  lines,
  isOpen,
  onClose,
  onSent,
}: Props) {
  const toast = useToast();
  const record = useRecordProjectInvoice(projectId);
  const { data: options, isLoading, isError } = useBillingOptions();
  const { data: client } = useClient(clientId);
  const entityTypeId = client?.accountingEntityTypeId ?? null;
  const raise = useRaiseClientBilling(clientId);
  // One id per open form: sending the same submission again never creates a second invoice.
  const [submissionId] = useState(() => crypto.randomUUID());
  const [values, setValues] = useState<ClientBillingValues>(() => ({
    entityTypeId: '',
    transactionTypeId: '',
    amount: sum(lines).toFixed(2),
    description: `${projectName}: ${lines.map((l) => l.label).join(', ')}`.slice(0, 500),
    productId: '',
  }));
  const [errors, setErrors] = useState<ClientBillingErrors>({});

  const blockedReason = isLoading
    ? 'Checking Accounting…'
    : isError || !options
      ? 'Accounting is currently unavailable'
      : !options.canBill
        ? "You don't have permission to bill clients"
        : !options.ready
          ? (options.message ?? 'Accounting not set up')
          : null;

  function handleSend() {
    if (!options || blockedReason) return;
    const next = validateBilling(values, options, entityTypeId);
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input = toBillingInput(values, options, entityTypeId);
    raise.mutate(
      {
        submissionId,
        ...(entityTypeId ? {} : { entityTypeId: resolveEntityTypeId(values, options, null) }),
        transactionTypeId: input.transactionTypeId,
        amount: input.amount,
        ...(input.description ? { description: input.description } : {}),
      },
      {
        onSuccess: (result: { accountingTransactionId: string }) => {
          record.mutate(
            {
              id: submissionId,
              transactionId: result.accountingTransactionId,
              description: input.description ?? projectName,
              amount: input.amount,
              lines: lines.map((l) => ({
                key: l.key,
                label: l.label,
                amount: l.amount,
                minutes: l.minutes,
              })),
            },
            {
              onSuccess: () => {
                toast.success('Invoice sent to Accounting');
                onSent();
              },
              // Accounting has the invoice; sending again reuses it, so nothing is billed twice.
              onError: (error) =>
                toast.error(
                  apiErrorMessage(
                    error,
                    "The invoice reached Accounting but couldn't be saved on the project. Send it again to finish.",
                  ),
                ),
            },
          );
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to send the invoice')),
      },
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Raise Invoice"
      description={`${clientName} — Accounting will review and post it.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={raise.isPending || record.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!!blockedReason}
            isLoading={raise.isPending || record.isPending}
            loadingText="Sending…"
          >
            Send to Accounting
          </Button>
        </div>
      }
    >
      {blockedReason || !options ? (
        <p className="text-sm font-medium text-amber-600">{blockedReason}</p>
      ) : (
        <ClientBillingFields
          options={options}
          values={values}
          onChange={setValues}
          errors={errors}
          lockedEntityTypeId={entityTypeId}
          lockAmount
        />
      )}
    </Modal>
  );
}
