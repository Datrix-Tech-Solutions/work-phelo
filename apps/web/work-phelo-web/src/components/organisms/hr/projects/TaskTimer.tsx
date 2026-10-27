'use client';

import { useState } from 'react';
import { Pause, Pencil, Play, Plus } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { useMyProfile } from '@/hooks';
import { TimeEntryModal } from '@/components/organisms/hr/projects/TimeEntryModal';
import { useProjectInvoices } from '@/hooks/hr/useProjectInvoices';
import {
  useMyRunningTimers,
  useProjectTimers,
  useTaskTimeActions,
} from '@/hooks/hr/useProjectTime';
import { useSaveWithToast } from '@/hooks/hr/useProjectWork';
import { formatElapsed, timerElapsedMs, totalElapsedMs, useNow } from '@/lib/taskTime';

interface Props {
  taskId: string;
  projectId: string;
  /** Whether the person can start their own timer on this task. */
  canTrack: boolean;
  /** A finished task can't be timed any more. */
  finished: boolean;
}

/** The timer in a task's details: your Start/Pause, your time, and everyone's. */
export function TaskTimer({ taskId, projectId, canTrack, finished }: Props) {
  const { data: me } = useMyProfile();
  const { timersByTaskId } = useProjectTimers(projectId);
  const timersById = timersByTaskId[taskId];
  const { data: myRunning = [] } = useMyRunningTimers();
  const { start, pause, add, setMine } = useTaskTimeActions(projectId);
  const save = useSaveWithToast();
  const { active: invoices } = useProjectInvoices(projectId);
  const [entry, setEntry] = useState<'add' | 'set' | null>(null);
  const [asking, setAsking] = useState<{ taskId: string; taskName: string }[] | null>(null);

  const timers = timersById ? Object.values(timersById) : [];
  const now = useNow(timers.some((t) => t.runningSince));
  const mine = me ? timersById?.[me.id] : undefined;

  // The person's other running timers, on any task or project.
  const othersRunning = () => myRunning.filter((t) => t.taskId !== taskId);
  const startTimer = (pauseOthers: boolean) => save(start.mutateAsync({ taskId, pauseOthers }));

  // Once the task's time is on an invoice that still stands, the time is locked.
  const locked = invoices.some((i) => i.lines.some((l) => l.key === taskId));
  const myMs = mine ? timerElapsedMs(mine, now) : 0;

  const handleStart = () => {
    const others = othersRunning();
    if (others.length > 0) setAsking(others);
    else startTimer(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
            Time spent
          </p>
          <p className="text-2xl font-semibold text-gray-900 tabular-nums">
            {formatElapsed(totalElapsedMs(timers, now))}
          </p>
        </div>
        {canTrack &&
          (mine?.runningSince ? (
            <Button variant="outline" onClick={() => save(pause.mutateAsync(taskId))}>
              <Pause className="w-4 h-4 mr-1.5" /> Pause
            </Button>
          ) : (
            <Button onClick={handleStart} disabled={finished || !me || locked || start.isPending}>
              <Play className="w-4 h-4 mr-1.5" /> {mine ? 'Resume' : 'Start'}
            </Button>
          ))}
      </div>

      {locked && (
        <p className="text-xs text-gray-500">
          This task&apos;s time has been invoiced, so it can&apos;t be changed.
        </p>
      )}

      {canTrack && !locked && (
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEntry('add')} disabled={!me}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Time
          </Button>
          {mine && (
            <Button variant="outline" onClick={() => setEntry('set')}>
              <Pencil className="w-4 h-4 mr-1.5" /> Edit My Time
            </Button>
          )}
        </div>
      )}

      {timers.length > 0 && (
        <ul className="flex flex-col gap-1">
          {timers.map((t) => (
            <li key={t.personId} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-gray-700 min-w-0">
                {t.runningSince && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                )}
                <span className="truncate">{t.personId === me?.id ? 'You' : t.personName}</span>
              </span>
              <span className="tabular-nums text-gray-500">
                {formatElapsed(timerElapsedMs(t, now))}
              </span>
            </li>
          ))}
        </ul>
      )}

      {entry && (
        <TimeEntryModal
          mode={entry}
          currentMs={myMs}
          isOpen
          onClose={() => setEntry(null)}
          onSubmit={(ms) => {
            if (entry === 'add') save(add.mutateAsync({ taskId, ms }));
            if (entry === 'set') save(setMine.mutateAsync({ taskId, ms }));
            setEntry(null);
          }}
        />
      )}

      <Modal
        isOpen={!!asking}
        onClose={() => setAsking(null)}
        title="You have timers running"
        description="Your time is still running on:"
        footer={
          <>
            <Button variant="outline" onClick={() => setAsking(null)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                startTimer(false);
                setAsking(null);
              }}
            >
              Run Together
            </Button>
            <Button
              onClick={() => {
                startTimer(true);
                setAsking(null);
              }}
            >
              Pause Others
            </Button>
          </>
        }
      >
        <ul className="mt-4 flex flex-col gap-1 text-sm text-gray-800 list-disc pl-5">
          {asking?.map((t) => (
            <li key={t.taskId}>{t.taskName}</li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
