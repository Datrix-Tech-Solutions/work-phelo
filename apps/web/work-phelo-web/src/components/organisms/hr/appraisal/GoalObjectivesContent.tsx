'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { ObjectiveCard } from '@/components/molecules/hr/employees/ObjectivesSection';
import { SetGoalObjectivePanel } from '@/components/organisms/hr/appraisal/SetGoalObjectivePanel';
import { eligibleEmployees } from '@/components/organisms/hr/appraisal/CreateGoalModal';
import {
  useAddObjectiveComment,
  useGoalObjectives,
  useGoalCycles,
  useLinkObjective,
} from '@/hooks/hr/useGoalAppraisals';
import { usePermission } from '@/hooks/hr/usePermission';
import { cyclesForObjective } from '@/lib/appraisalAssessments';
import { Permission } from '@/lib/permissionMap';
import { cn } from '@/lib/utils';
import { cardClass } from '@/lib/utils';
import type { Goal } from '@/types/appraisal';
import type { Employee } from '@/types/hr';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import { useGoals } from '@/hooks/hr/useGoalAppraisals';

interface Props {
  goalId: string;
}

/** Pick one of a goal's employees and set the objectives they are measured on under it. */
export function GoalObjectivesContent({ goalId }: Props) {
  const { goals, isLoading } = useGoals();
  const goal = goals.find((g) => g.id === goalId);
  const { data: employeeData } = useAllEmployees();
  const employees = useMemo(() => employeeData?.data ?? [], [employeeData]);
  if (!goal) {
    return isLoading ? null : <p className="text-sm text-gray-400">Goal not found.</p>;
  }
  return <GoalObjectives goal={goal} employees={employees} />;
}

function GoalObjectives({ goal, employees }: { goal: Goal; employees: Employee[] }) {
  const members = useMemo(
    () => eligibleEmployees(employees).filter((e) => goal.employeeIds.includes(e.id)),
    [employees, goal.employeeIds],
  );
  const [selectedId, setSelectedId] = useState<string | undefined>(members[0]?.id);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  // Bumped on every open so the panel starts fresh.
  const [panelKey, setPanelKey] = useState(0);

  const canAdd = usePermission(Permission.CREATE_OBJECTIVE_FOR_OTHERS);
  // One request for the whole goal: the counts and the picked employee's cards come from it.
  const { objectives: goalObjectives } = useGoalObjectives(goal.id);
  const countOf = (employeeId: string) =>
    goalObjectives.filter((o) => o.employeeId === employeeId).length;
  const { cycles } = useGoalCycles();
  const linkObjective = useLinkObjective();
  const addComment = useAddObjectiveComment();

  const underGoal = goalObjectives.filter((o) => o.employeeId === selectedId);
  const selected = members.find((e) => e.id === selectedId);

  const shown = members.filter((e) =>
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Objectives: {goal.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              What each employee on this goal has been set. Pick an employee to see theirs
            </p>
          </div>
          {canAdd && members.length > 0 && (
            <Button
              onClick={() => {
                setPanelKey((k) => k + 1);
                setPanelOpen(true);
              }}
            >
              <Plus className="w-4 h-4" /> Set objective
            </Button>
          )}
        </div>
      </div>
      {members.length === 0 ? (
        <p className={cardClass('py-10 text-center text-sm text-gray-400')}>
          No employees on this goal yet. Edit the goal to choose who it applies to.
        </p>
      ) : (
        <div className="grid grid-cols-[16rem_1fr] gap-6 items-start">
          <div className="flex flex-col gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees"
              className="rounded-input border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-brand"
            />
            <ul className="flex flex-col gap-1 max-h-[32rem] overflow-y-auto">
              {shown.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(e.id)}
                    className={cn(
                      'w-full text-left rounded-input px-3 py-2 text-sm transition-colors',
                      e.id === selectedId
                        ? 'bg-brand/10 text-brand font-medium'
                        : 'text-gray-700 hover:bg-gray-100',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {e.firstName} {e.lastName}
                      </span>
                      <span
                        className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-600"
                        title="Objectives under this goal"
                      >
                        {countOf(e.id)}
                      </span>
                    </span>
                    <span className="block text-xs text-gray-400 font-normal">{e.jobTitle}</span>
                  </button>
                </li>
              ))}
              {shown.length === 0 && <li className="px-3 py-2 text-sm text-gray-400">No match.</li>}
            </ul>
          </div>

          <div className="flex flex-col gap-4 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">
                {selected ? `${selected.firstName} ${selected.lastName}` : 'Select an employee'}
              </h3>
            </div>

            {underGoal.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">
                No objectives under this goal yet.
              </p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4 items-start">
                {underGoal.map((o) => (
                  <ObjectiveCard
                    key={o.id}
                    objective={o}
                    cycleNames={cyclesForObjective(o, cycles).map((c) => c.title)}
                    onLink={(goalId) => linkObjective.mutate({ id: o.id, goalId })}
                    onAddComment={(body) => addComment.mutate({ id: o.id, body })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <SetGoalObjectivePanel
        key={panelKey}
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        goalId={goal.id}
        goalName={goal.name}
        members={members}
        initialIds={selectedId ? [selectedId] : []}
      />
    </div>
  );
}
