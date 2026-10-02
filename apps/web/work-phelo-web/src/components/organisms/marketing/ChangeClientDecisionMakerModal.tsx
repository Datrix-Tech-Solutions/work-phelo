'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useProspectingSettings } from '@/hooks/marketing/useProspectingSettings';
import { useUpdateClient } from '@/hooks/marketing/useClients';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';

interface Props {
  clientId: string;
  clientName: string;
  currentName: string;
  currentRoleId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ChangeClientDecisionMakerModal({
  clientId,
  clientName,
  currentName,
  currentRoleId,
  isOpen,
  onClose,
}: Props) {
  const toast = useToast();
  const updateClient = useUpdateClient(clientId);
  const { data: roles = [], isLoading } = useProspectingSettings('decision-makers');
  const [name, setName] = useState(currentName);
  const [roleId, setRoleId] = useState(currentRoleId);

  const options = useMemo(() => roles.map((r) => ({ value: r.id, label: r.name })), [roles]);
  const trimmed = name.trim();
  const changed = trimmed !== currentName || roleId !== currentRoleId;

  function handleSave() {
    updateClient.mutate(
      { primaryContact: { name: trimmed, decisionMakerTypeId: roleId || null } },
      {
        onSuccess: () => {
          toast.success('Decision maker updated');
          onClose();
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to update decision maker')),
      },
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Change Decision Maker"
      description={clientName}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={updateClient.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!trimmed || !changed}
            isLoading={updateClient.isPending}
            loadingText="Saving…"
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Decision Maker" value={name} onChange={(e) => setName(e.target.value)} />
        <SearchSelect
          label="Decision Maker Role"
          placeholder={isLoading ? 'Loading roles...' : 'Select role'}
          options={options}
          value={roleId}
          onChange={setRoleId}
          disabled={isLoading}
        />
      </div>
    </Modal>
  );
}
