'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { useToast } from '@/hooks/useToast';
import { usePerformanceGroups } from '@/hooks/hr/usePerformanceGroups';
import { groupProblems } from '@/lib/performanceGroups';
import { overlappingCycles } from '@/lib/appraisalAssessments';
import { useGoalCycles, useGoals, useSaveCycle } from '@/hooks/hr/useGoalAppraisals';
import type { CycleInput, GoalCycle } from '@/types/appraisal';

const FREQUENCY_OPTIONS = [
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'SEMI_ANNUAL', label: 'Semi-annual' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'AD_HOC', label: 'Ad-hoc' },
];

interface CreateCyclePanelProps {
  isOpen: boolean;
  onClose: () => void;
  editCycle?: GoalCycle;
  forceCreate?: boolean;
}

type FormValues = Omit<CycleInput, 'groupIds'>;

const EMPTY: FormValues = {
  title: '',
  description: '',
  frequency: '',
  startDate: '',
  endDate: '',
  selfAssessmentDeadline: '',
  managerReviewDeadline: '',
};

export function CreateCyclePanel({
  isOpen,
  onClose: closePanel,
  editCycle,
  forceCreate,
}: CreateCyclePanelProps) {
  const toast = useToast();
  const isEditing = !!editCycle && !forceCreate;

  const { goals } = useGoals();
  const { groups } = usePerformanceGroups();
  // The groups the person has picked since opening; until then the cycle's own groups show.
  const [pick, setPick] = useState<{ cycleId?: string; ids: string[] } | null>(null);
  const groupIds = useMemo(
    () => (pick && pick.cycleId === editCycle?.id ? pick.ids : (editCycle?.groupIds ?? [])),
    [pick, editCycle],
  );
  const setGroupIds = (ids: string[]) => setPick({ cycleId: editCycle?.id, ids });
  const onClose = () => {
    setPick(null);
    closePanel();
  };
  const saveCycle = useSaveCycle();
  // Once a cycle has started only its name and description can change.
  const locked = isEditing && editCycle!.status !== 'UPCOMING';
  const groupOptions = groups.map((g) => ({ value: g.id, label: g.name }));

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: EMPTY });

  useEffect(() => {
    if (editCycle) {
      reset({
        title: editCycle.title,
        description: editCycle.description ?? '',
        frequency: editCycle.frequency,
        startDate: editCycle.startDate.slice(0, 10),
        endDate: editCycle.endDate.slice(0, 10),
        selfAssessmentDeadline: editCycle.selfAssessmentDeadline.slice(0, 10),
        managerReviewDeadline: editCycle.managerReviewDeadline.slice(0, 10),
      });
    } else {
      reset(EMPTY);
    }
  }, [editCycle, reset]);

  const startDate = useWatch({ control, name: 'startDate' });
  const endDate = useWatch({ control, name: 'endDate' });
  // The cycle runs the goals of the groups picked.
  const picked = useMemo(() => groups.filter((g) => groupIds.includes(g.id)), [groups, groupIds]);
  const goalIds = useMemo(
    () => [...new Set(picked.flatMap((g) => g.goals.map((x) => x.goalId)))],
    [picked],
  );
  // A person can only be in one group of a cycle, or they would have two sets of weights.
  const sharedPeople = useMemo(() => {
    const seen = new Map<string, string>();
    const clashes: { person: string; a: string; b: string }[] = [];
    for (const g of picked) {
      for (const id of g.employeeIds) {
        const other = seen.get(id);
        if (other) clashes.push({ person: id, a: other, b: g.name });
        else seen.set(id, g.name);
      }
    }
    return clashes;
  }, [picked]);
  const groupIssues = picked.flatMap((g) => groupProblems(g, goals).map((p) => `${g.name}: ${p}`));
  const { cycles } = useGoalCycles();
  const overlaps = overlappingCycles(
    cycles,
    goalIds ?? [],
    startDate,
    endDate,
    isEditing ? editCycle!.id : undefined,
  );

  const onSubmit = (values: FormValues) => {
    if (!locked && (!values.selfAssessmentDeadline || !values.managerReviewDeadline)) {
      toast.error('Self-assessment and manager review deadlines are required');
      return;
    }
    if (!locked && sharedPeople.length > 0) {
      toast.error('Some people are in more than one of the chosen groups');
      return;
    }
    if (!locked && groupIssues.length > 0) {
      toast.error('Fix the groups with problems first');
      return;
    }
    const input = locked
      ? { title: values.title.trim(), description: values.description }
      : {
          ...values,
          groupIds,
          title: values.title.trim(),
          frequency: values.frequency || undefined,
        };
    saveCycle.mutate(
      { id: isEditing ? editCycle!.id : undefined, input },
      {
        onSuccess: () => {
          toast.success(isEditing ? 'Cycle updated' : 'Cycle created');
          reset(EMPTY);
          onClose();
        },
      },
    );
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEditing
          ? 'Edit Appraisal Cycle'
          : forceCreate
            ? 'New Cycle from Cancelled'
            : 'Add New Appraisal Cycle'
      }
      description="Schedule a performance review cycle for your organisation."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={saveCycle.isPending}>
            {isEditing ? 'Save Changes' : 'Create Cycle'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <FormField
          label="Cycle name"
          registration={register('title', { required: 'Cycle name is required' })}
          error={errors.title}
          placeholder="eg; 2026 Annual Review"
        />

        <FormField
          label="Description"
          registration={register('description')}
          error={errors.description}
          placeholder="Optional description"
        />

        {locked ? (
          <p className="text-sm text-gray-500">
            This cycle has started, so only its name and description can change.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Controller
                name="frequency"
                control={control}
                render={({ field }) => (
                  <SearchSelect
                    label="Frequency"
                    placeholder="Select frequency"
                    options={FREQUENCY_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.frequency?.message}
                  />
                )}
              />
              <Controller
                name="startDate"
                control={control}
                rules={{ required: 'Start date is required' }}
                render={({ field }) => (
                  <DatePicker
                    label="Start Date"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.startDate?.message}
                  />
                )}
              />
              <Controller
                name="endDate"
                control={control}
                rules={{
                  required: 'End date is required',
                  validate: (v) => !startDate || v >= startDate || 'Cannot be before start date',
                }}
                render={({ field }) => (
                  <DatePicker
                    label="End Date"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.endDate?.message}
                  />
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Controller
                name="selfAssessmentDeadline"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    label="Self Assessment Deadline"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.selfAssessmentDeadline?.message}
                    disablePast
                  />
                )}
              />
              <Controller
                name="managerReviewDeadline"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    label="Manager Review Deadline"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.managerReviewDeadline?.message}
                    disablePast
                  />
                )}
              />
            </div>

            <MultiSelect
              label="Performance groups"
              placeholder={
                groups.length === 0 ? 'No groups yet. Create one under Groups' : 'Select groups'
              }
              options={groupOptions}
              value={groupIds}
              onChange={setGroupIds}
            />

            {picked.length > 0 && (
              <ul className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-200">
                {picked.map((g) => (
                  <li key={g.id} className="px-3 py-2 text-sm">
                    <span className="font-medium text-gray-900">{g.name}</span>
                    <span className="text-gray-500"> · {g.employeeIds.length} people</span>
                    <span className="block text-xs text-gray-500">
                      {g.goals
                        .map(
                          (x) =>
                            `${goals.find((goal) => goal.id === x.goalId)?.name ?? 'Deleted goal'} ${x.weight}%`,
                        )
                        .join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {sharedPeople.length > 0 && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {sharedPeople.length} {sharedPeople.length === 1 ? 'person is' : 'people are'} in
                more than one of these groups. Remove the overlap in the groups, or pick groups that
                don&apos;t share people.
              </div>
            )}

            {groupIssues.length > 0 && (
              <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {groupIssues.map((i) => (
                  <p key={i}>{i}</p>
                ))}
              </div>
            )}

            {overlaps.length > 0 && (
              <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                A selected goal is already running in{' '}
                {overlaps.map((c) => `"${c.title}"`).join(', ')} during these dates. Objectives
                added in both periods will be rated in each cycle.
              </div>
            )}
          </>
        )}
      </div>
    </SidePanel>
  );
}
