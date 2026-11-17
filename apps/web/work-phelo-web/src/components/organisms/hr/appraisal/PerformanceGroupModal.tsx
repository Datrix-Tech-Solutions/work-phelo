'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useDepartmentOptions } from '@/hooks/hr/useDepartments';
import { useMultiEntryPanel } from '@/hooks/useMultiEntryPanel';
import { cn } from '@/lib/utils';
import {
  evenWeights,
  goalCoverage,
  groupsSharingPeople,
  weightTotal,
} from '@/lib/performanceGroups';
import {
  EMPLOYMENT_TYPE_OPTIONS,
  eligibleEmployees,
  narrows,
} from '@/components/organisms/hr/appraisal/CreateGoalModal';
import type { Goal, PerformanceGroup, PerformanceGroupInput } from '@/types/appraisal';
import type { Employee } from '@/types/hr';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  goals: Goal[];
  /** Every saved group, to warn when someone is already in another one. */
  groups: PerformanceGroup[];
  /** The group being edited; leave out to create one. Remount (key) when it changes. */
  group?: PerformanceGroup;
  onSave: (input: PerformanceGroupInput) => void;
}

const SECTION = 'text-xs font-semibold text-gray-400 uppercase tracking-widest';

export function PerformanceGroupModal({
  isOpen,
  onClose,
  employees,
  goals,
  groups,
  group,
  onSave,
}: Props) {
  const { data: departments = [] } = useDepartmentOptions();
  const [name, setName] = useState(group?.name ?? '');
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>(group?.employeeIds ?? []);
  // Weight per chosen goal; '' is chosen but not yet given a weight.
  const [weights, setWeights] = useState<Record<string, number | ''>>(
    Object.fromEntries((group?.goals ?? []).map((g) => [g.goalId, g.weight])),
  );
  const [tried, setTried] = useState(false);

  const eligible = eligibleEmployees(employees);
  const members = memberIds.filter((id) => eligible.some((e) => e.id === id));
  const fits = (e: Employee, dept: string, type: string) =>
    (!narrows(dept) || e.departmentId === dept) && (!narrows(type) || e.employmentType === type);

  // Choosing a department or type picks everyone it covers; the list below then adjusts it.
  const pick = (dept: string, type: string) => {
    setDepartment(dept);
    setEmploymentType(type);
    if (dept === '' && type === '') return;
    const picked = eligible.filter((e) => fits(e, dept, type)).map((e) => e.id);
    setMemberIds((prev) => [...new Set([...prev, ...picked])]);
  };

  // Every goal at least one of the group's people is on. A person not on a chosen goal is scored on
  // the rest, rescaled to 100.
  const offered = goals.filter((g) => goalCoverage(g, members).covered > 0);
  const chosen = Object.keys(weights).filter((id) => offered.some((g) => g.id === id));
  const chosenGoals = chosen.map((goalId) => ({
    goalId,
    weight: weights[goalId] === '' ? NaN : Number(weights[goalId]),
  }));
  const total = weightTotal(chosenGoals);

  const toggleGoal = (goalId: string) =>
    setWeights((prev) => {
      const next = { ...prev };
      if (goalId in next) delete next[goalId];
      else next[goalId] = '';
      return next;
    });
  const splitEvenly = () => {
    const shares = evenWeights(chosen.length);
    setWeights((prev) => ({
      ...prev,
      ...Object.fromEntries(chosen.map((id, i) => [id, shares[i]])),
    }));
  };

  const nameTaken = groups.some(
    (g) => g.id !== group?.id && g.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  const nameError = !name.trim()
    ? 'Group name is required'
    : nameTaken
      ? 'A group with this name already exists'
      : '';
  const sharing = groupsSharingPeople(groups, members, group?.id);
  const problem =
    nameError ||
    (members.length === 0
      ? 'Choose the group’s employees'
      : chosen.length === 0
        ? 'Choose at least one goal'
        : chosenGoals.some((g) => Number.isNaN(g.weight))
          ? 'Give every goal a weight'
          : total !== 100
            ? 'Weights must total 100'
            : '');

  const handleClose = () => {
    onClose();
  };

  const entry = useMultiEntryPanel({
    isOpen,
    onStop: handleClose,
    onContinue: () => {
      setName('');
      setDepartment('');
      setEmploymentType('');
      setMemberIds([]);
      setWeights({});
      setTried(false);
    },
  });

  const submit = () => {
    setTried(true);
    if (problem) return;
    onSave({
      name: name.trim(),
      employeeIds: members,
      goals: chosenGoals.map((g) => ({ goalId: g.goalId, weight: g.weight })),
    });
    if (group) {
      handleClose();
      return;
    }
    entry.finishSave(
      { title: 'Group Created!', message: `${name.trim()} has been created.` },
      handleClose,
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={group ? 'Edit Performance Group' : 'Create Performance Group'}
      description="Who is scored together, which goals count for them, and how much each one weighs."
      width="max-w-2xl"
      {...entry.panelProps}
      lock={group ? undefined : entry.panelProps.lock}
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{group ? 'Save Changes' : 'Create Group'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 mt-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Group Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="eg; Sales and support"
            className="rounded-input border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          {tried && nameError && <p className="text-xs text-red-500">{nameError}</p>}
        </div>

        <div className="flex flex-col gap-3">
          <p className={SECTION}>Employees ({members.length} selected)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchSelect
              label="Department"
              placeholder="Select a department"
              options={[
                { value: 'all', label: 'All departments' },
                ...departments
                  .filter((d) => eligible.some((e) => e.departmentId === d.id))
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
            placeholder="Add employees to this group"
            hideChips
            options={eligible
              .filter((e) => members.includes(e.id) || fits(e, department, employmentType))
              .map((e) => ({
                value: e.id,
                label: `${e.firstName} ${e.lastName}`,
                sublabel: e.jobTitle,
              }))}
            value={members}
            onChange={setMemberIds}
          />
          {members.length > 0 && (
            <ul className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
              {members.map((id) => {
                const e = employees.find((x) => x.id === id);
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
                      onClick={() => setMemberIds(members.filter((m) => m !== id))}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {sharing.length > 0 && (
            <p className="text-xs text-amber-600">
              {sharing.map((x) => `${x.shared.length} in "${x.group.name}"`).join(', ')}{' '}
              {sharing.length === 1 && sharing[0].shared.length === 1 ? 'is' : 'are'} already in
              another group. A cycle can only use one group per person.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className={SECTION}>Goals and weights</p>
            {chosen.length > 1 && (
              <Button variant="outline" onClick={splitEvenly}>
                Split evenly
              </Button>
            )}
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-gray-400">
              Choose the group’s employees to see their goals.
            </p>
          ) : offered.length === 0 ? (
            <p className="text-sm text-gray-400">
              None of these employees is on a goal yet. Add them to a goal first.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-200">
              {offered.map((g) => {
                const { covered, total: all } = goalCoverage(g, members);
                const on = g.id in weights;
                return (
                  <li key={g.id} className="flex items-center gap-3 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleGoal(g.id)}
                      className="h-4 w-4 rounded accent-blue-500"
                      aria-label={`Use ${g.name}`}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm text-gray-900">{g.name}</span>
                      <span className="text-xs text-gray-500">
                        {covered === all
                          ? `On all ${all}`
                          : `On ${covered} of ${all}. The other ${all - covered} are scored on the rest, rescaled to 100`}
                      </span>
                    </span>
                    {on && (
                      <span className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={weights[g.id]}
                          onChange={(e) =>
                            setWeights((prev) => ({
                              ...prev,
                              [g.id]: e.target.value === '' ? '' : Number(e.target.value),
                            }))
                          }
                          className="w-20 rounded-input border border-gray-200 px-2 py-1 text-sm text-right tabular-nums outline-none focus:border-brand"
                          aria-label={`Weight for ${g.name}`}
                        />
                        <span className="text-sm text-gray-500">%</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {chosen.length > 0 && (
            <p
              className={cn(
                'text-sm font-medium tabular-nums',
                total === 100 ? 'text-green-600' : 'text-amber-600',
              )}
            >
              Total {Number.isNaN(total) ? '—' : total}%{total === 100 ? '' : ' — must be 100'}
            </p>
          )}
        </div>

        {tried && problem && !nameError && <p className="text-sm text-red-500">{problem}</p>}
      </div>
    </Modal>
  );
}
