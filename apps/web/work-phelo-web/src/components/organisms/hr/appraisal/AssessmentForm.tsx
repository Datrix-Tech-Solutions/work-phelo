'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { cardClass, cn } from '@/lib/utils';
import { RATING_MAX, goalsWithObjectives, overallScore } from '@/lib/appraisalAssessments';
import { useAppraisalGoalsStore, type LocalCycle } from '@/store/appraisalGoals.store';
import { useEmployeeObjectivesStore } from '@/store/employeeObjectives.store';
import type { Assessment, Ratings } from '@/store/appraisalAssessments.store';

export type AssessmentMode = 'self' | 'manager' | 'view';

interface Props {
  assessment: Assessment;
  cycle: LocalCycle;
  employeeName: string;
  mode: AssessmentMode;
  onSubmit?: (ratings: Ratings, comment: string) => void;
  onCancel: () => void;
}

function RatingPicker({
  value,
  onChange,
  disabled,
}: {
  value?: number;
  onChange?: (score: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((score) => (
        <button
          key={score}
          type="button"
          disabled={disabled}
          onClick={() => onChange?.(score)}
          className={cn(
            'h-8 w-8 rounded-md border text-sm font-medium transition-colors',
            value === score
              ? 'border-brand bg-brand text-white'
              : 'border-gray-300 bg-white text-gray-700',
            !disabled && value !== score && 'hover:bg-gray-100',
            disabled && 'cursor-default',
          )}
        >
          {score}
        </button>
      ))}
    </div>
  );
}

/** Rate the employee's objectives under the cycle's goals, as the employee, their manager, or read-only. */
export function AssessmentForm({
  assessment,
  cycle,
  employeeName,
  mode,
  onSubmit,
  onCancel,
}: Props) {
  const goals = useAppraisalGoalsStore((s) => s.goals);
  const allObjectives = useEmployeeObjectivesStore((s) => s.objectives);
  const entries = useMemo(
    () => goalsWithObjectives(cycle, goals, allObjectives, assessment.employeeId),
    [cycle, goals, allObjectives, assessment.employeeId],
  );
  const objectiveCount = entries.reduce((sum, e) => sum + e.objectives.length, 0);

  const [ratings, setRatings] = useState<Ratings>(
    mode === 'self' ? assessment.selfRatings : assessment.managerRatings,
  );
  const [comment, setComment] = useState(assessment.managerComment ?? '');
  const [showErrors, setShowErrors] = useState(false);

  const editing = mode !== 'view';
  const missing = entries.flatMap((e) => e.objectives).filter((o) => !ratings[o.id]?.score);
  const score = overallScore(assessment, entries);

  const setRating = (id: string, patch: Partial<Ratings[string]>) =>
    setRatings((prev) => ({
      ...prev,
      [id]: { ...{ score: 0, comment: '' }, ...prev[id], ...patch },
    }));

  const submit = () => {
    if (missing.length > 0) {
      setShowErrors(true);
      return;
    }
    onSubmit?.(ratings, comment.trim());
  };

  return (
    <div className="flex flex-col gap-4">
      <div className={cardClass('p-5 flex flex-wrap items-start justify-between gap-3')}>
        <div>
          <h2 className="text-base font-semibold text-gray-900">{cycle.title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{employeeName}</p>
        </div>
        {score !== null && (
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{score}%</p>
            <p className="text-xs text-gray-500">Overall score</p>
          </div>
        )}
      </div>

      {mode === 'manager' && assessment.rejectionReason && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          HR sent this review back: {assessment.rejectionReason}
        </div>
      )}

      {objectiveCount === 0 ? (
        <div className={cardClass('p-8 text-center text-sm text-gray-400')}>
          No objectives have been added under this cycle&apos;s goals yet.
        </div>
      ) : (
        entries.map(({ goal, objectives }) => (
          <div key={goal.id} className={cardClass('p-5 flex flex-col gap-4')}>
            <p className="text-sm font-semibold text-gray-900">{goal.name}</p>
            {objectives.map((o) => {
              const self = assessment.selfRatings[o.id];
              const manager = assessment.managerRatings[o.id];
              const current = ratings[o.id];
              const invalid = showErrors && editing && !current?.score;
              return (
                <div key={o.id} className="flex flex-col gap-3 border-t border-gray-100 pt-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{o.name}</p>
                  </div>

                  {mode === 'manager' && (
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs font-medium text-gray-500">Self assessment</p>
                      <p className="text-sm text-gray-900">
                        {self?.score ?? '—'} / {RATING_MAX}
                      </p>
                      {self?.comment && (
                        <p className="text-xs text-gray-600 mt-0.5">{self.comment}</p>
                      )}
                    </div>
                  )}

                  {mode === 'view' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Self</p>
                        <RatingPicker value={self?.score} disabled />
                        {self?.comment && (
                          <p className="text-xs text-gray-600 mt-1">{self.comment}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Manager</p>
                        <RatingPicker value={manager?.score} disabled />
                        {manager?.comment && (
                          <p className="text-xs text-gray-600 mt-1">{manager.comment}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium text-gray-500">
                        {mode === 'self' ? 'Your rating' : 'Manager rating'}
                      </p>
                      <RatingPicker
                        value={current?.score}
                        onChange={(s) => setRating(o.id, { score: s })}
                      />
                      {invalid && <p className="text-xs text-red-500">Pick a rating</p>}
                      <input
                        value={current?.comment ?? ''}
                        onChange={(e) => setRating(o.id, { comment: e.target.value })}
                        placeholder="Comment (optional)"
                        className="rounded-input border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-brand"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}

      {(mode === 'manager' || (mode === 'view' && assessment.managerComment)) && (
        <div className={cardClass('p-5 flex flex-col gap-2')}>
          <p className="text-sm font-semibold text-gray-900">Manager comment</p>
          {mode === 'manager' ? (
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Overall comment (optional)"
              className="w-full resize-none rounded-input border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          ) : (
            <p className="text-sm text-gray-700">{assessment.managerComment}</p>
          )}
        </div>
      )}

      {mode === 'view' && assessment.hrComment && (
        <div className={cardClass('p-5')}>
          <p className="text-sm font-semibold text-gray-900">HR comment</p>
          <p className="mt-1 text-sm text-gray-700">{assessment.hrComment}</p>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          {editing ? 'Cancel' : 'Back'}
        </Button>
        {editing && (
          <Button onClick={submit} disabled={objectiveCount === 0}>
            {mode === 'self' ? 'Submit assessment' : 'Submit review'}
          </Button>
        )}
      </div>
    </div>
  );
}
