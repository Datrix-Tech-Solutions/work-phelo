'use client';

import { useState } from 'react';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DetailField } from '@/components/atoms/DetailField';
import { BillingSection } from '@/components/organisms/marketing/BillingSection';
import {
  ClientBillingErrors,
  ClientBillingValues,
  EMPTY_BILLING,
  toBillingInput,
  validateBilling,
} from '@/components/molecules/marketing/ClientBillingFields';
import { useBillingOptions, useConvertProspectToClient } from '@/hooks/marketing/useClients';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import type { ProspectDetail } from '@/types/marketing';

interface ConvertToClientModalProps {
  prospect: ProspectDetail;
  isOpen: boolean;
  onClose: () => void;
}

export function ConvertToClientModal({ prospect, isOpen, onClose }: ConvertToClientModalProps) {
  const toast = useToast();
  const convert = useConvertProspectToClient(prospect.id);
  const [billable, setBillable] = useState(false);
  const [billing, setBilling] = useState<ClientBillingValues>(EMPTY_BILLING);
  const [billingErrors, setBillingErrors] = useState<ClientBillingErrors>({});
  const [converted, setConverted] = useState(false);
  // Generated up front, so trying again after a failure reuses the same client (and Accounting entity).
  const [clientId] = useState(() => crypto.randomUUID());
  const { data: billingOptions } = useBillingOptions();
  const billingProductOptions = prospect.products.map((p) => ({
    value: p.product.id,
    label: p.product.name,
  }));
  const contact = prospect.contacts.find((c) => c.isPrimary) ?? prospect.contacts[0];

  function handleClose() {
    setBillable(false);
    setBilling(EMPTY_BILLING);
    setBillingErrors({});
    setConverted(false);
    onClose();
  }

  function handleConfirm() {
    if (billable && billingOptions) {
      const next = validateBilling(billing, billingOptions);
      setBillingErrors(next);
      if (Object.keys(next).length > 0) return;
    }

    convert.mutate(
      {
        clientId,
        isBillable: billable,
        ...(billable && billingOptions ? { billing: toBillingInput(billing, billingOptions) } : {}),
      },
      {
        onSuccess: () => setConverted(true),
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to convert prospect')),
      },
    );
  }

  if (converted) {
    return (
      <SuccessModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Converted to Client"
        message={`${prospect.companyName} is now a client${billable ? ', and its first transaction was sent to Accounting' : ''}.`}
      />
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Convert to Client"
      description="Review the client details before converting this prospect."
      width="max-w-xl"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={convert.isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} isLoading={convert.isPending} loadingText="Converting…">
            Convert to Client
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <DetailField label="Company Name" value={prospect.companyName} />
          <DetailField label="Type of Business" value={prospect.businessType?.name} />
          <DetailField label="Location" value={prospect.location.label} />
          <DetailField label="Source Type" value={prospect.sourceType?.name} />
          <DetailField label="Contact Person" value={contact?.name} />
          <DetailField label="Role / Job Title" value={contact?.decisionMaker?.name} />
          <DetailField label="Phone" value={contact?.phone} />
          <DetailField label="Email" value={contact?.email} />
        </div>

        <div className="border-t border-gray-100 pt-4">
          <BillingSection
            enabled={billable}
            onEnabledChange={setBillable}
            values={billing}
            onValuesChange={setBilling}
            errors={billingErrors}
            productOptions={billingProductOptions}
          />
        </div>
      </div>
    </Modal>
  );
}
