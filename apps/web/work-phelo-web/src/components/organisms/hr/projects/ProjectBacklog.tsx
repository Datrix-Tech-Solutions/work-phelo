'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, Search, Timer } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { QuickAddTaskRow } from '@/components/molecules/hr/projects/QuickAddTaskRow';
import { TaskTimeBadge } from '@/components/molecules/hr/projects/TaskTimeBadge';
import { AvatarStack } from '@/components/atoms/AvatarStack';
import { TableButton } from '@/components/atoms/TableButton';
import { ThreeDotMenu } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { TypeChip } from '@/components/atoms/TypeChip';
import { TypeChipSelect, TypeChipOption } from '@/components/atoms/TypeChipSelect';
import {
  useProjectTasks,
  useProjectSetup,
  useUpdateProjectTask,
  useUpdateTaskStatus,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { useTaskDialogs } from '@/hooks/hr/useTaskDialogs';
import { useSprintDialog } from '@/hooks/hr/useSprintDialog';
import { objectiveChipOptions } from '@/lib/objectiveChipOptions';
import { PRIORITY_TYPE_CHIP_COLORS } from '@/lib/priorityColors';
import { sprintState } from '@/lib/projectSprints';
import { buildBacklogRows, WorkRow } from '@/lib/projectWorkTree';
import { TASK_STATUS_META, TASK_STATUS_FILTER_OPTIONS } from '@/lib/taskStatus';
import { WorkTypeIconBadge } from '@/lib/workTypeIcons';
import { cardClass, cn, inputClass, todayLocal } from '@/lib/utils';
import {
  useCompleteSprint,
  useProjectObjectives,
  useProjectSprints,
  useRemoveSprint,
  useSaveWithToast,
} from '@/hooks/hr/useProjectWork';
import { objectiveByTaskId as objectiveMap } from '@/lib/taskMaps';
import type { ProjectSprint, TaskStatus } from '@/types/hr';

// One grid for every row, so the columns line up from section to section.
const ROW_GRID =
  'grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_110px_120px_120px_90px] items-center gap-x-4';
// The List adds three date columns after those.
const LIST_ROW_GRID =
  'grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_110px_120px_120px_90px_100px_100px_100px] items-center gap-x-4';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDue(dateStr: string) {
  const d = new Date(dateStr);
  return `Due ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

interface SectionProps {
  title: React.ReactNode;
  /** Shown after the title, e.g. the dates and state of a sprint. */
  meta?: React.ReactNode;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** A collapsible group of tasks: a header you click to fold it, and its rows below. */
function Section({ title, meta, count, collapsed, onToggle, actions, children }: SectionProps) {
  return (
    <section className={cardClass('overflow-hidden')}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className="flex items-center gap-3 px-4 py-1 min-h-10 cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <ChevronRight
          className={cn(
            'w-4 h-4 shrink-0 text-gray-400 transition-transform',
            !collapsed && 'rotate-90',
          )}
        />
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          {meta}
          <span className="text-xs text-gray-400">
            {count} {count === 1 ? 'task' : 'tasks'}
          </span>
        </div>
        {actions && (
          <div
            className="ml-auto flex items-center gap-3 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>
      {!collapsed && children}
    </section>
  );
}

/** A small labelled date, since the rows have no column headers. */
function DateCell({ label, value, overdue }: { label: string; value?: string; overdue?: boolean }) {
  return (
    <div className="flex flex-col leading-tight min-w-0">
      <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</span>
      <span className={cn('text-xs truncate', overdue ? 'text-red-500' : 'text-gray-700')}>
        {value ? formatDate(value) : '—'}
      </span>
    </div>
  );
}

interface Props {
  projectId: string;
  /**
   * `backlog` groups tasks into collapsible sprints and the backlog, and can create sprints.
   * `list` is every task in one flat list with created, updated and due dates, and no sprints.
   */
  layout?: 'backlog' | 'list';
  /** Shown at the end of the toolbar, e.g. a switch to another view of the same tasks. */
  viewToggle?: React.ReactNode;
}

export function ProjectBacklog({ projectId, layout = 'backlog', viewToggle }: Props) {
  const isList = layout === 'list';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // The sprint waiting on a "complete it?" confirmation.
  const [completing, setCompleting] = useState<ProjectSprint | null>(null);

  const {
    canModify,
    openCreate,
    openDetails,
    quickCreate,
    isQuickCreating,
    defaultTimed,
    dialogs,
  } = useTaskDialogs(projectId);
  const { data: tasks = [], isLoading } = useProjectTasks(projectId);
  const { openSprint, dialog: sprintDialog } = useSprintDialog(projectId, tasks);

  const { data: objectives = [] } = useProjectObjectives(projectId);
  const { data: sprints = [] } = useProjectSprints(projectId);
  const removeSprint = useRemoveSprint(projectId);
  const completeSprint = useCompleteSprint(projectId);
  const updateTask = useUpdateProjectTask();
  const updateStatus = useUpdateTaskStatus();
  const save = useSaveWithToast();
  const toast = useToastStore((s) => s.addToast);
  const config = useProjectSetup(projectId)?.config;
  const objectiveByTaskId = useMemo(() => objectiveMap(tasks), [tasks]);
  const today = todayLocal();

  // The choices each chip offers when you click it.
  const statusOptions: TypeChipOption[] = (
    Object.keys(TASK_STATUS_META) as Array<keyof typeof TASK_STATUS_META>
  ).map((value) => ({
    value,
    label: TASK_STATUS_META[value].label,
    color: TASK_STATUS_META[value].chip,
  }));
  const priorityOptions: TypeChipOption[] = (config?.priorities ?? []).map((p) => ({
    value: p.name,
    label: p.name,
    color: PRIORITY_TYPE_CHIP_COLORS[p.color],
  }));
  const objectiveChipChoices = objectiveChipOptions(objectives);

  const changeTask = async (
    taskId: string,
    data: { objectiveId?: string | null; priorityName?: string },
  ) => {
    try {
      await updateTask.mutateAsync({ projectId, taskId, data });
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    }
  };

  const changeStatus = async (taskId: string, status: string) => {
    try {
      await updateStatus.mutateAsync({ taskId, status: status as TaskStatus });
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    }
  };

  const rows = useMemo(
    () =>
      buildBacklogRows({
        tasks,
        objectives,
        objectiveByTaskId,
        search,
        status: statusFilter,
      }),
    [tasks, objectives, objectiveByTaskId, search, statusFilter],
  );

  const inSprint = useMemo(() => new Set(sprints.flatMap((sp) => sp.taskIds)), [sprints]);
  const backlogRows = rows.filter((r) => !inSprint.has(r.id));
  const filtering = !!(search || statusFilter);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderRow = (row: WorkRow) => {
    const icon = config?.workTypes.find((w) => w.name === row.task.workType)?.icon ?? 'TASK';
    const done = row.task.status === 'DONE';
    return (
      <div
        key={row.id}
        role="button"
        tabIndex={0}
        onClick={() => openDetails(row.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') openDetails(row.id);
        }}
        className={cn(
          isList ? LIST_ROW_GRID : ROW_GRID,
          'px-4 py-1 border-t border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors text-sm text-gray-800',
        )}
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
              {row.name}
            </p>
            {!isList && row.task.dueDate && (
              <p className="text-xs text-gray-400 mt-0.5">{formatDue(row.task.dueDate)}</p>
            )}
          </div>
        </div>
        <TypeChipSelect
          value={objectiveByTaskId[row.id] ?? ''}
          options={objectiveChipChoices}
          emptyLabel="—"
          readOnly={!canModify || objectives.length === 0}
          onChange={(id) => changeTask(row.id, { objectiveId: id || null })}
        />
        <TypeChipSelect
          value={row.task.priorityName ?? ''}
          options={priorityOptions}
          readOnly={!canModify || priorityOptions.length === 0}
          onChange={(name) => changeTask(row.id, { priorityName: name })}
        />
        <TypeChipSelect
          value={row.task.status}
          options={statusOptions}
          readOnly={!canModify}
          onChange={(v) => changeStatus(row.id, v)}
        />
        {row.assignees.length > 0 ? (
          <AvatarStack people={row.assignees} size={32} />
        ) : (
          <span className="text-gray-400">—</span>
        )}
        <TaskTimeBadge
          taskId={row.id}
          projectId={projectId}
          timed={!!row.task.isTimed}
          empty={<span className="text-gray-400">—</span>}
        />
        {isList && (
          <>
            <DateCell label="Created" value={row.task.createdAt} />
            <DateCell label="Updated" value={row.task.updatedAt ?? row.task.createdAt} />
            <DateCell
              label="Due"
              value={row.task.dueDate ?? undefined}
              overdue={!!row.task.dueDate && !done && row.task.dueDate.slice(0, 10) < today}
            />
          </>
        )}
      </div>
    );
  };

  // The inline row that ends each list; a sprint's adds the new task to that sprint.
  const createFooter = (sprintId?: string) =>
    canModify ? (
      <QuickAddTaskRow
        projectId={projectId}
        isCreating={isQuickCreating}
        objectiveOptions={objectiveChipChoices}
        defaultTimed={defaultTimed}
        onCreate={(values) => quickCreate({ ...values, sprintId })}
      />
    ) : null;

  const empty = (message: string) => (
    <p className="px-4 py-4 border-t border-gray-100 text-sm text-gray-400">{message}</p>
  );

  // A sprint can only be completed once every one of its tasks is done.
  const unfinishedCount = (sprint: ProjectSprint) =>
    tasks.filter((t) => sprint.taskIds.includes(t.id) && t.status !== 'DONE').length;

  const sprintActions = (sprint: ProjectSprint) =>
    canModify ? (
      <>
        {!sprint.completedAt && (
          <TableButton
            variant="green"
            disabled={unfinishedCount(sprint) > 0}
            tooltip={
              unfinishedCount(sprint) > 0
                ? `${unfinishedCount(sprint)} ${unfinishedCount(sprint) === 1 ? 'task is' : 'tasks are'} not done yet`
                : undefined
            }
            onClick={() => setCompleting(sprint)}
          >
            Complete Sprint
          </TableButton>
        )}
        <ThreeDotMenu
          actions={[
            { label: 'Edit', onClick: () => openSprint(sprint) },
            {
              label: 'Delete',
              danger: true,
              onClick: () => save(removeSprint.mutateAsync(sprint.id)),
            },
          ]}
        />
      </>
    ) : undefined;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="h-32 rounded-card bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar: no table around it, just the controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks, objectives or assignee…"
            className={inputClass(undefined, 'pl-9')}
          />
        </div>
        <div className="w-44">
          <SearchSelect
            size="sm"
            placeholder="Status"
            allLabel="All statuses"
            options={TASK_STATUS_FILTER_OPTIONS}
            value={statusFilter}
            showAllOption
            onChange={setStatusFilter}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {canModify && (
            <>
              {!isList && (
                <Button variant="outline" onClick={() => openSprint()}>
                  Create Sprint
                </Button>
              )}
              <Button onClick={openCreate}>Create Task</Button>
            </>
          )}
          {viewToggle}
        </div>
      </div>

      {isList ? (
        // One flat card of every task: no sections, so the first row needs no top border.
        <section className={cardClass('overflow-hidden [&>*:first-child]:border-t-0')}>
          {rows.length > 0
            ? rows.map(renderRow)
            : empty(tasks.length === 0 ? 'No tasks yet.' : 'No tasks found.')}
        </section>
      ) : (
        <>
          {sprints.map((sprint) => {
            const sprintRows = rows.filter((r) => sprint.taskIds.includes(r.id));
            if (filtering && sprintRows.length === 0) return null;
            const state = sprintState(sprint, today);
            return (
              <Section
                key={sprint.id}
                title={
                  <span className="flex items-center gap-1.5">
                    <Timer className="w-4 h-4 text-gray-400" />
                    {sprint.name}
                  </span>
                }
                meta={
                  <>
                    <span className="text-xs text-gray-400">
                      {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
                    </span>
                    <TypeChip label={state.label} color={state.color} />
                  </>
                }
                count={sprintRows.length}
                collapsed={collapsed.has(sprint.id)}
                onToggle={() => toggle(sprint.id)}
                actions={sprintActions(sprint)}
              >
                {sprintRows.length > 0
                  ? sprintRows.map(renderRow)
                  : empty('No tasks in this sprint yet. Use Edit to add some.')}
                {!sprint.completedAt && createFooter(sprint.id)}
              </Section>
            );
          })}

          {(!filtering || backlogRows.length > 0) && (
            <Section
              title="Backlog"
              count={backlogRows.length}
              collapsed={collapsed.has('backlog')}
              onToggle={() => toggle('backlog')}
            >
              {backlogRows.length > 0
                ? backlogRows.map(renderRow)
                : empty(tasks.length === 0 ? 'No tasks yet.' : 'Every task is in a sprint.')}
              {createFooter()}
            </Section>
          )}
        </>
      )}

      {dialogs}
      {!isList && sprintDialog}

      <Modal
        isOpen={!!completing}
        onClose={() => setCompleting(null)}
        title={`Complete ${completing?.name ?? 'sprint'}?`}
        description="All of its tasks are done. The sprint will be marked completed."
        width="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompleting(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!completing) return;
                save(
                  completeSprint.mutateAsync({
                    id: completing.id,
                    keepTaskIds: completing.taskIds,
                  }),
                );
                setCompleting(null);
              }}
            >
              Complete Sprint
            </Button>
          </>
        }
      />
    </div>
  );
}
