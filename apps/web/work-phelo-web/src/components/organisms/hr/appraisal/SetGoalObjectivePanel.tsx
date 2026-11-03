'use client';

import { useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { useCreateGoalObjectives } from '@/hooks/hr/useGoalAppraisals';
import {
  ObjectiveAssignmentsField,
  draftAssignments,
  draftsPayload,
  draftsReady,
  newDraft,
} from '@/components/organisms/hr/appraisal/ObjectiveAssignmentsField';
import type { Employee } from '@/types/hr';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  goalId: string;
  goalName: string;
  /** The employees already on the goal; objectives can only go to these. Remount (key) per open. */
  members: Employee[];
  /** Employees ticked on the first objective when the panel opens. */
  initialIds?: string[];
}

/** Objectives for a goal, each given to its own set of the goal's employees. */
export function SetGoalObjectivePanel({
  isOpen,
  onClose,
  goalId,
  goalName,
  members,
  initialIds = [],
}: Props) {
  const createObjectives = useCreateGoalObjectives();
  const [drafts, setDrafts] = useState(() => [newDraft(initialIds)]);
  const [saving, setSaving] = useState(false);

  const assignments = draftAssignments(drafts);
  const canSave = draftsReady(drafts) && !saving;

  const save = async () => {
    setSaving(true);
    try {
      await createObjectives.mutateAsync({ goalId, objectives: draftsPayload(drafts) });
      onClose();
    } catch {
      // The failure is already toasted; stay open so nothing typed is lost.
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Create objectives"
      description={`For employees on "${goalName}". Each objective goes to the people you pick under it.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={saving} loadingText="Saving..." disabled={!canSave} onClick={save}>
            {drafts.length === 1 && assignments.length <= 1
              ? 'Add objective'
              : `Add ${drafts.length} objectives (${assignments.length} assignments)`}
          </Button>
        </div>
      }
    >
      <ObjectiveAssignmentsField value={drafts} onChange={setDrafts} members={members} />
    </SidePanel>
  );
}
