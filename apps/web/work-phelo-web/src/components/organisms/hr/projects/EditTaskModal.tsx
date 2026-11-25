'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Toggle } from '@/components/atoms/Toggle';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { useEmployeeOptions } from '@/hooks/hr/useEmployees';
import { Avatar } from '@/components/atoms/Avatar';
import { inputClass } from '@/lib/utils';
import type { TaskStatus, ProjectTask, TaskAssignee } from '@/types/hr';

interface TaskEditValues {
  name: string;
  dueDate: string;
  status: TaskStatus;
}

interface Props {
  task: ProjectTask | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    id: string,
    values: TaskEditValues & {
      /** The person picked, if any: a task has one at most. */
      assignees: TaskAssignee[];
      objectiveId?: string;
      workType?: string;
      priority?: string;
      timed?: boolean;
    },
  ) => void;
  isSaving?: boolean;
  /** The project's objectives, and the task's current one; the field only shows when there are some. */
  objectiveOptions?: SearchSelectOption[];
  currentObjectiveId?: string;
  workTypeOptions?: SearchSelectOption[];
  priorityOptions?: SearchSelectOption[];
  currentWorkType?: string;
  currentPriority?: string;
  currentTimed?: boolean;
  /** Everyone the task is assigned to now. */
  currentAssignees?: TaskAssignee[];
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'DONE', label: 'Done' },
];

export function EditTaskModal({
  task,
  isOpen,
  onClose,
  onSave,
  isSaving,
  objectiveOptions = [],
  currentObjectiveId,
  workTypeOptions = [],
  priorityOptions = [],
  currentWorkType,
  currentPriority,
  currentTimed = false,
  currentAssignees = [],
}: Props) {
  const [objectiveId, setObjectiveId] = useState(currentObjectiveId ?? '');
  const [workType, setWorkType] = useState(currentWorkType ?? '');
  const [priority, setPriority] = useState(currentPriority ?? '');
  const [timed, setTimed] = useState(currentTimed);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(task?.id ?? null);
  // A task made when it could hold several people keeps only the first once it is saved.
  const [assigneeId, setAssigneeId] = useState(currentAssignees[0]?.id ?? '');

  // Reset local selections when the task changes. Normalise to null so that
  // `undefined` (task prop absent) and `null` (no task) compare equal and don't
  // trigger an infinite setState loop during render.
  const incomingTaskId = task?.id ?? null;
  if (incomingTaskId !== currentTaskId) {
    setCurrentTaskId(incomingTaskId);
    setAssigneeId(currentAssignees[0]?.id ?? '');
    setObjectiveId(currentObjectiveId ?? '');
    setWorkType(currentWorkType ?? '');
    setPriority(currentPriority ?? '');
    setTimed(currentTimed);
  }

  const { data: employees = [] } = useEmployeeOptions();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<TaskEditValues>();

  useEffect(() => {
    if (task) {
      reset({ name: task.name, dueDate: task.dueDate ?? '', status: task.status });
    }
  }, [task, reset]);

  // The active employees, plus the current assignee when they are no longer listed.
  const employeeOptions = useMemo<SearchSelectOption[]>(() => {
    const options: SearchSelectOption[] = employees
      .filter((e) => e.employmentStatus === 'ACTIVE' || e.id === assigneeId)
      .map((e) => ({
        value: e.id,
        label: `${e.firstName} ${e.lastName}`,
        sublabel: e.jobTitle ?? undefined,
        icon: <Avatar name={`${e.firstName} ${e.lastName}`} avatarUrl={e.avatarUrl} size={20} />,
      }));
    const current = currentAssignees.find((a) => a.id === assigneeId);
    if (current && !options.some((o) => o.value === current.id)) {
      options.push({
        value: current.id,
        label: current.name,
        icon: <Avatar name={current.name} avatarUrl={current.avatarUrl} size={20} />,
      });
    }
    return options;
  }, [employees, assigneeId, currentAssignees]);

  // The picked person, from the employee list or, for someone no longer listed, from the task.
  const selectedPeople = (): TaskAssignee[] => {
    const emp = employees.find((e) => e.id === assigneeId);
    if (emp) {
      return [{ id: emp.id, name: `${emp.firstName} ${emp.lastName}`, avatarUrl: emp.avatarUrl }];
    }
    return currentAssignees.filter((a) => a.id === assigneeId);
  };

  const handleClose = () => {
    reset();
    setTimed(currentTimed);
    setAssigneeId(currentAssignees[0]?.id ?? '');
    onClose();
  };

  const onSubmit = (values: TaskEditValues) => {
    if (!task) return;
    onSave(task.id, {
      ...values,
      assignees: selectedPeople(),
      objectiveId: objectiveId || undefined,
      workType: workType || undefined,
      priority: priority || undefined,
      timed,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Task"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} isLoading={isSaving} loadingText="Saving…">
            Save Changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 mt-4">
        {/* Task name */}
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-medium text-gray-700">Task Name</label>
          <input
            {...register('name', { required: 'Task name is required' })}
            className={inputClass(errors.name?.message)}
          />
          {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
        </div>

        {/* Work type and priority */}
        {(workTypeOptions.length > 0 || priorityOptions.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {workTypeOptions.length > 0 && (
              <SearchSelect
                label="Type"
                placeholder="Select type"
                options={workTypeOptions}
                value={workType}
                onChange={setWorkType}
                clearable={false}
              />
            )}
            {priorityOptions.length > 0 && (
              <SearchSelect
                label="Priority"
                placeholder="Select priority"
                options={priorityOptions}
                value={priority}
                onChange={setPriority}
                clearable={false}
              />
            )}
          </div>
        )}

        {/* Objective */}
        {objectiveOptions.length > 0 && (
          <SearchSelect
            label="Objective"
            placeholder="No objective (directly under the project)"
            options={objectiveOptions}
            value={objectiveId}
            onChange={setObjectiveId}
          />
        )}

        {/* Due date */}
        <Controller
          name="dueDate"
          control={control}
          rules={{ required: 'Due date is required' }}
          render={({ field }) => (
            <DatePicker
              label="Due Date"
              value={field.value}
              onChange={field.onChange}
              error={errors.dueDate?.message}
            />
          )}
        />

        {/* Status */}
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-medium text-gray-700">Status</label>
          <select {...register('status')} className={inputClass()}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Timed */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700">Timed task</label>
            <p className="text-xs text-gray-400">The assignee can start and pause a timer on it.</p>
          </div>
          <Toggle enabled={timed} onChange={setTimed} />
        </div>

        {/* Assign to employee */}
        <SearchSelect
          label="Assigned To"
          placeholder="Unassigned"
          options={employeeOptions}
          value={assigneeId}
          onChange={setAssigneeId}
        />
      </div>
    </Modal>
  );
}
