'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
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
  currentName: string;
  currentRoleId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ChangeProspectDecisionMakerModal({
  prospectId,
  prospectName,
  currentName,
  currentRoleId,
  isOpen,
  onClose,
}: Props) {
  const toast = useToast();
  const updateProspect = useUpdateProspect(prospectId);
  const { data: roles = [], isLoading } = useProspectingSettings('decision-makers');
  const [name, setName] = useState(currentName);
  const [roleId, setRoleId] = useState(currentRoleId);

  const options = useMemo(() => roles.map((r) => ({ value: r.id, label: r.name })), [roles]);
  const trimmed = name.trim();
  const changed = trimmed !== currentName || roleId !== currentRoleId;

  function handleSave() {
    updateProspect.mutate(
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
      description={prospectName}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={updateProspect.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!trimmed || !changed}
            isLoading={updateProspect.isPending}
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
