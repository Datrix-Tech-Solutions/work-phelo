'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { AssignedToSelect } from '@/components/molecules/marketing/AssignedToSelect';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useProspectingSettings } from '@/hooks/marketing/useProspectingSettings';
import { useUpdateProspect } from '@/hooks/marketing/useProspects';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';

interface Props {
  prospectId: string;
  prospectName: string;
  currentBusinessTypeId: string;
  currentSourceTypeId: string;
  /** The user it is assigned to now. */
  currentAssignedUserId: string;
  currentAssignedUserName?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EditProspectCompanyModal({
  prospectId,
  prospectName,
  currentBusinessTypeId,
  currentSourceTypeId,
  currentAssignedUserId,
  currentAssignedUserName,
  isOpen,
  onClose,
}: Props) {
  const toast = useToast();
  const updateProspect = useUpdateProspect(prospectId);
  const { data: businessTypes = [], isLoading: loadingBusiness } =
    useProspectingSettings('business-types');
  const { data: sourceTypes = [], isLoading: loadingSource } =
    useProspectingSettings('source-types');
  const [companyName, setCompanyName] = useState(prospectName);
  const [businessTypeId, setBusinessTypeId] = useState(currentBusinessTypeId);
  const [sourceTypeId, setSourceTypeId] = useState(currentSourceTypeId);
  const [assignedUserId, setAssignedUserId] = useState(currentAssignedUserId);

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
    trimmedName !== prospectName ||
    businessTypeId !== currentBusinessTypeId ||
    sourceTypeId !== currentSourceTypeId ||
    assignedUserId !== currentAssignedUserId;

  function handleSave() {
    updateProspect.mutate(
      {
        companyName: trimmedName,
        businessTypeId: businessTypeId || null,
        sourceTypeId: sourceTypeId || null,
        ...(assignedUserId !== currentAssignedUserId ? { assignedUserId } : {}),
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
      description={prospectName}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={updateProspect.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!trimmedName || !changed}
            isLoading={updateProspect.isPending}
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
          record="prospect"
          currentName={currentAssignedUserName}
          value={assignedUserId}
          onChange={(id) => setAssignedUserId(id || currentAssignedUserId)}
        />
      </div>
    </Modal>
  );
}
