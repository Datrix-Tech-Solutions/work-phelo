'use client';

import { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Search } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { useEmployeeOptions } from '@/hooks/hr/useEmployees';
import { inputClass, cn } from '@/lib/utils';

interface TaskFormValues {
  name: string;
  dueDate: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (values: {
    name: string;
    dueDate: string;
    status: 'TODO';
    assignedEmployeeId?: string;
  }) => void;
  isCreating?: boolean;
}

export function CreateTaskPanel({ isOpen, onClose, onCreate, isCreating }: Props) {
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | undefined>(undefined);

  const { data: employees = [], isLoading: loadingEmployees } = useEmployeeOptions();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<TaskFormValues>();

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

  const selectedEmployee = useMemo(
    () => activeEmployees.find((e) => e.id === selectedEmployeeId),
    [activeEmployees, selectedEmployeeId],
  );

  const handleClose = () => {
    reset();
    setEmployeeSearch('');
    setSelectedEmployeeId(undefined);
    onClose();
  };

  const onSubmit = (values: TaskFormValues) => {
    onCreate({ ...values, status: 'TODO', assignedEmployeeId: selectedEmployeeId });
    reset();
    setEmployeeSearch('');
    setSelectedEmployeeId(undefined);
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Task"
      description="Add a new task and optionally assign it to a team member."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} isLoading={isCreating} loadingText="Creating…">
            Create Task
          </Button>
        </div>
      }
    >
      {/* Task name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Task Name</label>
        <input
          {...register('name', { required: 'Task name is required' })}
          placeholder="e.g. Design the Database Schema"
          className={inputClass(errors.name?.message)}
        />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>

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

      {/* Assign to employee */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">Assign To</label>

        {/* Selected pill */}
        {selectedEmployee && (
          <div className="flex items-center gap-2 px-3 py-2 bg-brand/5 border border-brand/20 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-brand">
                {selectedEmployee.firstName[0]}
                {selectedEmployee.lastName[0]}
              </span>
            </div>
            <span className="text-sm text-gray-800 flex-1">
              {selectedEmployee.firstName} {selectedEmployee.lastName}
            </span>
            <button
              type="button"
              onClick={() => setSelectedEmployeeId(undefined)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Remove
            </button>
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

        {/* Employee list */}
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {loadingEmployees ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-11 bg-gray-100 rounded-lg animate-pulse" />
            ))
          ) : filteredEmployees.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No employees found</p>
          ) : (
            filteredEmployees.map((emp) => {
              const isSelected = selectedEmployeeId === emp.id;
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => setSelectedEmployeeId(isSelected ? undefined : emp.id)}
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
    </SidePanel>
  );
}
