'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import {
  ClientBillingErrors,
  ClientBillingFields,
  ClientBillingValues,
  resolveEntityTypeId,
  validateBilling,
} from '@/components/molecules/marketing/ClientBillingFields';
import {
  useProjectInvoiceBillingOptions,
  useRaiseProjectInvoice,
} from '@/hooks/hr/useProjectClients';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import type { BillingLine } from '@/lib/projectBilling';
import type { BillingOptions } from '@/types/marketing';

interface Props {
  projectId: string;
  projectName: string;
  clientName: string;
  /** What is going on the invoice. */
  lines: BillingLine[];
  isOpen: boolean;
  onClose: () => void;
  onSent: () => void;
}

const sum = (lines: BillingLine[]) =>
  Math.round(lines.reduce((total, l) => total + l.amount, 0) * 100) / 100;

/** Raises the invoice for a project client's lines straight to Accounting, as a draft the accountant completes. */
export function ProjectClientInvoiceModal({
  projectId,
  projectName,
  clientName,
  lines,
  isOpen,
  onClose,
  onSent,
}: Props) {
  const toast = useToast();
  const raise = useRaiseProjectInvoice(projectId);
  const { data: options, isLoading, isError } = useProjectInvoiceBillingOptions(projectId);
  const lockedEntityTypeId = options?.entityTypeId ?? null;
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

  // The shared billing form is written for marketing's options; this is the same shape.
  const formOptions = useMemo<BillingOptions | null>(
    () =>
      options
        ? {
            canBill: true,
            ready: options.ready,
            reason: null,
            message: options.message ?? null,
            baseCurrency: options.baseCurrency ?? null,
            entityTypes: options.entityTypes,
            transactionTypes: options.transactionTypes,
          }
        : null,
    [options],
  );

  const blockedReason = isLoading
    ? 'Checking Accounting…'
    : isError || !options || !formOptions
      ? 'Accounting is currently unavailable'
      : !options.ready
        ? (options.message ??
          'Project billing is not set up in Accounting yet. An accountant needs to link the Project Billing source.')
        : null;

  function handleSend() {
    if (!formOptions || blockedReason) return;
    const next = validateBilling(values, formOptions, lockedEntityTypeId);
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    raise.mutate(
      {
        submissionId,
        ...(lockedEntityTypeId
          ? {}
          : { entityTypeId: resolveEntityTypeId(values, formOptions, null) }),
        transactionTypeId: values.transactionTypeId,
        amount: Number(values.amount),
        description: values.description.trim() || projectName,
        lines: lines.map((l) => ({
          key: l.key,
          label: l.label,
          amount: l.amount,
          ...(l.minutes ? { minutes: l.minutes, people: l.people } : {}),
        })),
      },
      {
        onSuccess: () => {
          toast.success('Invoice sent to Accounting');
          onSent();
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
          <Button variant="outline" onClick={onClose} disabled={raise.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!!blockedReason}
            isLoading={raise.isPending}
            loadingText="Sending…"
          >
            Send to Accounting
          </Button>
        </div>
      }
    >
      {blockedReason || !formOptions ? (
        <p className="text-sm font-medium text-amber-600">{blockedReason}</p>
      ) : (
        <ClientBillingFields
          options={formOptions}
          values={values}
          onChange={setValues}
          errors={errors}
          lockedEntityTypeId={lockedEntityTypeId}
          lockAmount
        />
      )}
    </Modal>
  );
}
