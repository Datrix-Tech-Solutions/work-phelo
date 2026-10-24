'use client';

import { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Search } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Toggle } from '@/components/atoms/Toggle';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { useProjectMembers } from '@/hooks';
import { inputClass, cn } from '@/lib/utils';
import type { TaskAssignee } from '@/types/hr';

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

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
    /** Everyone picked; the first is also the backend's single assignee. */
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
}: Props) {
  const [objectiveId, setObjectiveId] = useState(defaultObjectiveId ?? '');
  const [workType, setWorkType] = useState(defaultWorkType);
  const [priority, setPriority] = useState(defaultPriority);
  const [timed, setTimed] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: members = [], isLoading: loadingMembers } = useProjectMembers(projectId);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<TaskFormValues>();

  const filteredMembers = useMemo(() => {
    const q = employeeSearch.toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.jobTitle?.toLowerCase().includes(q),
    );
  }, [members, employeeSearch]);

  const selectedMembers = useMemo(
    () =>
      selectedIds
        .map((id) => members.find((m) => m.employeeId === id))
        .filter((m): m is (typeof members)[number] => !!m),
    [members, selectedIds],
  );

  const toggleMember = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleClose = () => {
    setEmployeeSearch('');
    setSelectedIds([]);
    setObjectiveId(defaultObjectiveId ?? '');
    setWorkType(defaultWorkType);
    setPriority(defaultPriority);
    setTimed(false);
    onClose();
  };

  const onSubmit = (values: TaskFormValues) => {
    onCreate({
      ...values,
      status: 'TODO',
      assignees: selectedMembers.map((m) => ({
        id: m.employeeId,
        name: m.name,
        avatarUrl: m.avatarUrl,
      })),
      objectiveId: objectiveId || undefined,
      workType: workType || undefined,
      priority: priority || undefined,
      timed,
    });
    reset({ name: '', dueDate: '' });
    setObjectiveId(defaultObjectiveId ?? '');
    setWorkType(defaultWorkType);
    setPriority(defaultPriority);
    setTimed(false);
    setEmployeeSearch('');
    setSelectedIds([]);
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
            <p className="text-xs text-gray-400">Assignees can start and pause a timer on it.</p>
          </div>
          <Toggle enabled={timed} onChange={setTimed} />
        </div>

        {/* Assign to employee */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">
            Assign To <span className="text-gray-400 font-normal">(one or more)</span>
          </label>

          {/* Selected people */}
          {selectedMembers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedMembers.map((m) => (
                <span
                  key={m.employeeId}
                  className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 bg-brand/5 border border-brand/20 rounded-full text-xs text-gray-800"
                >
                  <span className="w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center text-[9px] font-bold text-brand">
                    {getInitials(m.name)}
                  </span>
                  {m.name}
                  <button
                    type="button"
                    aria-label={`Remove ${m.name}`}
                    onClick={() => toggleMember(m.employeeId)}
                    className="text-gray-400 hover:text-gray-700"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              placeholder="Search by name or job title…"
              className="w-full h-9 pl-9 pr-4 border border-gray-200 rounded-input text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>

          {/* Member list */}
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {loadingMembers ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-11 bg-gray-100 rounded-lg animate-pulse" />
              ))
            ) : filteredMembers.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No members found</p>
            ) : (
              filteredMembers.map((member) => {
                const isSelected = selectedIds.includes(member.employeeId);
                return (
                  <button
                    key={member.employeeId}
                    type="button"
                    onClick={() => toggleMember(member.employeeId)}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left transition-colors',
                      isSelected ? 'bg-brand/5 ring-1 ring-brand/20' : 'hover:bg-gray-50',
                    )}
                  >
                    <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-brand">
                        {getInitials(member.name)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                      <p className="text-xs text-gray-400 truncate">{member.jobTitle}</p>
                    </div>
                    {isSelected && (
                      <span className="text-xs font-medium text-brand shrink-0">Selected</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
