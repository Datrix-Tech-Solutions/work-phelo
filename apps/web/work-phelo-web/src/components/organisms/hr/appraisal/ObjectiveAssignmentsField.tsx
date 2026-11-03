'use client';

import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Icons } from '@/components/atoms/icons';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useDepartmentOptions } from '@/hooks/hr/useDepartments';
import {
  EMPLOYMENT_TYPE_OPTIONS,
  narrows,
} from '@/components/organisms/hr/appraisal/CreateGoalModal';
import type { GoalObjectiveDraft } from '@/types/appraisal';
import type { Employee, ProjectDetail, ProjectObjective } from '@/types/hr';

/** One objective and the employees it is given to; each objective has its own set of people. */
export interface ObjectiveDraft {
  key: string;
  name: string;
  employeeIds: string[];
}

export const newDraft = (employeeIds: string[] = []): ObjectiveDraft => ({
  key: crypto.randomUUID(),
  name: '',
  employeeIds,
});

/** Whether every objective has a name and at least one person. */
export const draftsReady = (drafts: ObjectiveDraft[]) =>
  drafts.length > 0 && drafts.every((d) => d.name.trim() !== '' && d.employeeIds.length > 0);

/** The filled-in objectives as the server takes them; `allowed` drops people no longer eligible. */
export function draftsPayload(drafts: ObjectiveDraft[], allowed?: string[]): GoalObjectiveDraft[] {
  return drafts
    .map((d) => ({
      name: d.name.trim(),
      employeeIds: d.employeeIds.filter((id) => !allowed || allowed.includes(id)),
    }))
    .filter((d) => d.name !== '' && d.employeeIds.length > 0);
}

/**
 * The records to create, one per employee and objective. Two blocks with the same name that
 * share a person give that person the objective once. `allowed` drops people no longer eligible.
 */
export function draftAssignments(drafts: ObjectiveDraft[], allowed?: string[]) {
  const seen = new Set<string>();
  const out: { employeeId: string; name: string }[] = [];
  for (const d of drafts) {
    const name = d.name.trim();
    if (!name) continue;
    for (const employeeId of d.employeeIds) {
      if (allowed && !allowed.includes(employeeId)) continue;
      const id = `${employeeId}:${name.toLowerCase()}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ employeeId, name });
    }
  }
  return out;
}

interface Props {
  value: ObjectiveDraft[];
  onChange: (drafts: ObjectiveDraft[]) => void;
  /** The people an objective can be given to: the employees on the goal. */
  members: Employee[];
}

export function ObjectiveAssignmentsField({ value, onChange, members }: Props) {
  // Only one objective is open at a time; the rest show as a summary line.
  const [openKey, setOpenKey] = useState<string | null>(value[0]?.key ?? null);
  const update = (key: string, patch: Partial<ObjectiveDraft>) =>
    onChange(value.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const add = () => {
    const draft = newDraft();
    onChange([...value, draft]);
    setOpenKey(draft.key);
  };
  const remove = (key: string) => {
    const rest = value.filter((d) => d.key !== key);
    onChange(rest);
    if (openKey === key) setOpenKey(rest[rest.length - 1]?.key ?? null);
  };

  return (
    <div className="flex flex-col gap-4">
      {value.map((draft, i) => (
        <ObjectiveBlock
          key={draft.key}
          index={i}
          draft={draft}
          others={value.filter((d) => d.key !== draft.key)}
          members={members}
          open={openKey === draft.key}
          onToggle={() => setOpenKey(openKey === draft.key ? null : draft.key)}
          onChange={(patch) => update(draft.key, patch)}
          onRemove={value.length > 1 ? () => remove(draft.key) : undefined}
        />
      ))}
      <div>
        <Button variant="outline" onClick={add}>
          <Plus className="w-4 h-4" /> Add objective
        </Button>
      </div>
    </div>
  );
}

function ObjectiveBlock({
  index,
  draft,
  others,
  members,
  open,
  onToggle,
  onChange,
  onRemove,
}: {
  open: boolean;
  onToggle: () => void;
  index: number;
  draft: ObjectiveDraft;
  others: ObjectiveDraft[];
  members: Employee[];
  onChange: (patch: Partial<ObjectiveDraft>) => void;
  onRemove?: () => void;
}) {
  const { data: departments = [] } = useDepartmentOptions();
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const ids = draft.employeeIds;

  const fits = (e: Employee, dept: string, type: string) =>
    (!narrows(dept) || e.departmentId === dept) && (!narrows(type) || e.employmentType === type);

  // Choosing a department or type picks everyone in the goal it covers; the list then adjusts it.
  const pick = (dept: string, type: string) => {
    setDepartment(dept);
    setEmploymentType(type);
    if (dept === '' && type === '') return;
    const picked = members.filter((e) => fits(e, dept, type)).map((e) => e.id);
    onChange({ employeeIds: [...new Set([...ids, ...picked])] });
  };

  // Suggestions: the objectives of the projects this objective's people are on.
  const employeeProjects = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['projects', 'employee', id],
      queryFn: async () => (await api.get<ProjectDetail[]>(`/hr/projects/employee/${id}`)).data,
    })),
  });
  const projectIds = useMemo(
    () => [...new Set(employeeProjects.flatMap((q) => (q.data ?? []).map((p) => p.id)))],
    [employeeProjects],
  );
  const projectObjectives = useQueries({
    queries: projectIds.map((projectId) => ({
      queryKey: ['projects', projectId, 'objectives'],
      queryFn: async () =>
        (await api.get<ProjectObjective[]>(`/hr/projects/${projectId}/objectives`)).data,
    })),
  });
  const suggestions = useMemo(
    () => projectObjectives.flatMap((q) => (q.data ?? []).map((o) => o.name)),
    [projectObjectives],
  );
  const options = [
    ...new Set([
      ...suggestions,
      // Names typed in other blocks can be reused here for a different set of people.
      ...others.map((d) => d.name.trim()).filter(Boolean),
      ...(draft.name ? [draft.name] : []),
    ]),
  ].map((n) => ({ value: n, label: n }));

  // Same name as another block and a shared person: that person still only gets it once.
  const overlap = draft.name.trim()
    ? members.filter(
        (e) =>
          ids.includes(e.id) &&
          others.some(
            (d) =>
              d.name.trim().toLowerCase() === draft.name.trim().toLowerCase() &&
              d.employeeIds.includes(e.id),
          ),
      )
    : [];

  const incomplete = draft.name.trim() === '' || ids.length === 0;
  const summary =
    ids.length === 0
      ? 'No employees'
      : `${ids.length} ${ids.length === 1 ? 'employee' : 'employees'}`;

  return (
    <div className="rounded-lg border border-gray-200">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex flex-1 min-w-0 items-center justify-between gap-3 text-left"
        >
          <span className="truncate text-sm font-bold text-gray-900">
            {draft.name.trim() || `Objective ${index + 1}`}
          </span>
          <span className="flex shrink-0 items-center gap-2 text-sm text-gray-600">
            <span className={cn(incomplete && !open && 'text-amber-600')}>{summary}</span>
            <ChevronDown
              className={cn('h-4 w-4 text-gray-400 transition-transform', !open && '-rotate-90')}
            />
          </span>
        </button>
        {onRemove && (
          <Button variant="outline" aria-label="Remove objective" onClick={onRemove}>
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Kept mounted when closed so the picks and filters survive. */}
      <div className={cn('flex flex-col gap-4 border-t border-gray-100 p-4', !open && 'hidden')}>
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <SearchSelect
              label={`Objective ${index + 1}`}
              placeholder="Select objective"
              options={options}
              value={draft.name}
              onChange={(v) => onChange({ name: v })}
              emptyState={({ query, close }) => (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange({ name: query.trim() });
                    close();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left text-brand hover:bg-gray-300 transition-colors"
                >
                  <Icons.Plus className="w-4 h-4 shrink-0" />
                  <span>
                    No objective found — <span className="font-semibold">Create objective</span>
                  </span>
                </button>
              )}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Given to ({ids.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchSelect
              label="Department"
              placeholder="Select a department"
              options={[
                { value: 'all', label: 'All departments' },
                ...departments
                  .filter((d) => members.some((e) => e.departmentId === d.id))
                  .map((d) => ({ value: d.id, label: d.name })),
              ]}
              value={department}
              onChange={(v) => pick(v, employmentType)}
            />
            <SearchSelect
              label="Employee type"
              placeholder="Select a type"
              options={[{ value: 'all', label: 'All types' }, ...EMPLOYMENT_TYPE_OPTIONS]}
              value={employmentType}
              onChange={(v) => pick(department, v)}
            />
          </div>
          <MultiSelect
            placeholder="Add employees"
            hideChips
            options={members
              .filter((e) => ids.includes(e.id) || fits(e, department, employmentType))
              .map((e) => ({
                value: e.id,
                label: `${e.firstName} ${e.lastName}`,
                sublabel: e.jobTitle,
              }))}
            value={ids}
            onChange={(next) => onChange({ employeeIds: next })}
          />
          {ids.length > 0 && (
            <ul className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-200">
              {ids.map((id) => {
                const e = members.find((m) => m.id === id);
                if (!e) return null;
                return (
                  <li key={id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm text-gray-900">
                        {e.firstName} {e.lastName}
                      </span>
                      <span className="truncate text-xs text-gray-500">{e.jobTitle}</span>
                    </span>
                    <button
                      type="button"
                      className="text-xs font-medium text-red-500 hover:text-red-600"
                      onClick={() => onChange({ employeeIds: ids.filter((m) => m !== id) })}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {overlap.length > 0 && (
            <p className={cn('text-xs text-amber-600')}>
              {overlap.map((e) => `${e.firstName} ${e.lastName}`).join(', ')} already{' '}
              {overlap.length === 1 ? 'has' : 'have'} this objective from another block and will get
              it once.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
