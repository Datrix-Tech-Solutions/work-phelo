import { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useMyProfile } from '@/hooks/hr/useEmployees';
import {
  useAddObjectiveComment,
  useCreateObjective,
  useEmployeeObjectives,
  useGoalCycles,
  useGoals,
  useLinkObjective,
} from '@/hooks/hr/useGoalAppraisals';
import { usePermission } from '@/hooks/hr/usePermission';
import { cyclesForObjective } from '@/lib/appraisalAssessments';
import { Permission } from '@/lib/permissionMap';
import { cardClass, cn } from '@/lib/utils';
import type { EmployeeObjective } from '@/types/appraisal';
import { AddObjectivePanel } from '@/components/organisms/hr/performance/AddObjectivePanel';

interface Props {
  /** Whose objectives these are; HR's view of an employee and their own profile share them. */
  employeeId: string;
  projects: { id: string; name: string }[];
}

export function ObjectivesSection({ employeeId, projects }: Props) {
  const { objectives } = useEmployeeObjectives(employeeId);
  const { cycles } = useGoalCycles();
  const { goals } = useGoals();
  const createObjective = useCreateObjective();
  const linkObjective = useLinkObjective();
  const addComment = useAddObjectiveComment();
  const [panelOpen, setPanelOpen] = useState(false);

  // Adding for yourself and for someone else are separate permissions.
  const { data: me } = useMyProfile();
  const canCreateOwn = usePermission(Permission.CREATE_OWN_OBJECTIVE);
  const canCreateForOthers = usePermission(Permission.CREATE_OBJECTIVE_FOR_OTHERS);
  const canAdd = me?.id === employeeId ? canCreateOwn : canCreateForOthers;

  return (
    <div className="flex flex-col gap-4">
      <div className={cardClass('px-4 py-2 flex items-center justify-between gap-3')}>
        <h3 className="text-sm font-semibold text-gray-900">Objectives</h3>
        {canAdd && (
          <Button onClick={() => setPanelOpen(true)}>
            <Plus className="w-4 h-4" /> Add objective
          </Button>
        )}
      </div>

      {objectives.length === 0 ? (
        <div className={cardClass('p-8 text-center text-sm text-gray-400')}>No objectives yet.</div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,22rem))] gap-4 items-start">
          {objectives.map((o) => (
            <ObjectiveCard
              key={o.id}
              objective={o}
              cycleNames={cyclesForObjective(o, cycles).map((c) => c.title)}
              goalOptions={canAdd ? goals.map((g) => ({ value: g.id, label: g.name })) : undefined}
              onLink={(goalId) => linkObjective.mutate({ id: o.id, goalId })}
              onAddComment={(body) => addComment.mutate({ id: o.id, body })}
            />
          ))}
        </div>
      )}

      <AddObjectivePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        projects={projects}
        onSave={(o) =>
          createObjective.mutate({
            employeeId,
            goalId: o.goalId || undefined,
            name: o.name,
            comments: o.comments,
          })
        }
      />
    </div>
  );
}

function ObjectiveCard({
  objective,
  cycleNames,
  goalOptions,
  onLink,
  onAddComment,
}: {
  objective: EmployeeObjective;
  cycleNames: string[];
  /** Goals it can be linked to; left out when the viewer can't change objectives. */
  goalOptions?: { value: string; label: string }[];
  onLink: (goalId: string) => void;
  onAddComment: (text: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newComment, setNewComment] = useState('');
  const total = objective.comments.length;

  return (
    <div className={cardClass('flex flex-col')}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex items-start gap-3 p-5 min-h-32 text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{objective.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {objective.goal ? `Goal: ${objective.goal.name}` : 'No goal yet'}
          </p>
          {cycleNames.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">Cycle: {cycleNames.join(', ')}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">Created by {objective.createdByName}</p>
          {!expanded && total > 0 && (
            <p className="text-xs text-gray-500 mt-3">
              {total} {total === 1 ? 'comment' : 'comments'}
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 mt-0.5 text-gray-400 shrink-0 transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-gray-100 p-5">
          {total === 0 ? (
            <p className="text-sm text-gray-400">No comments added.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {objective.comments.map((c) => (
                <li key={c.id} className="text-sm text-gray-700">
                  {c.body}
                </li>
              ))}
            </ul>
          )}
          {!objective.goal && goalOptions && (
            <SearchSelect
              label="Link to a goal"
              placeholder={goalOptions.length === 0 ? 'No goals yet' : 'Select goal'}
              options={goalOptions}
              value=""
              onChange={(goalId) => goalId && onLink(goalId)}
              disabled={goalOptions.length === 0}
            />
          )}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const text = newComment.trim();
              if (!text) return;
              onAddComment(text);
              setNewComment('');
            }}
          >
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment"
              className="flex-1 min-w-0 rounded-input border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-brand"
            />
            <Button type="submit" variant="outline" disabled={!newComment.trim()}>
              <Plus className="w-4 h-4" /> Add
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
