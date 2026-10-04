'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { AssignedToSelect } from '@/components/molecules/marketing/AssignedToSelect';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { ToggleRow } from '@/components/molecules/shared/ToggleRow';
import { BillingSection } from '@/components/organisms/marketing/BillingSection';
import {
  ClientBillingErrors,
  ClientBillingValues,
  EMPTY_BILLING,
  resolveEntityTypeId,
  toBillingInput,
  validateBilling,
} from '@/components/molecules/marketing/ClientBillingFields';
import { useProspectingSettings } from '@/hooks/marketing/useProspectingSettings';
import {
  useBillingOptions,
  useRaiseClientBilling,
  useUpdateClient,
} from '@/hooks/marketing/useClients';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';

interface Props {
  clientId: string;
  clientName: string;
  currentBusinessTypeId: string;
  currentSourceTypeId: string;
  /** The user it is assigned to now. */
  currentAssignedUserId: string;
  currentAssignedUserName?: string | null;
  currentBillable: boolean;
  /** The client's entity type in Accounting, once it has an entity. */
  currentEntityTypeId: string | null;
  /** The client's products a billing transaction can be tagged to. */
  productOptions: { value: string; label: string }[];
  isOpen: boolean;
  onClose: () => void;
}

export function EditClientCompanyModal({
  clientId,
  clientName,
  currentBusinessTypeId,
  currentSourceTypeId,
  currentAssignedUserId,
  currentAssignedUserName,
  currentBillable,
  currentEntityTypeId,
  productOptions,
  isOpen,
  onClose,
}: Props) {
  const toast = useToast();
  const updateClient = useUpdateClient(clientId);
  const raiseBilling = useRaiseClientBilling(clientId);
  const { data: billingOptions } = useBillingOptions();
  // One id per open form, so trying Save again after a failure never sends a second transaction.
  const [submissionId] = useState(() => crypto.randomUUID());
  const { data: businessTypes = [], isLoading: loadingBusiness } =
    useProspectingSettings('business-types');
  const { data: sourceTypes = [], isLoading: loadingSource } =
    useProspectingSettings('source-types');
  const [companyName, setCompanyName] = useState(clientName);
  const [businessTypeId, setBusinessTypeId] = useState(currentBusinessTypeId);
  const [sourceTypeId, setSourceTypeId] = useState(currentSourceTypeId);
  const [assignedUserId, setAssignedUserId] = useState(currentAssignedUserId);
  const [billable, setBillable] = useState(currentBillable);
  const [billing, setBilling] = useState<ClientBillingValues>(EMPTY_BILLING);
  const [billingErrors, setBillingErrors] = useState<ClientBillingErrors>({});

  const businessOptions = useMemo(
    () => businessTypes.map((t) => ({ value: t.id, label: t.name })),
    [businessTypes],
  );
  const sourceOptions = useMemo(
    () => sourceTypes.map((t) => ({ value: t.id, label: t.name })),
    [sourceTypes],
  );
  const trimmedName = companyName.trim();
  const changed =
    trimmedName !== clientName ||
    businessTypeId !== currentBusinessTypeId ||
    sourceTypeId !== currentSourceTypeId ||
    assignedUserId !== currentAssignedUserId ||
    billable !== currentBillable;

  const isPending = updateClient.isPending || raiseBilling.isPending;
  // Billing is only ever switched ON by raising a transaction (below); a plain edit can only switch it off.
  const switchingOn = !currentBillable && billable;
  const switchingOff = currentBillable && !billable;

  async function handleSave() {
    if (switchingOn) {
      if (!billingOptions) return;
      const next = validateBilling(billing, billingOptions, currentEntityTypeId);
      setBillingErrors(next);
      if (Object.keys(next).length > 0) return;
    }

    try {
      const detailsChanged =
        trimmedName !== clientName ||
        businessTypeId !== currentBusinessTypeId ||
        sourceTypeId !== currentSourceTypeId ||
        assignedUserId !== currentAssignedUserId ||
        switchingOff;
      if (detailsChanged) {
        await updateClient.mutateAsync({
          companyName: trimmedName,
          businessTypeId: businessTypeId || null,
          sourceTypeId: sourceTypeId || null,
          ...(assignedUserId !== currentAssignedUserId ? { assignedUserId } : {}),
          ...(switchingOff ? { isBillable: false } : {}),
        });
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to update company details'));
      return;
    }

    if (switchingOn && billingOptions) {
      try {
        const input = toBillingInput(billing, billingOptions, currentEntityTypeId);
        await raiseBilling.mutateAsync({
          submissionId,
          ...(currentEntityTypeId
            ? {}
            : { entityTypeId: resolveEntityTypeId(billing, billingOptions, null) }),
          transactionTypeId: input.transactionTypeId,
          amount: input.amount,
          ...(input.description ? { description: input.description } : {}),
          ...(input.productId ? { productId: input.productId } : {}),
        });
      } catch (error) {
        // The company details above are already saved; only the transaction needs another try.
        toast.error(apiErrorMessage(error, 'Failed to send the transaction'));
        return;
      }
    }

    toast.success(
      switchingOn ? 'Company details updated and transaction sent' : 'Company details updated',
    );
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Company Details"
      description={clientName}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!trimmedName || !changed}
            isLoading={isPending}
            loadingText="Saving…"
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Company Name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
        <SearchSelect
          label="Type of Business"
          placeholder={loadingBusiness ? 'Loading...' : 'Select type of business'}
          options={businessOptions}
          value={businessTypeId}
          onChange={setBusinessTypeId}
          disabled={loadingBusiness}
        />
        <SearchSelect
          label="Source Type"
          placeholder={loadingSource ? 'Loading...' : 'Select source type'}
          options={sourceOptions}
          value={sourceTypeId}
          onChange={setSourceTypeId}
          disabled={loadingSource}
        />
        <AssignedToSelect
          record="client"
          currentName={currentAssignedUserName}
          value={assignedUserId}
          onChange={(id) => setAssignedUserId(id || currentAssignedUserId)}
        />
        {currentBillable ? (
          <ToggleRow
            label="Billable"
            description="Turn off to stop raising new transactions. Existing ones stay in Accounting."
            enabled={billable}
            onChange={setBillable}
          />
        ) : (
          <BillingSection
            enabled={billable}
            onEnabledChange={setBillable}
            values={billing}
            onValuesChange={setBilling}
            errors={billingErrors}
            productOptions={productOptions}
            lockedEntityTypeId={currentEntityTypeId}
          />
        )}
      </div>
    </Modal>
  );
}
