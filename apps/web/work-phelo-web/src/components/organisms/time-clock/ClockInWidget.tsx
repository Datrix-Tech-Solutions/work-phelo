'use client';

import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TodaySession } from '@/types/timeclock';

interface ClockInWidgetProps {
  session: TodaySession | undefined;
  isLoading: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
  onReportMissed: () => void;
  isClockingIn: boolean;
  isClockingOut: boolean;
}

function formatBannerDate(d: Date) {
  const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date} • ${time}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
}

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function getStatusLabel(status: string | undefined) {
  if (status === 'CLOCKED_IN') return 'In Progress';
  if (status === 'ON_BREAK') return 'On Break';
  if (status === 'CLOCKED_OUT') return 'Completed';
  return 'Not Started';
}

export function ClockInWidget({
  session,
  isLoading,
  onClockIn,
  onClockOut,
  onReportMissed,
  isClockingIn,
  isClockingOut,
}: ClockInWidgetProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const sessionMs =
    (session?.status === 'CLOCKED_IN' || session?.status === 'ON_BREAK') && session?.clockIn
      ? now.getTime() - new Date(session.clockIn).getTime()
      : 0;

  const isClockedIn = session?.status === 'CLOCKED_IN';
  const isOnBreak = session?.status === 'ON_BREAK';
  const isActive = isClockedIn || isOnBreak;
  const isDone = !isActive && !!session?.clockOut;

  const netMinutes = session
    ? session.totalMinutes + (isActive ? Math.floor(sessionMs / 60000) - session.breakMinutes : 0)
    : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Card ─────────────────────────────────────────────── */}
      <div className="rounded-card overflow-hidden border border-gray-200 shadow-sm">
        {/* Banner */}
        <div
          className="relative overflow-hidden px-7 py-5 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #0D1F44 0%, #1E3A8A 100%)' }}
        >
          {/* Decorative clock SVG */}

          {/* Left: Today label + date/time */}
          <div className="shrink-0 z-10">
            <p className="text-blue-300 text-xs font-medium mb-0.5">Today</p>
            <p className="text-white text-xl font-bold tracking-tight leading-snug">
              {formatBannerDate(now)}
            </p>
            {session?.isLate && isClockedIn && (
              <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-orange-500/20 rounded-full">
                <AlertCircle className="w-3 h-3 text-orange-300" />
                <span className="text-orange-300 text-xs font-medium">Late arrival</span>
              </span>
            )}
          </div>

          {/* Right: Action buttons */}
          <div className="flex items-center gap-2 z-10 shrink-0">
            {isLoading && <span className="text-blue-300 text-sm">Loading…</span>}

            {!isLoading && !isActive && !isDone && (
              <BannerButton
                onClick={onClockIn}
                disabled={isClockingIn}
                label={isClockingIn ? 'Clocking in…' : 'Clock in'}
                variant="white"
              />
            )}

            {!isLoading && isDone && (
              <span className="text-blue-300 text-sm">All done for today!</span>
            )}

            {!isLoading && isClockedIn && (
              <BannerButton
                onClick={onClockOut}
                disabled={isClockingOut}
                label={isClockingOut ? 'Clocking out…' : 'Clock out'}
                variant="white"
              />
            )}

            {!isLoading && isOnBreak && (
              <BannerButton
                onClick={onClockOut}
                disabled={isClockingOut}
                label={isClockingOut ? 'Clocking out…' : 'Clock out'}
                variant="white"
              />
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 bg-white divide-x divide-gray-100">
          <StatCell label="Clock In" value={session?.clockIn ? formatTime(session.clockIn) : '-'} />
          <StatCell
            label="Clock Out"
            value={session?.clockOut ? formatTime(session.clockOut) : '-'}
          />
          <StatCell label="Hours Worked" value={netMinutes > 0 ? formatMinutes(netMinutes) : '-'} />
          <StatCell label="Status" value={isLoading ? '…' : getStatusLabel(session?.status)} />
        </div>
      </div>

      {/* Report missed entry */}
      <div className="flex justify-end">
        <button
          onClick={onReportMissed}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
        >
          Report a missed clock entry
        </button>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function BannerButton({
  onClick,
  disabled,
  label,
  variant,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  variant: 'white' | 'ghost';
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-5 py-2 text-sm font-medium rounded-input transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
        variant === 'white'
          ? 'bg-white text-[#0D1F44] hover:bg-blue-50'
          : 'bg-white/10 text-white hover:bg-white/20',
      )}
    >
      {label}
    </button>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-6 py-4 flex flex-col gap-1">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-semibold text-gray-800 tabular-nums">{value}</p>
    </div>
  );
}
