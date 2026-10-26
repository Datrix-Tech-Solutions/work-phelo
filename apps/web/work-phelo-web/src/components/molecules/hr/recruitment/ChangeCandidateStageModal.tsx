'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useToast } from '@/hooks/useToast';
import { useMoveCandidateStage, useRecruitmentStages } from '@/hooks/hr/useRecruitment';
import { extractError } from '@/lib/extractError';
import type { RecruitmentCandidate } from '@/types/recruitment';

interface Props {
  candidate: RecruitmentCandidate | null;
  onClose: () => void;
}

/** Moves a candidate to another recruitment stage, with an optional recruiter note. */
export function ChangeCandidateStageModal({ candidate, onClose }: Props) {
  const toast = useToast();
  const { data: stages = [] } = useRecruitmentStages();
  const { mutate: moveStage, isPending } = useMoveCandidateStage();

  // Re-key on the candidate so the form starts fresh each time the modal opens.
  return (
    <Modal
      isOpen={!!candidate}
      onClose={onClose}
      title="Change Stage"
      description={candidate ? `Move ${fullName(candidate)} to another stage.` : undefined}
    >
      {candidate && (
        <StageForm
          key={candidate.id}
          candidate={candidate}
          stages={stages}
          isPending={isPending}
          onCancel={onClose}
          onSubmit={(stageId, note) =>
            moveStage(
              { id: candidate.id, stageId, note },
              {
                onSuccess: () => {
                  toast.success('Candidate stage updated');
                  onClose();
                },
                onError: (err) =>
                  toast.error(extractError(err, 'Failed to update candidate stage')),
              },
            )
          }
        />
      )}
    </Modal>
  );
}

function fullName(c: RecruitmentCandidate): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || 'this candidate';
}

function StageForm({
  candidate,
  stages,
  isPending,
  onCancel,
  onSubmit,
}: {
  candidate: RecruitmentCandidate;
  stages: { id: string; name: string; isDefault: boolean }[];
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (stageId: string, note: string) => void;
}) {
  // Applied is where a candidate starts when they apply, so a candidate is never moved back to it.
  const options = useMemo(
    () => stages.filter((s) => !s.isDefault).map((s) => ({ value: s.id, label: s.name })),
    [stages],
  );
  const [stageId, setStageId] = useState(() =>
    options.some((o) => o.value === candidate.currentStageId)
      ? (candidate.currentStageId ?? '')
      : '',
  );
  const [note, setNote] = useState('');
  const unchanged = stageId === candidate.currentStageId;

  return (
    <div className="flex flex-col gap-4">
      <SearchSelect
        label="Stage"
        placeholder="Select a stage"
        options={options}
        value={stageId}
        clearable={false}
        onChange={setStageId}
      />
      <Input
        type="textarea"
        label="Note (optional)"
        rows={3}
        maxLength={1000}
        placeholder="Add a note about this move"
        value={note}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
      />
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          isLoading={isPending}
          loadingText="Saving…"
          disabled={!stageId || unchanged}
          onClick={() => onSubmit(stageId, note.trim())}
        >
          Move Candidate
        </Button>
      </div>
    </div>
  );
}
