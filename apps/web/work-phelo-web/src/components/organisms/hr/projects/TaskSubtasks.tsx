'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { inputClass, cn } from '@/lib/utils';
import { useProjectWorkStore } from '@/store/projectWork.store';

interface Props {
  projectId: string;
  taskId: string;
  /** Whether the person can tick, add and remove subtasks. */
  canModify: boolean;
}

/** A task's subtasks, as the steps to follow to finish it: tick them off, add more, remove them. */
export function TaskSubtasks({ projectId, taskId, canModify }: Props) {
  const allSubtasks = useProjectWorkStore((s) => s.subtasks);
  const addSubtask = useProjectWorkStore((s) => s.addSubtask);
  const updateSubtask = useProjectWorkStore((s) => s.updateSubtask);
  const removeSubtask = useProjectWorkStore((s) => s.removeSubtask);
  const [draft, setDraft] = useState('');

  const subtasks = allSubtasks.filter((st) => st.taskId === taskId);
  if (subtasks.length === 0 && !canModify) return null;

  const done = subtasks.filter((st) => st.done).length;

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    addSubtask(projectId, { name, taskId });
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-700">Subtasks</p>
        {subtasks.length > 0 && (
          <p className="text-xs text-gray-400">
            {done} of {subtasks.length} done
          </p>
        )}
      </div>
      {subtasks.length > 0 && (
        <ProgressBar value={Math.round((done / subtasks.length) * 100)} showLabel={false} />
      )}

      {subtasks.length > 0 && (
        <ul className="flex flex-col gap-1">
          {subtasks.map((st) => (
            <li key={st.id} className="flex items-center gap-2.5 py-1">
              <input
                type="checkbox"
                checked={st.done}
                disabled={!canModify}
                onChange={() => updateSubtask(st.id, { done: !st.done })}
                aria-label={`Mark ${st.name} ${st.done ? 'not done' : 'done'}`}
                className="w-4 h-4 accent-(--module-btn-bg,var(--color-brand))"
              />
              <span
                className={cn(
                  'flex-1 min-w-0 text-sm text-gray-900',
                  st.done && 'line-through text-gray-400',
                )}
              >
                {st.name}
              </span>
              {canModify && (
                <button
                  type="button"
                  aria-label={`Remove ${st.name}`}
                  onClick={() => removeSubtask(st.id)}
                  className="p-0.5 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canModify && (
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={draft}
              placeholder="Add a subtask"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
              className={inputClass()}
            />
          </div>
          <Button variant="outline" onClick={add} disabled={!draft.trim()}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
