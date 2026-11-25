'use client';

import { useState } from 'react';
import { Search, Users } from 'lucide-react';
import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { priorityGroups } from '@/components/organisms/hr/projects/ProjectSummaryCharts';
import { EVERYONE, UNASSIGNED, ProjectPerson } from '@/lib/projectPeople';
import { cardClass, cn, inputClass } from '@/lib/utils';
import type { ProjectTask } from '@/types/hr';

interface Props {
  people: ProjectPerson[];
  taskCount: number;
  unassigned: ProjectTask[];
  levels: { name: string; color: string }[];
  selected: string;
  onSelect: (id: string) => void;
  /** Opens the team panel; the label says whether it can be changed there. */
  teamLabel: string;
  onOpenTeam: () => void;
}

const counts = (open: number, done: number) => `${open} open · ${done} done`;

/** A thin bar of a person's open tasks by priority, on one scale shared by the whole list. */
function PriorityStrip({
  tasks,
  levels,
  max,
}: {
  tasks: ProjectTask[];
  levels: Props['levels'];
  max: number;
}) {
  const open = tasks.filter((t) => t.status !== 'DONE');
  if (open.length === 0) return null;
  return (
    <span className="flex h-1 gap-px" style={{ width: `${(open.length / max) * 100}%` }}>
      {priorityGroups(open, levels).map((g) => (
        <span
          key={g.name}
          title={`${g.name} · ${g.count} open`}
          className="min-w-1 rounded-full"
          style={{ flexGrow: g.count, backgroundColor: g.color }}
        />
      ))}
    </span>
  );
}

function Row({
  active,
  onClick,
  leading,
  name,
  detail,
  strip,
}: {
  active: boolean;
  onClick: () => void;
  leading: React.ReactNode;
  name: string;
  detail: string;
  strip?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex w-full shrink-0 items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
        active ? 'bg-brand-tint' : 'hover:bg-gray-50',
      )}
    >
      {leading}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn('truncate text-sm font-medium', active ? 'text-brand' : 'text-gray-900')}
        >
          {name}
        </span>
        <span className="truncate text-xs text-gray-400">{detail}</span>
        {strip}
      </span>
    </button>
  );
}

/**
 * The people on a project, as the summary's filter. A scrolling, searchable list beside the page on a
 * wide screen, and a dropdown above it on a narrow one, so it takes the same room for any team size.
 */
export function ProjectPeopleFilter({
  people,
  taskCount,
  unassigned,
  levels,
  selected,
  onSelect,
  teamLabel,
  onOpenTeam,
}: Props) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const shown = q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people;
  const unassignedDone = unassigned.filter((t) => t.status === 'DONE').length;
  const max = Math.max(1, ...people.map((p) => p.open), unassigned.length - unassignedDone);

  const everyoneIcon = (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
      <Users className="h-4 w-4" />
    </span>
  );

  return (
    <aside className="lg:sticky lg:top-0">
      <div className="flex items-end gap-2 lg:hidden">
        <div className="min-w-0 flex-1">
          <SearchSelect
            label="Showing"
            placeholder="Everyone"
            showAllOption
            allLabel="Everyone"
            options={[
              ...people.map((p) => ({
                value: p.id,
                label: p.name,
                sublabel: counts(p.open, p.done),
              })),
              ...(unassigned.length > 0 ? [{ value: UNASSIGNED, label: 'Unassigned' }] : []),
            ]}
            value={selected}
            onChange={onSelect}
          />
        </div>
        <Button variant="outline" size="sm" className="px-3 py-1 text-xs" onClick={onOpenTeam}>
          {teamLabel}
        </Button>
      </div>

      <div className={cardClass('hidden max-h-[calc(100vh-14rem)] flex-col gap-3 p-3 lg:flex')}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">
            People <span className="font-normal text-gray-400">{people.length}</span>
          </h2>
          <Button variant="outline" size="sm" className="px-3 py-1 text-xs" onClick={onOpenTeam}>
            {teamLabel}
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people…"
            className={inputClass(undefined, 'w-full py-1.5 pl-9')}
          />
        </div>
        <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
          {!q && (
            <Row
              active={selected === EVERYONE}
              onClick={() => onSelect(EVERYONE)}
              leading={everyoneIcon}
              name="Everyone"
              detail={`${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`}
            />
          )}
          {shown.map((p) => (
            <Row
              key={p.id}
              active={selected === p.id}
              onClick={() => onSelect(p.id)}
              leading={<Avatar name={p.name} avatarUrl={p.avatarUrl} size="sm" />}
              name={p.name}
              detail={`${counts(p.open, p.done)}${p.member ? '' : ' · not on the team'}`}
              strip={<PriorityStrip tasks={p.tasks} levels={levels} max={max} />}
            />
          ))}
          {!q && unassigned.length > 0 && (
            <Row
              active={selected === UNASSIGNED}
              onClick={() => onSelect(UNASSIGNED)}
              leading={
                <span className="h-8 w-8 shrink-0 rounded-full border border-dashed border-gray-300" />
              }
              name="Unassigned"
              detail={counts(unassigned.length - unassignedDone, unassignedDone)}
              strip={<PriorityStrip tasks={unassigned} levels={levels} max={max} />}
            />
          )}
          {q && shown.length === 0 && (
            <p className="py-4 text-center text-xs text-gray-400">No one matches your search</p>
          )}
        </div>
      </div>
    </aside>
  );
}
