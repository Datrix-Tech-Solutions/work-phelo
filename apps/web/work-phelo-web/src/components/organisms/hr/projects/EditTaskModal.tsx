'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Search } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Toggle } from '@/components/atoms/Toggle';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { useEmployeeOptions } from '@/hooks/hr/useEmployees';
import { inputClass, cn } from '@/lib/utils';
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
      /** Everyone picked; the first is also the backend's single assignee. */
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
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(currentAssignees.map((a) => a.id));

  // Reset local selections when the task changes. Normalise to null so that
  // `undefined` (task prop absent) and `null` (no task) compare equal and don't
  // trigger an infinite setState loop during render.
  const incomingTaskId = task?.id ?? null;
  if (incomingTaskId !== currentTaskId) {
    setCurrentTaskId(incomingTaskId);
    setSelectedIds(currentAssignees.map((a) => a.id));
    setEmployeeSearch('');
    setObjectiveId(currentObjectiveId ?? '');
    setWorkType(currentWorkType ?? '');
    setPriority(currentPriority ?? '');
    setTimed(currentTimed);
  }

  const { data: employees = [], isLoading: loadingEmployees } = useEmployeeOptions();

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

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.employmentStatus === 'ACTIVE'),
    [employees],
  );

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.toLowerCase();
    if (!q) return activeEmployees;
    return activeEmployees.filter(
      (e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.jobTitle?.toLowerCase().includes(q),
    );
  }, [activeEmployees, employeeSearch]);

  // Each picked person, from the employee list or, for someone no longer listed, from the task.
  const selectedPeople = useMemo<TaskAssignee[]>(
    () =>
      selectedIds.flatMap((id) => {
        const emp = employees.find((e) => e.id === id);
        if (emp) {
          return [{ id, name: `${emp.firstName} ${emp.lastName}`, avatarUrl: emp.avatarUrl }];
        }
        const current = currentAssignees.find((a) => a.id === id);
        return current ? [current] : [];
      }),
    [selectedIds, employees, currentAssignees],
  );

  const toggleEmployee = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleClose = () => {
    reset();
    setTimed(currentTimed);
    setEmployeeSearch('');
    setSelectedIds(currentAssignees.map((a) => a.id));
    onClose();
  };

  const onSubmit = (values: TaskEditValues) => {
    if (!task) return;
    onSave(task.id, {
      ...values,
      assignees: selectedPeople,
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
            <p className="text-xs text-gray-400">Assignees can start and pause a timer on it.</p>
          </div>
          <Toggle enabled={timed} onChange={setTimed} />
        </div>

        {/* Assign to employee */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">
            Assigned To <span className="text-gray-400 font-normal">(one or more, optional)</span>
          </label>

          {selectedPeople.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedPeople.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 bg-brand/5 border border-brand/20 rounded-full text-xs text-gray-800"
                >
                  <span className="w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center text-[9px] font-bold text-brand">
                    {p.name
                      .split(' ')
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join('')}
                  </span>
                  {p.name}
                  <button
                    type="button"
                    aria-label={`Remove ${p.name}`}
                    onClick={() => toggleEmployee(p.id)}
                    className="text-gray-400 hover:text-gray-700"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

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

          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {loadingEmployees ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-11 bg-gray-100 rounded-lg animate-pulse" />
              ))
            ) : filteredEmployees.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No employees found</p>
            ) : (
              filteredEmployees.map((emp) => {
                const isSelected = selectedIds.includes(emp.id);
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => toggleEmployee(emp.id)}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left transition-colors',
                      isSelected ? 'bg-brand/5 ring-1 ring-brand/20' : 'hover:bg-gray-50',
                    )}
                  >
                    <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-brand">
                        {emp.firstName[0]}
                        {emp.lastName[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {emp.firstName} {emp.lastName}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{emp.jobTitle}</p>
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
