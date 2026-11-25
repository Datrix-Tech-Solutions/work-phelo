'use client';

import { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Toggle } from '@/components/atoms/Toggle';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { useProjectMembers } from '@/hooks';
import { Avatar } from '@/components/atoms/Avatar';
import { inputClass } from '@/lib/utils';
import type { TaskAssignee } from '@/types/hr';

interface TaskFormValues {
  name: string;
  dueDate: string;
}

interface Props {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreate: (values: {
    name: string;
    dueDate: string;
    status: 'TODO';
    /** The person picked, if any: a task has one at most. */
    assignees: TaskAssignee[];
    objectiveId?: string;
    workType?: string;
    priority?: string;
    timed?: boolean;
  }) => void;
  isCreating?: boolean;
  /** The project's objectives; the field only shows when there are some. */
  objectiveOptions?: SearchSelectOption[];
  /** Preselects an objective, e.g. when adding from an objective's row. Remount (key) to change it. */
  defaultObjectiveId?: string;
  /** From the project's setup; each field only shows when it has options. */
  workTypeOptions?: SearchSelectOption[];
  priorityOptions?: SearchSelectOption[];
  defaultWorkType?: string;
  defaultPriority?: string;
  /** Whether new tasks start as timed, e.g. on a project billed by time. */
  defaultTimed?: boolean;
  /** Keeps the task timed with no way to turn it off, e.g. on a project billed by time. */
  lockTimed?: boolean;
}

export function CreateTaskModal({
  projectId,
  isOpen,
  onClose,
  onCreate,
  isCreating,
  objectiveOptions = [],
  defaultObjectiveId,
  workTypeOptions = [],
  priorityOptions = [],
  defaultWorkType = '',
  defaultPriority = '',
  defaultTimed = false,
  lockTimed = false,
}: Props) {
  const [objectiveId, setObjectiveId] = useState(defaultObjectiveId ?? '');
  const [workType, setWorkType] = useState(defaultWorkType);
  const [priority, setPriority] = useState(defaultPriority);
  const [timed, setTimed] = useState(defaultTimed);
  const [assigneeId, setAssigneeId] = useState('');

  const { data: members = [] } = useProjectMembers(projectId);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<TaskFormValues>();

  const memberOptions = useMemo(
    () =>
      members.map((m) => ({
        value: m.employeeId,
        label: m.name,
        sublabel: m.jobTitle,
        icon: <Avatar name={m.name} avatarUrl={m.avatarUrl} size={20} />,
      })),
    [members],
  );

  const handleClose = () => {
    setAssigneeId('');
    setObjectiveId(defaultObjectiveId ?? '');
    setWorkType(defaultWorkType);
    setPriority(defaultPriority);
    setTimed(defaultTimed);
    onClose();
  };

  const onSubmit = (values: TaskFormValues) => {
    onCreate({
      ...values,
      status: 'TODO',
      assignees: members
        .filter((m) => m.employeeId === assigneeId)
        .map((m) => ({ id: m.employeeId, name: m.name, avatarUrl: m.avatarUrl })),
      objectiveId: objectiveId || undefined,
      workType: workType || undefined,
      priority: priority || undefined,
      timed: timed || lockTimed,
    });
    reset({ name: '', dueDate: '' });
    setObjectiveId(defaultObjectiveId ?? '');
    setWorkType(defaultWorkType);
    setPriority(defaultPriority);
    setTimed(defaultTimed);
    setAssigneeId('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Task"
      description="Add a new task and optionally assign it to a team member."
      width="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} isLoading={isCreating} loadingText="Creating…">
            Create Task
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
            placeholder="e.g. Design the Database Schema"
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

        {/* Timed */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700">Timed task</label>
            <p className="text-xs text-gray-400">The assignee can start and pause a timer on it.</p>
          </div>
          <Toggle enabled={timed || lockTimed} onChange={lockTimed ? () => {} : setTimed} />
        </div>

        {/* Assign to employee */}
        <SearchSelect
          label="Assign To"
          placeholder="Unassigned"
          options={memberOptions}
          value={assigneeId}
          onChange={setAssigneeId}
        />
      </div>
    </Modal>
  );
}
