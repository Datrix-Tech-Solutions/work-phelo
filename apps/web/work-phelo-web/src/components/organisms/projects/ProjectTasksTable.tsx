'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { CreateTaskPanel } from '@/components/organisms/projects/CreateTaskPanel';
import {
  EditTaskPanel,
  ProjectTask,
  TaskStatus,
} from '@/components/organisms/projects/EditTaskPanel';

const STATUS_META: Record<TaskStatus, { dot: string; label: string; text: string }> = {
  TODO: { dot: 'bg-gray-400', label: 'To Do', text: 'text-gray-600' },
  IN_PROGRESS: { dot: 'bg-blue-500', label: 'In Progress', text: 'text-blue-600' },
  DONE: { dot: 'bg-green-500', label: 'Done', text: 'text-green-600' },
  ON_HOLD: { dot: 'bg-red-500', label: 'On Hold', text: 'text-red-600' },
};

const STATUS_FILTER_OPTIONS = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'DONE', label: 'Done' },
];

function formatDue(dateStr: string) {
  const d = new Date(dateStr);
  return `Due ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

const TASKS: ProjectTask[] = [];

const COLUMNS: Column<ProjectTask>[] = [
  {
    key: 'name',
    label: 'Task',
    render: (row) => {
      const meta = STATUS_META[row.status];
      const isDone = row.status === 'DONE';
      return (
        <div className="flex items-start gap-3">
          <span className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', meta.dot)} />
          <div>
            <p className={cn('font-medium text-gray-900', isDone && 'line-through text-gray-400')}>
              {row.name}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{formatDue(row.dueDate)}</p>
          </div>
        </div>
      );
    },
  },
  {
    key: 'status',
    label: 'Status',
    width: '160px',
    render: (row) => {
      const meta = STATUS_META[row.status];
      return (
        <div className="flex items-center gap-1.5">
          <span className={cn('w-2 h-2 rounded-full shrink-0', meta.dot)} />
          <span className={cn('text-sm font-medium', meta.text)}>{meta.label}</span>
        </div>
      );
    },
  },
  {
    key: 'assignedTo',
    label: 'Assigned To',
    width: '200px',
    render: (row) =>
      row.assignedTo ? <span>{row.assignedTo}</span> : <span className="text-gray-300">—</span>,
  },
];

export function ProjectTasksTable() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return TASKS.filter((t) => {
      const matchesStatus = !statusFilter || t.status === statusFilter;
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        (t.assignedTo?.toLowerCase().includes(q) ?? false);
      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter]);

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={filtered}
        searchPlaceholder="Search tasks or assignee…"
        searchValue={search}
        onSearch={setSearch}
        filterOptions={STATUS_FILTER_OPTIONS}
        onFilter={setStatusFilter}
        actionButton={{ label: '+ Create Task', onClick: () => setCreateOpen(true) }}
        onRowClick={setSelectedTask}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        emptyMessage="No tasks found"
      />

      <CreateTaskPanel
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(values) => {
          // TODO: POST /hr/projects/:id/tasks
          console.log('Create task', values);
          setCreateOpen(false);
        }}
      />

      <EditTaskPanel
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onSave={(id, values) => {
          // TODO: PATCH /hr/projects/:id/tasks/:taskId
          console.log('Save task', id, values);
          setSelectedTask(null);
        }}
      />
    </>
  );
}
