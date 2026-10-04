'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import {
  ClientBillingErrors,
  ClientBillingFields,
  ClientBillingValues,
  EMPTY_BILLING,
  resolveEntityTypeId,
  toBillingInput,
  validateBilling,
} from '@/components/molecules/marketing/ClientBillingFields';
import { useBillingOptions, useRaiseClientBilling } from '@/hooks/marketing/useClients';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';

interface Props {
  clientId: string;
  clientName: string;
  /** The client's entity type once it has an entity in Accounting. */
  entityTypeId: string | null;
  productOptions: { value: string; label: string }[];
  isOpen: boolean;
  onClose: () => void;
}

/** Raises a transaction for a client — the first one creates its entity in Accounting. */
export function ClientBillingModal({
  clientId,
  clientName,
  entityTypeId,
  productOptions,
  isOpen,
  onClose,
}: Props) {
  const toast = useToast();
  const { data: options, isLoading, isError } = useBillingOptions();
  const raise = useRaiseClientBilling(clientId);
  // One id per open form: sending the same submission again never creates a second transaction.
  const [submissionId] = useState(() => crypto.randomUUID());
  const [values, setValues] = useState<ClientBillingValues>(EMPTY_BILLING);
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

  function handleSave() {
    if (!options || blockedReason) return;
    const next = validateBilling(values, options, entityTypeId);
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input = toBillingInput(values, options, entityTypeId);
    raise.mutate(
      {
        submissionId,
        // Only the first transaction picks an entity type; later ones reuse the client's entity.
        ...(entityTypeId ? {} : { entityTypeId: resolveEntityTypeId(values, options, null) }),
        transactionTypeId: input.transactionTypeId,
        amount: input.amount,
        ...(input.description ? { description: input.description } : {}),
        ...(input.productId ? { productId: input.productId } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Transaction sent to Accounting');
          onClose();
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to send the transaction')),
      },
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Transaction"
      description={`${clientName} — Accounting will review and post it.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={raise.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!!blockedReason}
            isLoading={raise.isPending}
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
          productOptions={productOptions}
        />
      )}
    </Modal>
  );
}
