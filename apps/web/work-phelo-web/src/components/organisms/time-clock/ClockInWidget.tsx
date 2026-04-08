'use client';

import { useState, useEffect } from 'react';
import { Clock, Coffee, LogOut, AlertCircle, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TodaySession } from '@/types/timeclock';

interface ClockInWidgetProps {
  session: TodaySession | undefined;
  isLoading: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onReportMissed: () => void;
  isClockingIn: boolean;
  isClockingOut: boolean;
  isBreaking: boolean;
}

function formatLiveClock(d: Date) {
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function formatLiveDate(d: Date) {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatSessionDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}h ${mm}m ${ss}s`;
  return `${mm}m ${ss}s`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function ClockInWidget({
  session,
  isLoading,
  onClockIn,
  onClockOut,
  onStartBreak,
  onEndBreak,
  onReportMissed,
  isClockingIn,
  isClockingOut,
  isBreaking,
}: ClockInWidgetProps) {
  const [now, setNow] = useState(() => new Date());
  const [sessionMs, setSessionMs] = useState(0);

  // Live wall clock — ticks every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Session duration — counts up from clock-in time
  useEffect(() => {
    if (!session?.clockIn || session.status === 'CLOCKED_OUT') {
      setSessionMs(0);
      return;
    }
    const start = new Date(session.clockIn).getTime();
    const update = () => setSessionMs(Date.now() - start);
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [session?.clockIn, session?.status]);

  const isClockedIn = session?.status === 'CLOCKED_IN';
  const isOnBreak = session?.status === 'ON_BREAK';
  const isActive = isClockedIn || isOnBreak;
  const isDone = !isActive && !!session?.clockOut;

  // Net hours = total active time minus break time
  const netMinutes = session
    ? session.totalMinutes + (isActive ? Math.floor(sessionMs / 60000) - session.breakMinutes : 0)
    : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Compact horizontal card ───────────────────────────── */}
      <div
        className="rounded-card overflow-hidden select-none"
        style={{ background: 'linear-gradient(135deg, #0D1F44 0%, #1E3A8A 100%)' }}
      >
        <div className="flex items-center gap-4 px-6 py-4 flex-wrap">
          {/* Left: time + date */}
          <div className="shrink-0">
            <p className="text-white text-2xl font-bold tabular-nums tracking-tight leading-none">
              {formatLiveClock(now)}
            </p>
            <p className="text-blue-300 text-xs mt-0.5">{formatLiveDate(now)}</p>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-8 bg-white/20 shrink-0" />

          {/* Middle: status + session info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusPill status={session?.status ?? 'CLOCKED_OUT'} isLoading={isLoading} />

              {isActive && (
                <span className="text-blue-100 text-sm font-semibold tabular-nums">
                  {formatSessionDuration(sessionMs)}
                </span>
              )}

              {session?.isLate && isClockedIn && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 rounded-full">
                  <AlertCircle className="w-3 h-3 text-orange-300" />
                  <span className="text-orange-300 text-xs font-medium">Late</span>
                </span>
              )}
            </div>

            <p className="text-blue-300 text-xs mt-1">
              {isActive
                ? `since ${session?.clockIn ? formatTime(session.clockIn) : '—'}`
                : isDone
                  ? `clocked out at ${formatTime(session!.clockOut!)}`
                  : 'not clocked in today'}
            </p>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {!isActive && !isDone && (
              <ActionButton
                onClick={onClockIn}
                disabled={isClockingIn || isLoading}
                icon={<LogIn className="w-3.5 h-3.5" />}
                label={isClockingIn ? 'Clocking in…' : 'Clock In'}
                className="bg-green-500 hover:bg-green-600 font-semibold"
              />
            )}

            {isDone && <p className="text-blue-300 text-xs">All done for today!</p>}

            {isClockedIn && (
              <>
                <ActionButton
                  onClick={onStartBreak}
                  disabled={isBreaking || isClockingOut}
                  icon={<Coffee className="w-3.5 h-3.5" />}
                  label={isBreaking ? 'Starting…' : 'Break'}
                  className="bg-white/10 hover:bg-white/20 font-medium"
                />
                <ActionButton
                  onClick={onClockOut}
                  disabled={isClockingOut || isBreaking}
                  icon={<LogOut className="w-3.5 h-3.5" />}
                  label={isClockingOut ? 'Clocking out…' : 'Clock Out'}
                  className="bg-orange-500/90 hover:bg-orange-500 font-semibold"
                />
              </>
            )}

            {isOnBreak && (
              <>
                <ActionButton
                  onClick={onEndBreak}
                  disabled={isBreaking || isClockingOut}
                  icon={<Clock className="w-3.5 h-3.5" />}
                  label={isBreaking ? 'Ending…' : 'End Break'}
                  className="bg-green-500/90 hover:bg-green-500 font-semibold"
                />
                <ActionButton
                  onClick={onClockOut}
                  disabled={isClockingOut || isBreaking}
                  icon={<LogOut className="w-3.5 h-3.5" />}
                  label={isClockingOut ? 'Clocking out…' : 'Clock Out'}
                  className="bg-white/10 hover:bg-white/20 font-medium"
                />
              </>
            )}
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-4 border-t border-white/10">
          <SummaryStrip
            label="Clock In"
            value={session?.clockIn ? formatTime(session.clockIn) : '—'}
            dim={!session?.clockIn}
          />
          <SummaryStrip
            label="Clock Out"
            value={session?.clockOut ? formatTime(session.clockOut) : isActive ? 'Active' : '—'}
            muted={isActive && !session?.clockOut}
            dim={!session?.clockOut && !isActive}
          />
          <SummaryStrip
            label="Break"
            value={session?.breakMinutes ? formatMinutes(session.breakMinutes) : '0m'}
            dim={!session?.breakMinutes}
          />
          <SummaryStrip
            label="Net Hours"
            value={netMinutes > 0 ? formatMinutes(netMinutes) : '—'}
            highlight={netMinutes >= 480}
            dim={netMinutes === 0}
          />
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

/* ── Sub-components ──────────────────────────────────────────────────────── */

function StatusPill({ status, isLoading }: { status: string; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full">
        <span className="w-2 h-2 rounded-full bg-gray-400" />
        <span className="text-gray-300 text-xs font-medium">Loading…</span>
      </div>
    );
  }

  const config = {
    CLOCKED_IN: { label: 'Clocked In', dot: 'bg-green-400', text: 'text-green-300', pulse: true },
    ON_BREAK: { label: 'On Break', dot: 'bg-yellow-400', text: 'text-yellow-300', pulse: false },
    CLOCKED_OUT: { label: 'Clocked Out', dot: 'bg-gray-400', text: 'text-gray-300', pulse: false },
  }[status] ?? { label: 'Clocked Out', dot: 'bg-gray-400', text: 'text-gray-300', pulse: false };

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full">
      <span className={cn('w-2 h-2 rounded-full', config.dot, config.pulse && 'animate-pulse')} />
      <span className={cn('text-xs font-medium', config.text)}>{config.label}</span>
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  icon,
  label,
  className,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  className: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 px-4 py-2 text-white text-sm rounded-input transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
        className,
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SummaryStrip({
  label,
  value,
  highlight = false,
  dim = false,
  muted = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  dim?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="px-4 py-2.5 flex flex-col gap-0.5 border-r border-white/10 last:border-r-0">
      <p className="text-blue-300/70 text-[10px] font-medium uppercase tracking-wide">{label}</p>
      <p
        className={cn(
          'text-sm font-semibold tabular-nums',
          highlight
            ? 'text-green-300'
            : muted
              ? 'text-blue-200'
              : dim
                ? 'text-white/30'
                : 'text-white',
        )}
      >
        {value}
      </p>
    </div>
  );
}
