'use client';

import { useMemo } from 'react';
import { Avatar } from '@/components/atoms/Avatar';
import { ProgressRow } from '@/components/molecules/hr/projects/ProgressRow';
import { PieBreakdown } from '@/components/molecules/hr/projects/PieBreakdown';
import { useProjectMembers, useProjectSetup, useProjectTasks } from '@/hooks';
import { projectProgress } from '@/lib/projectProgress';
import { PRIORITY_COLORS } from '@/lib/priorityColors';
import { TASK_STATUS_META } from '@/lib/taskStatus';
import { ProjectMembersTable } from '@/components/organisms/hr/projects/ProjectMembersTable';
import { useProject } from '@/hooks';
import { taskAssignees } from '@/lib/taskAssignees';
import { WORK_TYPE_ICONS } from '@/lib/workTypeIcons';
import { cardClass } from '@/lib/utils';
import { useProjectLabels } from '@/hooks/useModuleLabels';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { useProjectTime } from '@/hooks/hr/useProjectTime';
import { accruedAmount, formatHoursMinutes } from '@/lib/taskTime';
import { formatMoney } from '@/lib/projectPricing';
import { useProjectObjectives } from '@/hooks/hr/useProjectWork';
import { objectiveByTaskId as objectiveMap } from '@/lib/taskMaps';
import type { ProjectTask, TaskStatus } from '@/types/hr';

function SummaryCard({
  title,
  legend,
  children,
}: {
  title: string;
  /** Sits on the title row, after the title. */
  legend?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={cardClass('p-5 flex flex-col gap-4 h-full')}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {legend}
      </div>
      {children}
    </section>
  );
}

const STATUS_ORDER: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'ON_HOLD', 'DONE'];
// The same colours the status chips use: gray, blue, red, green.
const STATUS_COLORS: Record<TaskStatus, string> = {
  TODO: '#9ca3af',
  IN_PROGRESS: '#3b82f6',
  ON_HOLD: '#ef4444',
  DONE: '#22c55e',
};

const EMPTY = <p className="text-sm text-gray-400">Nothing to show yet.</p>;

interface Group {
  name: string;
  color: string;
  count: number;
}

/** One stacked bar and, under it, the same numbers listed, so no value depends on colour alone. */
function BreakdownBar({ groups, total }: { groups: Group[]; total: number }) {
  return (
    <div className="flex flex-col gap-4">
      {/* The bar: 2px gaps between segments, rounded ends, a tooltip on each segment. */}
      <div className="flex h-4 gap-0.5">
        {groups.map((g, i) => (
          <div
            key={g.name}
            className={`group relative min-w-1.5 ${i === 0 ? 'rounded-l-full' : ''} ${
              i === groups.length - 1 ? 'rounded-r-full' : ''
            }`}
            style={{ flexGrow: g.count, backgroundColor: g.color }}
          >
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block">
              {g.name} · {g.count} {g.count === 1 ? 'task' : 'tasks'} (
              {Math.round((g.count / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {groups.map((g) => (
          <li key={g.name} className="flex items-center gap-2.5 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: g.color }}
            />
            <span className="text-gray-900 truncate">{g.name}</span>
            <span className="ml-auto shrink-0 text-gray-900 font-medium">{g.count}</span>
            <span className="w-10 shrink-0 text-right text-xs text-gray-400">
              {Math.round((g.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Where the project's tasks stand: To Do, In Progress, On Hold, Done, as a pie. */
function StatusOverview({ tasks }: { tasks: ProjectTask[] }) {
  if (tasks.length === 0) return EMPTY;
  const slices = STATUS_ORDER.map((status) => ({
    label: TASK_STATUS_META[status].label,
    color: STATUS_COLORS[status],
    value: tasks.filter((t) => t.status === status).length,
  })).filter((slice) => slice.value > 0);
  const done = tasks.filter((t) => t.status === 'DONE').length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-600">
        <span className="font-semibold text-gray-900">{done}</span> of {tasks.length}{' '}
        {tasks.length === 1 ? 'task' : 'tasks'} done
      </p>
      <PieBreakdown slices={slices} unit="task" className="h-40" />
    </div>
  );
}

/** Tasks split by work type. */
function WorkTypeBreakdown({ projectId, tasks }: { projectId: string; tasks: ProjectTask[] }) {
  const config = useProjectSetup(projectId)?.config;

  const groups = useMemo(() => {
    const byName = new Map<string, Group>();
    for (const task of tasks) {
      const name = task.workType || 'Task';
      const icon = config?.workTypes.find((w) => w.name === name)?.icon ?? 'TASK';
      const entry = byName.get(name) ?? { name, color: WORK_TYPE_ICONS[icon].chartColor, count: 0 };
      entry.count += 1;
      byName.set(name, entry);
    }
    return [...byName.values()].sort((a, b) => b.count - a.count);
  }, [tasks, config]);

  if (tasks.length === 0) return EMPTY;
  return <BreakdownBar groups={groups} total={tasks.length} />;
}

const NO_PRIORITY = { name: 'No priority', color: '#9ca3af' };

/**
 * How many open tasks each member holds. Each bar is split by priority, in the project's own order and
 * colours, so you see who carries the urgent work, not only who has the most. Done tasks are a count.
 */
function MemberWorkload({ projectId, tasks }: { projectId: string; tasks: ProjectTask[] }) {
  const { data: members = [] } = useProjectMembers(projectId);
  const priorities = useProjectSetup(projectId)?.config?.priorities;

  // The legend and the segment order: the project's priorities, lowest to highest, then "no priority".
  const levels = useMemo(
    () => [
      ...(priorities ?? []).map((p) => ({ name: p.name, color: PRIORITY_COLORS[p.color].hex })),
      NO_PRIORITY,
    ],
    [priorities],
  );

  const rows = useMemo(() => {
    const count = (match: (ids: string[]) => boolean) => {
      const own = tasks.filter((t) => match(taskAssignees(t).map((a) => a.id)));
      const open = own.filter((t) => t.status !== 'DONE');
      const segments = levels
        .map((level) => ({
          ...level,
          count: open.filter((t) => {
            const name = t.priorityName;
            return level === NO_PRIORITY
              ? !name || !levels.some((l) => l.name === name)
              : name === level.name;
          }).length,
        }))
        .filter((seg) => seg.count > 0);
      return { open: open.length, done: own.length - open.length, segments };
    };
    const people = members.map((m) => ({
      id: m.employeeId,
      name: m.name,
      avatarUrl: m.avatarUrl,
      ...count((ids) => ids.includes(m.employeeId)),
    }));
    return {
      people: people.sort((a, b) => b.open - a.open || a.name.localeCompare(b.name)),
      unassigned: count((ids) => ids.length === 0),
    };
  }, [members, tasks, levels]);

  const max = Math.max(1, ...rows.people.map((p) => p.open), rows.unassigned.open);
  const title = 'Member workload by priority';
  if (rows.people.length === 0 && rows.unassigned.open + rows.unassigned.done === 0) {
    return <SummaryCard title={title}>{EMPTY}</SummaryCard>;
  }

  const usedLegend = levels.filter((l) =>
    [...rows.people, rows.unassigned].some((r) => r.segments.some((seg) => seg.name === l.name)),
  );

  const bar = (row: {
    open: number;
    done: number;
    segments: ((typeof levels)[number] & { count: number })[];
  }) => (
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <div className="flex-1 min-w-0">
        {/* Width is the open count on one shared scale; segments are the priorities, 2px apart. */}
        <div className="flex h-2.5 gap-0.5" style={{ width: `${(row.open / max) * 100}%` }}>
          {row.segments.map((seg, i) => (
            <div
              key={seg.name}
              className={`group relative min-w-1 ${i === 0 ? 'rounded-l-full' : ''} ${
                i === row.segments.length - 1 ? 'rounded-r-full' : ''
              }`}
              style={{ flexGrow: seg.count, backgroundColor: seg.color }}
            >
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block">
                {seg.name} · {seg.count} open
              </span>
            </div>
          ))}
        </div>
      </div>
      <span className="w-24 shrink-0 text-xs text-gray-500">
        <span className="font-semibold text-gray-900">{row.open}</span> open · {row.done} done
      </span>
    </div>
  );

  const legend = usedLegend.length > 0 && (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {usedLegend.map((l) => (
        <li key={l.name} className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
          {l.name}
        </li>
      ))}
    </ul>
  );

  return (
    <SummaryCard title={title} legend={legend}>
      <ul className="flex flex-col gap-3">
        {rows.people.map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <Avatar name={p.name} avatarUrl={p.avatarUrl} size={24} />
            <span className="w-28 shrink-0 text-sm text-gray-900 truncate">{p.name}</span>
            {bar(p)}
          </li>
        ))}
        {rows.unassigned.open + rows.unassigned.done > 0 && (
          <li className="flex items-center gap-3">
            <span className="h-6 w-6 shrink-0" />
            <span className="w-28 shrink-0 text-sm text-gray-500 truncate">Unassigned</span>
            {bar(rows.unassigned)}
          </li>
        )}
      </ul>
    </SummaryCard>
  );
}

function ObjectiveProgress({ projectId, tasks }: { projectId: string; tasks: ProjectTask[] }) {
  const { data: objectives = [] } = useProjectObjectives(projectId);
  const objectiveByTaskId = useMemo(() => objectiveMap(tasks), [tasks]);
  const progress = useMemo(
    () => projectProgress({ tasks, objectives, objectiveByTaskId }),
    [tasks, objectives, objectiveByTaskId],
  );

  if (objectives.length === 0) return <p className="text-sm text-gray-400">No objectives yet.</p>;

  return (
    <div className="flex flex-col gap-4">
      {objectives.map((o) => {
        const p = progress.perObjective.get(o.id);
        return (
          <ProgressRow
            key={o.id}
            name={o.name}
            done={p?.done ?? 0}
            total={p?.total ?? 0}
            percent={p?.percent ?? 0}
          />
        );
      })}
      {progress.other.total > 0 && (
        <ProgressRow
          name="No objective"
          done={progress.other.done}
          total={progress.other.total}
          percent={progress.other.percent}
        />
      )}
    </div>
  );
}

/** For a project billed by time: the hours logged on its timed tasks against the estimate, and what they are worth. */
function TimeAndBilling({
  projectId,
  hourlyRate,
  estimatedHours,
}: {
  projectId: string;
  hourlyRate: number;
  estimatedHours: number;
}) {
  const { totalMs, people } = useProjectTime(projectId);
  const estimatedMs = estimatedHours * 3_600_000;
  const accrued = accruedAmount(totalMs, hourlyRate);
  const expected = hourlyRate * estimatedHours;
  const over = totalMs > estimatedMs;

  return (
    <SummaryCard title="Time & billing">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-gray-900">Hours logged</p>
              <p className="text-xs text-gray-400">
                <span className="text-sm font-bold text-gray-900">
                  {formatHoursMinutes(totalMs)}
                </span>{' '}
                of {estimatedHours} h estimated
              </p>
            </div>
            <ProgressBar
              value={estimatedMs > 0 ? Math.min(100, Math.round((totalMs / estimatedMs) * 100)) : 0}
            />
            {over && (
              <p className="text-xs font-medium text-red-600">
                {formatHoursMinutes(totalMs - estimatedMs)} over the estimate
              </p>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Accrued so far
            </p>
            <p className="text-sm text-gray-500">
              <span className="text-lg font-bold text-gray-900">{formatMoney(accrued)}</span> of{' '}
              {formatMoney(expected)} expected · {formatMoney(hourlyRate)} per hour
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Hours by person
          </p>
          {people.length === 0 ? (
            <p className="text-sm text-gray-400">No time logged yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {people.map((p) => (
                <li key={p.personId} className="flex items-center justify-between text-sm">
                  <span className="truncate text-gray-900">{p.personName}</span>
                  <span className="tabular-nums font-semibold text-gray-700">
                    {formatHoursMinutes(p.ms)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SummaryCard>
  );
}

/**
 * The project at a glance, top to bottom: the work (its status, types and objectives), then the people
 * (who is carrying it, and who is on the project).
 */
export function ProjectSummary({ projectId }: { projectId: string }) {
  const { data: tasks = [], isLoading } = useProjectTasks(projectId);
  const pricing = useProjectSetup(projectId)?.pricing;

  if (isLoading) {
    return <div className="h-48 rounded-card bg-gray-100 animate-pulse" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {pricing?.type === 'TIMED' && (
        <TimeAndBilling
          projectId={projectId}
          hourlyRate={pricing.hourlyRate}
          estimatedHours={pricing.estimatedHours}
        />
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Status overview">
          <StatusOverview tasks={tasks} />
        </SummaryCard>
        <SummaryCard title="Work type breakdown">
          <WorkTypeBreakdown projectId={projectId} tasks={tasks} />
        </SummaryCard>
        <div className="md:col-span-2 xl:col-span-1">
          <SummaryCard title="Objective progress">
            <ObjectiveProgress projectId={projectId} tasks={tasks} />
          </SummaryCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 items-start">
        <MemberWorkload projectId={projectId} tasks={tasks} />
        <ProjectMembersTable projectId={projectId} />
      </div>
    </div>
  );
}

function formatBudget(amount?: number) {
  if (amount == null) return '—';
  return `GHC ${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The project's owner and budget, kept on the summary as a slim strip above everything else. */
export function ProjectInfoBar({ projectId }: { projectId: string }) {
  const labels = useProjectLabels();
  const { data: project } = useProject(projectId);
  if (!project) return null;

  return (
    <div className={cardClass('px-5 py-3 flex flex-wrap items-center gap-x-10 gap-y-2')}>
      <div className="flex flex-col gap-0.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
          {labels.singular} Owner
        </p>
        <p className="text-sm font-semibold text-gray-900">{project.managerName ?? '—'}</p>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Budget</p>
        <p className="text-sm font-semibold text-gray-900">{formatBudget(project.budget)}</p>
      </div>
    </div>
  );
}
