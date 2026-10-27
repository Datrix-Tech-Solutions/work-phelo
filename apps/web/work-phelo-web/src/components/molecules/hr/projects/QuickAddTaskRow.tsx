'use client';

import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, Timer, User, X } from 'lucide-react';
import { TableButton } from '@/components/atoms/TableButton';
import { DatePicker } from '@/components/atoms/DatePicker';
import { AvatarStack } from '@/components/atoms/AvatarStack';
import { TypeChipSelect, TypeChipOption } from '@/components/atoms/TypeChipSelect';
import { useDropdownPosition, useProjectMembers } from '@/hooks';
import { popupClass } from '@/lib/utils';
import type { TaskAssignee } from '@/types/hr';

interface Props {
  projectId: string;
  /** Resolves true once the task is created, which clears the row. */
  onCreate: (values: {
    name: string;
    dueDate?: string;
    assignees: TaskAssignee[];
    objectiveId?: string;
    timed: boolean;
  }) => Promise<boolean>;
  /** Whether new tasks start as timed, e.g. on a project billed by time. */
  defaultTimed?: boolean;
  /** The project's objectives; the picker only shows when there are some. */
  objectiveOptions?: TypeChipOption[];
  isCreating?: boolean;
}

/** The last line of a list: type a name and press Enter, optionally picking assignees and a due date. */
export function QuickAddTaskRow({
  projectId,
  onCreate,
  isCreating,
  objectiveOptions = [],
  defaultTimed = false,
}: Props) {
  const [timed, setTimed] = useState(defaultTimed);
  // Just a button until it is pressed, then the field and its icons appear.
  const [active, setActive] = useState(false);
  const [objectiveId, setObjectiveId] = useState('');
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignees, setAssignees] = useState<TaskAssignee[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const { pos } = useDropdownPosition(pickerOpen, triggerRef);
  const { data: members = [] } = useProjectMembers(projectId);

  const selectedIds = useMemo(() => new Set(assignees.map((a) => a.id)), [assignees]);

  const toggleMember = (m: (typeof members)[number]) =>
    setAssignees((prev) =>
      prev.some((a) => a.id === m.employeeId)
        ? prev.filter((a) => a.id !== m.employeeId)
        : [...prev, { id: m.employeeId, name: m.name, avatarUrl: m.avatarUrl }],
    );

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || isCreating) return;
    const ok = await onCreate({
      name: trimmed,
      dueDate: dueDate || undefined,
      assignees,
      objectiveId: objectiveId || undefined,
      timed,
    });
    if (!ok) return;
    setName('');
    setDueDate('');
    setAssignees([]);
    setObjectiveId('');
    setTimed(defaultTimed);
    inputRef.current?.focus();
  };

  const cancel = () => {
    setActive(false);
    setPickerOpen(false);
    setName('');
    setDueDate('');
    setAssignees([]);
    setObjectiveId('');
    setTimed(defaultTimed);
  };

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        className="flex w-full items-center gap-2 px-4 py-2 border-t border-gray-100 text-left text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Create
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-1 border-t border-gray-100">
      <button
        type="button"
        title="Close"
        aria-label="Close"
        onClick={cancel}
        className="inline-flex items-center justify-center h-8 w-8 shrink-0 rounded-full text-red-500 hover:bg-red-50 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      <input
        ref={inputRef}
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') cancel();
        }}
        disabled={isCreating}
        placeholder="Enter task name"
        className="flex-1 min-w-0 h-8 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
      />

      {objectiveOptions.length > 0 && (
        <TypeChipSelect
          value={objectiveId}
          options={objectiveOptions}
          emptyLabel="Objective"
          onChange={setObjectiveId}
        />
      )}

      <div className="flex items-center gap-1 shrink-0">
        {assignees.length > 0 && <AvatarStack people={assignees} size={32} />}
        <button
          ref={triggerRef}
          type="button"
          title="Assign"
          aria-label="Assign"
          onClick={() => setPickerOpen((o) => !o)}
          className="inline-flex items-center justify-center h-8 w-8 shrink-0 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
        >
          <User className="w-5 h-5" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          title={timed ? 'Timed: click to turn off' : 'Not timed: click to make it timed'}
          aria-label="Timed task"
          aria-pressed={timed}
          onClick={() => setTimed((t) => !t)}
          className={`inline-flex items-center justify-center h-9 w-9 rounded-input transition-colors ${
            timed ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Timer className="w-6 h-6" strokeWidth={2.25} />
        </button>
        <DatePicker iconOnly value={dueDate} onChange={setDueDate} />
      </div>

      <TableButton onClick={submit} disabled={!name.trim()} isLoading={isCreating}>
        Create
      </TableButton>

      {pickerOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
            <div
              ref={popupRef}
              style={{
                position: 'fixed',
                top: pos.top,
                bottom: pos.bottom,
                left: Math.max(8, pos.left + pos.width - 240),
                width: 240,
                maxHeight: pos.maxHeight,
              }}
              className={popupClass('z-50 overflow-y-auto p-1')}
            >
              {members.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400">No members found</p>
              ) : (
                members.map((m) => (
                  <button
                    key={m.employeeId}
                    type="button"
                    onClick={() => toggleMember(m)}
                    className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-left text-sm text-gray-800 hover:bg-gray-50"
                  >
                    <span className="flex-1 truncate">{m.name}</span>
                    {selectedIds.has(m.employeeId) && (
                      <Check className="w-4 h-4 shrink-0 text-brand" />
                    )}
                  </button>
                ))
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
