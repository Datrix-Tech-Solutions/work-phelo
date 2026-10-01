'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { usePipelineStages } from '@/hooks/marketing/usePipelineStages';
import { useUpdateProspect } from '@/hooks/marketing/useProspects';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';

interface UpdateProspectStageModalProps {
  prospectId: string;
  prospectName: string;
  currentStageId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function UpdateProspectStageModal({
  prospectId,
  prospectName,
  currentStageId,
  isOpen,
  onClose,
}: UpdateProspectStageModalProps) {
  const toast = useToast();
  const [stageId, setStageId] = useState(currentStageId);
  const { data: stages = [], isLoading } = usePipelineStages();
  const updateProspect = useUpdateProspect(prospectId);

  const options = useMemo(
    () => stages.map((stage) => ({ value: stage.id, label: stage.name })),
    [stages],
  );

  function handleSave() {
    updateProspect.mutate(
      { pipelineStageId: stageId },
      {
        onSuccess: () => {
          toast.success('Sales stage updated');
          onClose();
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to update sales stage')),
      },
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Sales Stage"
      description={prospectName}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={updateProspect.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!stageId || stageId === currentStageId}
            isLoading={updateProspect.isPending}
            loadingText="Saving…"
          >
            Save
          </Button>
        </div>
      }
    >
      <SearchSelect
        label="Pipeline Stage"
        placeholder={isLoading ? 'Loading stages...' : 'Select stage'}
        options={options}
        value={stageId}
        onChange={setStageId}
        disabled={isLoading}
      />
    </Modal>
  );
}
