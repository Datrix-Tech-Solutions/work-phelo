'use client';

import { useMemo, useState } from 'react';
import { SegmentedToggle } from '@/components/atoms/SegmentedToggle';
import { ProgressRow } from '@/components/molecules/hr/projects/ProgressRow';
import { useProjectSetup } from '@/hooks';
import { useProjectObjectives, useProjectSprints } from '@/hooks/hr/useProjectWork';
import { PRIORITY_COLORS } from '@/lib/priorityColors';
import { TASK_STATUS_META } from '@/lib/taskStatus';
import { WORK_TYPE_ICONS } from '@/lib/workTypeIcons';
import { cardClass, cn } from '@/lib/utils';
import type { ProjectTask, TaskStatus } from '@/types/hr';

/** A narrowing of the task table, picked by clicking a row in one of the cards. */
export interface TaskFilter {
  id: string;
  label: string;
  match: (task: ProjectTask) => boolean;
}

interface CardProps {
  projectId: string;
  tasks: ProjectTask[];
  /** The id of the filter in use, if any. */
  activeId?: string;
  /** Picks a filter, or clears it with null. */
  onFilter: (filter: TaskFilter | null) => void;
}

const STATUS_ORDER: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'ON_HOLD', 'DONE'];
// The same colours the status chips use: gray, blue, red, green.
const STATUS_COLORS: Record<TaskStatus, string> = {
  TODO: '#9ca3af',
  IN_PROGRESS: '#3b82f6',
  ON_HOLD: '#ef4444',
  DONE: '#22c55e',
};

const rowClass = (active: boolean) =>
  cn(
    'w-full rounded-lg px-2 py-1.5 text-left transition-colors',
    active ? 'bg-brand-tint' : 'hover:bg-gray-50',
  );

export const NO_PRIORITY = { name: 'No priority', color: '#9ca3af' };

/** The project's priority levels, lowest to highest, then "no priority". */
export function usePriorityLevels(projectId: string) {
  const priorities = useProjectSetup(projectId)?.config?.priorities;
  return useMemo(
    () => [
      ...(priorities ?? []).map((p) => ({ name: p.name, color: PRIORITY_COLORS[p.color].hex })),
      NO_PRIORITY,
    ],
    [priorities],
  );
}

/** How many of the tasks sit at each priority level; levels with none are left out. */
export function priorityGroups(tasks: ProjectTask[], levels: { name: string; color: string }[]) {
  return levels
    .map((level) => ({
      ...level,
      count: tasks.filter((t) =>
        level.name === NO_PRIORITY.name
          ? !t.priorityName || !levels.some((l) => l.name === t.priorityName)
          : t.priorityName === level.name,
      ).length,
    }))
    .filter((group) => group.count > 0);
}

interface Group extends TaskFilter {
  name: string;
  color: string;
  count: number;
}

/** One stacked bar and, under it, the same numbers listed, so no value depends on colour alone. */
function BreakdownBar({
  groups,
  total,
  activeId,
  onFilter,
}: {
  groups: Group[];
  total: number;
  activeId?: string;
  onFilter: CardProps['onFilter'];
}) {
  const pick = (group: Group) => onFilter(group.id === activeId ? null : group);
  const share = (count: number) => Math.round((count / total) * 100);

  return (
    <div className="flex flex-col gap-3">
      {/* The bar: 2px gaps between segments, rounded ends, a tooltip on each segment. */}
      <div className="flex h-4 gap-0.5 px-2">
        {groups.map((g, i) => (
          <div
            key={g.id}
            onClick={() => pick(g)}
            className={cn(
              'group relative min-w-1.5 cursor-pointer',
              i === 0 && 'rounded-l-full',
              i === groups.length - 1 && 'rounded-r-full',
            )}
            style={{ flexGrow: g.count, backgroundColor: g.color }}
          >
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block">
              {g.name} · {g.count} {g.count === 1 ? 'task' : 'tasks'} ({share(g.count)}%)
            </span>
          </div>
        ))}
      </div>

      <ul className="flex flex-col gap-0.5">
        {groups.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              aria-pressed={g.id === activeId}
              onClick={() => pick(g)}
              className={cn(rowClass(g.id === activeId), 'flex items-center gap-2.5 text-sm')}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: g.color }}
              />
              <span className="truncate text-gray-900">{g.name}</span>
              <span className="ml-auto shrink-0 font-medium text-gray-900">{g.count}</span>
              <span className="w-10 shrink-0 text-right text-xs text-gray-400">
                {share(g.count)}%
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Card({
  title,
  toggle,
  children,
}: {
  title: string;
  toggle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={cardClass('flex h-full flex-col gap-4 p-5')}>
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {toggle}
      </div>
      <div className="max-h-72 overflow-y-auto pt-1">{children}</div>
    </section>
  );
}

type BreakdownView = 'status' | 'type' | 'priority';

/** The same tasks counted by status, by work type or, for the open ones, by priority. */
export function BreakdownCard({ projectId, tasks, activeId, onFilter }: CardProps) {
  const [view, setView] = useState<BreakdownView>('status');
  const config = useProjectSetup(projectId)?.config;
  const levels = usePriorityLevels(projectId);

  const groups = useMemo((): Group[] => {
    const grouped = (name: string, color: string, match: TaskFilter['match']) => ({
      id: `${view}:${name}`,
      label: view === 'priority' ? `${name} priority, open` : name,
      name,
      color,
      match,
      count: tasks.filter(match).length,
    });
    if (view === 'status') {
      return STATUS_ORDER.map((status) =>
        grouped(TASK_STATUS_META[status].label, STATUS_COLORS[status], (t) => t.status === status),
      ).filter((g) => g.count > 0);
    }
    if (view === 'type') {
      const typeOf = (t: ProjectTask) => t.workType || 'Task';
      return [...new Set(tasks.map(typeOf))]
        .map((name) => {
          const icon = config?.workTypes.find((w) => w.name === name)?.icon ?? 'TASK';
          return grouped(name, WORK_TYPE_ICONS[icon].chartColor, (t) => typeOf(t) === name);
        })
        .sort((a, b) => b.count - a.count);
    }
    return levels
      .map((level) =>
        grouped(
          level.name,
          level.color,
          (t) =>
            t.status !== 'DONE' &&
            (level.name === NO_PRIORITY.name
              ? !t.priorityName || !levels.some((l) => l.name === t.priorityName)
              : t.priorityName === level.name),
        ),
      )
      .filter((g) => g.count > 0);
  }, [view, tasks, config, levels]);

  const total = groups.reduce((sum, g) => sum + g.count, 0);

  return (
    <Card
      title={view === 'priority' ? 'Open tasks' : 'Tasks'}
      toggle={
        <SegmentedToggle<BreakdownView>
          value={view}
          onChange={(next) => {
            setView(next);
            onFilter(null);
          }}
          options={[
            { label: 'Status', value: 'status' },
            { label: 'Type', value: 'type' },
            { label: 'Priority', value: 'priority' },
          ]}
        />
      }
    >
      {total === 0 ? (
        <p className="text-sm text-gray-400">
          {view === 'priority' ? 'No open tasks.' : 'Nothing to show yet.'}
        </p>
      ) : (
        <BreakdownBar groups={groups} total={total} activeId={activeId} onFilter={onFilter} />
      )}
    </Card>
  );
}

type ProgressView = 'objectives' | 'sprints';

/**
 * How far along the objectives or sprints are, counted on the given tasks. `showEmpty` also lists the
 * ones holding none of them.
 */
export function ProgressCard({
  projectId,
  tasks,
  showEmpty,
  activeId,
  onFilter,
}: CardProps & { showEmpty: boolean }) {
  const [picked, setPicked] = useState<ProgressView>('objectives');
  const { data: objectives = [] } = useProjectObjectives(projectId);
  const { data: sprints = [] } = useProjectSprints(projectId);
  // A project with only one of the two shows that one.
  const view: ProgressView =
    objectives.length === 0 && sprints.length > 0
      ? 'sprints'
      : sprints.length === 0
        ? 'objectives'
        : picked;

  const groups = (): (TaskFilter & { name: string })[] => {
    if (view === 'sprints') {
      return sprints.map((sprint) => ({
        id: `sprint:${sprint.id}`,
        label: sprint.name,
        name: sprint.completedAt ? `${sprint.name} (completed)` : sprint.name,
        match: (t) => sprint.taskIds.includes(t.id),
      }));
    }
    if (objectives.length === 0) return [];
    const ids = new Set(objectives.map((o) => o.id));
    return [
      ...objectives.map((o) => ({
        id: `objective:${o.id}`,
        label: o.name,
        name: o.name,
        match: (t: ProjectTask) => t.objectiveId === o.id,
      })),
      {
        id: 'objective:none',
        label: 'No objective',
        name: 'No objective',
        match: (t: ProjectTask) => !t.objectiveId || !ids.has(t.objectiveId),
      },
    ];
  };

  const rows = groups().flatMap((group) => {
    const own = tasks.filter(group.match);
    // "No objective" only appears when something sits there.
    if (own.length === 0 && (!showEmpty || group.id === 'objective:none')) return [];
    const done = own.filter((t) => t.status === 'DONE').length;
    return [{ group, done, total: own.length }];
  });

  return (
    <Card
      title="Progress"
      toggle={
        objectives.length > 0 &&
        sprints.length > 0 && (
          <SegmentedToggle<ProgressView>
            value={view}
            onChange={(next) => {
              setPicked(next);
              onFilter(null);
            }}
            options={[
              { label: 'Objectives', value: 'objectives' },
              { label: 'Sprints', value: 'sprints' },
            ]}
          />
        )
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">
          {objectives.length === 0 && sprints.length === 0
            ? 'No objectives or sprints yet.'
            : 'Nothing to show yet.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map(({ group, done, total }) => (
            <li key={group.id}>
              <button
                type="button"
                aria-pressed={group.id === activeId}
                onClick={() => onFilter(group.id === activeId ? null : group)}
                className={rowClass(group.id === activeId)}
              >
                <ProgressRow
                  name={group.name}
                  done={done}
                  total={total}
                  percent={total ? Math.round((done / total) * 100) : 0}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
