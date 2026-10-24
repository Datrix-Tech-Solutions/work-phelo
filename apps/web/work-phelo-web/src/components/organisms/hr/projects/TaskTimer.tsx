'use client';

import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { useMyProfile } from '@/hooks';
import { useTaskTimeStore, type PersonTimer } from '@/store/taskTime.store';
import { formatElapsed, timerElapsedMs, totalElapsedMs, useNow } from '@/lib/taskTime';

interface Props {
  taskId: string;
  taskName: string;
  /** Whether the person can start their own timer on this task. */
  canTrack: boolean;
  /** A finished task can't be timed any more. */
  finished: boolean;
}

/** The timer in a task's details: your Start/Pause, your time, and everyone's. */
export function TaskTimer({ taskId, taskName, canTrack, finished }: Props) {
  const { data: me } = useMyProfile();
  const timersById = useTaskTimeStore((s) => s.timersByTaskId[taskId]);
  const allTimers = useTaskTimeStore((s) => s.timersByTaskId);
  const start = useTaskTimeStore((s) => s.start);
  const pause = useTaskTimeStore((s) => s.pause);
  const [asking, setAsking] = useState<PersonTimer[] | null>(null);

  const timers = timersById ? Object.values(timersById) : [];
  const now = useNow(timers.some((t) => t.runningSince));
  const mine = me ? timersById?.[me.id] : undefined;
  const person = me ? { id: me.id, name: `${me.firstName} ${me.lastName}` } : null;

  // The person's other running timers, on any task.
  const othersRunning = (): PersonTimer[] =>
    me
      ? Object.entries(allTimers).flatMap(([id, byPerson]) =>
          id !== taskId && byPerson[me.id]?.runningSince ? [byPerson[me.id]] : [],
        )
      : [];
  const pauseOthers = () => {
    if (!me) return;
    for (const [id, byPerson] of Object.entries(allTimers)) {
      if (id !== taskId && byPerson[me.id]?.runningSince) pause(id, me.id);
    }
  };

  const handleStart = () => {
    if (!person) return;
    const others = othersRunning();
    if (others.length > 0) setAsking(others);
    else start(taskId, taskName, person);
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
            <Button variant="outline" onClick={() => me && pause(taskId, me.id)}>
              <Pause className="w-4 h-4 mr-1.5" /> Pause
            </Button>
          ) : (
            <Button onClick={handleStart} disabled={finished || !person}>
              <Play className="w-4 h-4 mr-1.5" /> {mine ? 'Resume' : 'Start'}
            </Button>
          ))}
      </div>

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
                if (person) start(taskId, taskName, person);
                setAsking(null);
              }}
            >
              Run Together
            </Button>
            <Button
              onClick={() => {
                pauseOthers();
                if (person) start(taskId, taskName, person);
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
            <li key={t.taskName + t.personId}>{t.taskName}</li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
