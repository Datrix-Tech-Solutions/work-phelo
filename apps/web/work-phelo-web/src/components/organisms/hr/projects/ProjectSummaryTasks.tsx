'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { AvatarStack } from '@/components/atoms/AvatarStack';
import { TypeChipSelect, TypeChipOption } from '@/components/atoms/TypeChipSelect';
import { TaskTimeBadge } from '@/components/molecules/hr/projects/TaskTimeBadge';
import { Pagination } from '@/components/molecules/shared/Pagination';
import { useProjectSetup } from '@/hooks';
import { useProjectObjectives } from '@/hooks/hr/useProjectWork';
import { objectiveChipOptions } from '@/lib/objectiveChipOptions';
import { PRIORITY_TYPE_CHIP_COLORS } from '@/lib/priorityColors';
import { isOverdue } from '@/lib/projectPeople';
import { taskAssignees } from '@/lib/taskAssignees';
import { TASK_STATUS_META } from '@/lib/taskStatus';
import { WorkTypeIconBadge } from '@/lib/workTypeIcons';
import { cardClass, cn, inputClass } from '@/lib/utils';
import type { ProjectTask, TaskStatus } from '@/types/hr';

const PAGE_SIZE = 10;
// The task page's columns, so a task looks the same in both places.
const ROW_GRID =
  'grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_110px_120px_120px_90px] items-center gap-x-4';

const STATUS_OPTIONS: TypeChipOption[] = (Object.keys(TASK_STATUS_META) as TaskStatus[]).map(
  (value) => ({
    value,
    label: TASK_STATUS_META[value].label,
    color: TASK_STATUS_META[value].chip,
  }),
);

const formatDue = (iso: string) =>
  `Due ${new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

// The chips only show a value here; tasks are changed on the task pages.
const noChange = () => {};

/** The filtered tasks, listed the way the task page lists them, to read. */
export function SummaryTasks({
  projectId,
  tasks,
  filterLabel,
  onClearFilter,
}: {
  projectId: string;
  tasks: ProjectTask[];
  /** What the cards above have narrowed the list to, if anything. */
  filterLabel?: string;
  onClearFilter: () => void;
}) {
  const config = useProjectSetup(projectId)?.config;
  const { data: objectives = [] } = useProjectObjectives(projectId);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const priorityOptions: TypeChipOption[] = (config?.priorities ?? []).map((p) => ({
    value: p.name,
    label: p.name,
    color: PRIORITY_TYPE_CHIP_COLORS[p.color],
  }));
  const objectiveOptions = objectiveChipOptions(objectives);

  const q = search.trim().toLowerCase();
  // Overdue first, then by due date, with finished work last.
  const rank = (t: ProjectTask) => (isOverdue(t) ? 0 : t.status === 'DONE' ? 2 : 1);
  const rows = tasks
    .filter((t) => !q || t.name.toLowerCase().includes(q))
    .sort((a, b) => rank(a) - rank(b) || (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'));
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search tasks…"
            className={inputClass(undefined, 'pl-9')}
          />
        </div>
        {filterLabel && (
          <button
            type="button"
            onClick={onClearFilter}
            aria-label={`Clear the ${filterLabel} filter`}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1.5 text-xs font-medium text-brand"
          >
            {filterLabel}
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* The rows scroll sideways in a narrow column rather than being cut off. */}
      <section
        className={cardClass('overflow-x-auto [&>*]:min-w-[46rem] [&>*:first-child]:border-t-0')}
      >
        {rows.length === 0 && <p className="px-4 py-4 text-sm text-gray-400">No tasks found.</p>}
        {rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map((task) => {
          const icon = config?.workTypes.find((w) => w.name === task.workType)?.icon ?? 'TASK';
          const done = task.status === 'DONE';
          const assignees = taskAssignees(task);
          return (
            <div
              key={task.id}
              className={cn(ROW_GRID, 'px-4 py-1 border-t border-gray-100 text-sm text-gray-800')}
            >
              <div className="flex items-center gap-3 min-w-0">
                <WorkTypeIconBadge icon={icon} size="lg" />
                <div className="min-w-0">
                  <p
                    className={cn(
                      'font-medium text-gray-900 truncate',
                      done && 'line-through text-gray-400',
                    )}
                  >
                    {task.name}
                  </p>
                  {task.dueDate && (
                    <p
                      className={cn(
                        'text-xs mt-0.5',
                        isOverdue(task) ? 'text-red-500' : 'text-gray-400',
                      )}
                    >
                      {formatDue(task.dueDate)}
                    </p>
                  )}
                </div>
              </div>
              <TypeChipSelect
                value={task.objectiveId ?? ''}
                options={objectiveOptions}
                emptyLabel="—"
                readOnly
                onChange={noChange}
              />
              <TypeChipSelect
                value={task.priorityName ?? ''}
                options={priorityOptions}
                readOnly
                onChange={noChange}
              />
              <TypeChipSelect
                value={task.status}
                options={STATUS_OPTIONS}
                readOnly
                onChange={noChange}
              />
              {assignees.length > 0 ? (
                <AvatarStack people={assignees} size={32} />
              ) : (
                <span className="text-gray-400">—</span>
              )}
              <TaskTimeBadge
                taskId={task.id}
                projectId={projectId}
                timed={!!task.isTimed}
                empty={<span className="text-gray-400">—</span>}
              />
            </div>
          );
        })}
      </section>

      <Pagination currentPage={current} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
