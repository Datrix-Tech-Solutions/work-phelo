'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { ToggleRow } from '@/components/molecules/shared/ToggleRow';
import { useProspectingSettings } from '@/hooks/marketing/useProspectingSettings';
import { useUpdateClient } from '@/hooks/marketing/useClients';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';

interface Props {
  clientId: string;
  clientName: string;
  currentBusinessTypeId: string;
  currentSourceTypeId: string;
  currentBillable: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export function EditClientCompanyModal({
  clientId,
  clientName,
  currentBusinessTypeId,
  currentSourceTypeId,
  currentBillable,
  isOpen,
  onClose,
}: Props) {
  const toast = useToast();
  const updateClient = useUpdateClient(clientId);
  const { data: businessTypes = [], isLoading: loadingBusiness } =
    useProspectingSettings('business-types');
  const { data: sourceTypes = [], isLoading: loadingSource } =
    useProspectingSettings('source-types');
  const [companyName, setCompanyName] = useState(clientName);
  const [businessTypeId, setBusinessTypeId] = useState(currentBusinessTypeId);
  const [sourceTypeId, setSourceTypeId] = useState(currentSourceTypeId);
  const [billable, setBillable] = useState(currentBillable);

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
    billable !== currentBillable;

  function handleSave() {
    updateClient.mutate(
      {
        companyName: trimmedName,
        businessTypeId: businessTypeId || null,
        sourceTypeId: sourceTypeId || null,
        isBillable: billable,
      },
      {
        onSuccess: () => {
          toast.success('Company details updated');
          onClose();
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to update company details')),
      },
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Company Details"
      description={clientName}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={updateClient.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!trimmedName || !changed}
            isLoading={updateClient.isPending}
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
        <ToggleRow
          label="Billable"
          description="Mark this client as billable."
          enabled={billable}
          onChange={setBillable}
        />
      </div>
    </Modal>
  );
}
