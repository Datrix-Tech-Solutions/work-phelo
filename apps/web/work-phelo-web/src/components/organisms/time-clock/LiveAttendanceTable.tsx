'use client';

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/atoms/Badge';
import { cn } from '@/lib/utils';
import { useLiveAttendance, useAttendanceStats } from '@/hooks/useTimeClock';
import type { LiveAttendanceEntry } from '@/types/timeclock';

function formatDurationMs(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function LiveAttendanceTable() {
  // Snapshot of current time, updated every 60 s to refresh durations
  const [now, setNow] = useState(() => Date.now());

  const { data: entries = [], isLoading, dataUpdatedAt, refetch, isFetching } = useLiveAttendance();

  const { data: stats } = useAttendanceStats();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null;

  const STAT_CARDS = [
    {
      label: 'Clocked In',
      value: stats?.clockedIn ?? 0,
      color: 'text-green-700',
      bg: 'bg-green-50 border-green-100',
    },
    {
      label: 'Absent',
      value: stats?.absent ?? 0,
      color: 'text-red-700',
      bg: 'bg-red-50 border-red-100',
    },
    {
      label: 'Late Arrivals',
      value: stats?.late ?? 0,
      color: 'text-orange-700',
      bg: 'bg-orange-50 border-orange-100',
    },
    {
      label: 'On Break',
      value: stats?.onBreak ?? 0,
      color: 'text-blue-700',
      bg: 'bg-blue-50 border-blue-100',
    },
  ];

  return (
    <div className="flex flex-col gap-5 flex-1 min-h-0">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 shrink-0">
        {STAT_CARDS.map((card) => (
          <div
            key={card.label}
            className={cn('rounded-card border px-4 py-3 flex flex-col gap-1', card.bg)}
          >
            <p className="text-xs font-medium text-gray-500">{card.label}</p>
            <div className="flex items-baseline gap-1.5">
              <p className={cn('text-2xl font-bold tabular-nums', card.color)}>{card.value}</p>
              {stats && <span className="text-xs text-gray-400">/ {stats.total}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* List header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-gray-900">Live Attendance</h3>
          {lastUpdated && <span className="text-xs text-gray-400">· updated at {lastUpdated}</span>}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-input hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3 h-3', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Employee list */}
      <div className="border border-gray-100 rounded-input overflow-hidden">
        {/* Header row */}
        <div
          className="grid px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide"
          style={{ gridTemplateColumns: '2fr 1.5fr 120px 100px 110px' }}
        >
          <span>Employee</span>
          <span>Department</span>
          <span>Clock In</span>
          <span>Duration</span>
          <span>Status</span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-300">
              <RefreshCw className="w-5 h-5" />
            </div>
            <p className="text-sm text-gray-400">No employees clocked in right now</p>
          </div>
        ) : (
          entries.map((entry, i) => (
            <LiveRow key={entry.id} entry={entry} isLast={i === entries.length - 1} now={now} />
          ))
        )}
      </div>
    </div>
  );
}

function LiveRow({
  entry,
  isLast,
  now,
}: {
  entry: LiveAttendanceEntry;
  isLast: boolean;
  now: number;
}) {
  const duration = formatDurationMs(now - new Date(entry.clockIn).getTime());

  const statusBadge =
    entry.status === 'ON_BREAK' ? (
      <Badge variant="info" label="On Break" />
    ) : entry.isLate ? (
      <Badge variant="warning" label="Late" />
    ) : (
      <Badge variant="success" label="On Time" />
    );

  return (
    <div
      className={cn(
        'grid px-4 py-3.5 items-center text-sm text-gray-700 hover:bg-gray-50 transition-colors',
        !isLast && 'border-b border-gray-100',
      )}
      style={{ gridTemplateColumns: '2fr 1.5fr 120px 100px 110px' }}
    >
      {/* Avatar + name */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-brand text-white text-xs font-semibold flex items-center justify-center shrink-0 overflow-hidden">
          {entry.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            getInitials(entry.employeeName)
          )}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">{entry.employeeName}</p>
          {entry.jobTitle && <p className="text-xs text-gray-400 truncate">{entry.jobTitle}</p>}
        </div>
      </div>

      <span className="text-gray-600 truncate">{entry.department ?? '—'}</span>
      <span className="tabular-nums text-gray-700">{formatTime(entry.clockIn)}</span>
      <span className="tabular-nums font-medium text-gray-900">{duration}</span>
      <span>{statusBadge}</span>
    </div>
  );
}
