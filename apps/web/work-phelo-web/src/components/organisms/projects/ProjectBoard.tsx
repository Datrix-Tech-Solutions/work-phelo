'use client';

import { useMemo } from 'react';
import { Calendar } from 'lucide-react';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'ON_HOLD' | 'DONE';

interface BoardTask {
  id: string;
  name: string;
  dueDate: string;
  assignedTo?: string;
  status: TaskStatus;
}

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: 'TODO', label: 'TO DO' },
  { key: 'IN_PROGRESS', label: 'IN PROGRESS' },
  { key: 'ON_HOLD', label: 'ON HOLD' },
  { key: 'DONE', label: 'DONE' },
];

const TASKS: BoardTask[] = [];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

function TaskCard({ task }: { task: BoardTask }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-col gap-3 shadow-sm">
      <p className="text-sm font-semibold text-gray-900 leading-snug">{task.name}</p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {task.assignedTo ? (
            <>
              <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-brand">
                  {getInitials(task.assignedTo)}
                </span>
              </div>
              <span className="text-xs text-gray-600 truncate">{task.assignedTo}</span>
            </>
          ) : (
            <span className="text-xs text-gray-300">Unassigned</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-500">{formatDate(task.dueDate)}</span>
        </div>
      </div>
    </div>
  );
}

export function ProjectBoard() {
  const grouped = useMemo(() => {
    const map: Record<TaskStatus, BoardTask[]> = {
      TODO: [],
      IN_PROGRESS: [],
      ON_HOLD: [],
      DONE: [],
    };
    for (const task of TASKS) {
      map[task.status].push(task);
    }
    return map;
  }, []);

  return (
    <div className="flex gap-5 overflow-x-auto pb-4 min-h-0">
      {COLUMNS.map((col) => {
        const tasks = grouped[col.key];
        return (
          <div key={col.key} className="flex flex-col gap-3 min-w-[220px] flex-1">
            {/* Column header */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wide text-gray-500">{col.label}</span>
              <span className="text-xs text-gray-400">{tasks.length}</span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2">
              {tasks.length === 0 ? (
                <p className="text-xs text-gray-300 text-center py-8">No tasks</p>
              ) : (
                tasks.map((task) => <TaskCard key={task.id} task={task} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
