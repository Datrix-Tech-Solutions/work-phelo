'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useToast } from '@/hooks/useToast';
import { useUpdateInterviewStatus } from '@/hooks/hr/useRecruitment';
import { extractError } from '@/lib/extractError';
import type { CandidateInterview, RecruitmentStage } from '@/types/recruitment';

interface Props {
  candidateId: string;
  interview: CandidateInterview | null;
  stages: RecruitmentStage[];
  /** The candidate's stage now, preselected so completing alone keeps them where they are. */
  currentStageId: string | null;
  onClose: () => void;
}

/** Marks an interview completed, with feedback and the stage the candidate moves on to. */
export function CompleteInterviewModal({
  candidateId,
  interview,
  stages,
  currentStageId,
  onClose,
}: Props) {
  return (
    <Modal
      isOpen={!!interview}
      onClose={onClose}
      title="Complete Interview"
      description="Record the outcome and choose the stage the candidate moves to."
    >
      {interview && (
        <CompleteForm
          key={interview.id}
          candidateId={candidateId}
          interview={interview}
          stages={stages}
          currentStageId={currentStageId}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function CompleteForm({
  candidateId,
  interview,
  stages,
  currentStageId,
  onClose,
}: Omit<Props, 'interview'> & { interview: CandidateInterview }) {
  const toast = useToast();
  const { mutate, isPending } = useUpdateInterviewStatus();

  // Applied and Screening are stages before the interview, so they are not offered.
  const options = useMemo(
    () =>
      [...stages]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .filter((s) => !s.isDefault && s.name.trim().toLowerCase() !== 'screening')
        .map((s) => ({ value: s.id, label: s.name })),
    [stages],
  );

  const [stageId, setStageId] = useState(() =>
    options.some((o) => o.value === currentStageId) ? (currentStageId ?? '') : '',
  );
  const [feedback, setFeedback] = useState('');

  const submit = () =>
    mutate(
      {
        candidateId,
        interviewId: interview.id,
        status: 'COMPLETED',
        feedback: feedback.trim(),
        stageId,
      },
      {
        onSuccess: () => {
          toast.success('Interview completed');
          onClose();
        },
        onError: (err) => toast.error(extractError(err, 'Failed to complete interview')),
      },
    );

  return (
    <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
      <SearchSelect
        label="Move candidate to"
        placeholder="Keep current stage"
        options={options}
        value={stageId}
        onChange={setStageId}
      />
      <Input
        type="textarea"
        label="Feedback"
        rows={4}
        maxLength={4000}
        placeholder="How did the interview go?"
        value={feedback}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFeedback(e.target.value)}
      />
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} isLoading={isPending} loadingText="Saving…">
          Complete Interview
        </Button>
      </div>
    </div>
  );
}
