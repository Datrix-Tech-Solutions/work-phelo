'use client';

import {
  Archive,
  ArrowRightLeft,
  Award,
  BadgeCheck,
  Banknote,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  ClipboardCheck,
  ClipboardList,
  ClockAlert,
  FileUser,
  FolderPlus,
  ListChecks,
  LogOut,
  RefreshCw,
  Send,
  Target,
  Undo2,
  UserMinus,
  UserPlus,
  UserX,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useRecentActivity } from '@/hooks/hr/useEmployeeDashboard';
import { waterIconStyle } from '@/lib/utils';
import type { RecentActivityEvent, RecentActivityType } from '@/types/hr';

interface EventStyle {
  icon: LucideIcon;
  color: string;
  title: (event: RecentActivityEvent) => string;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  PROBATION: 'Probation',
  SUSPENDED: 'Suspended',
  OFFBOARDED: 'Offboarded',
};

const EVENT_STYLES: Record<RecentActivityType, EventStyle> = {
  HIRED: { icon: UserPlus, color: '#1baf7a', title: () => 'was added as a new hire' },
  STATUS_CHANGED: {
    icon: RefreshCw,
    color: '#2a78d6',
    title: (e) =>
      `status changed to ${STATUS_LABELS[e.detail ?? ''] ?? e.detail ?? 'a new status'}`,
  },
  OFFBOARDED: { icon: LogOut, color: '#e34948', title: () => 'was offboarded' },
  OFFBOARDING_INITIATED: {
    icon: UserMinus,
    color: '#eb6834',
    title: () => 'offboarding was initiated',
  },
  RESIGNATION_SUBMITTED: {
    icon: UserX,
    color: '#eda100',
    title: () => 'submitted a resignation',
  },
  RESIGNATION_WITHDRAWN: {
    icon: Undo2,
    color: '#9ca3af',
    title: () => 'withdrew their resignation',
  },
  RESIGNATION_DISMISSED: {
    icon: Undo2,
    color: '#9ca3af',
    title: () => 'resignation was dismissed',
  },
  LEAVE_APPROVED: { icon: CalendarCheck, color: '#1baf7a', title: () => 'leave was approved' },
  LEAVE_REJECTED: { icon: CalendarX, color: '#e34948', title: () => 'leave was rejected' },
  TIME_CORRECTION_APPROVED: {
    icon: ClockAlert,
    color: '#1baf7a',
    title: () => 'time correction was approved',
  },
  TIME_CORRECTION_REJECTED: {
    icon: ClockAlert,
    color: '#e34948',
    title: () => 'time correction was rejected',
  },
  PAYROLL_CREATED: { icon: Banknote, color: '#2a78d6', title: () => 'was created' },
  PAYROLL_SUBMITTED: { icon: Send, color: '#eda100', title: () => 'was submitted for approval' },
  PAYROLL_APPROVED: { icon: BadgeCheck, color: '#1baf7a', title: () => 'was approved' },
  PAYROLL_PAID: { icon: Wallet, color: '#1baf7a', title: () => 'was paid' },
  APPRAISAL_CYCLE_STARTED: {
    icon: Target,
    color: '#2a78d6',
    title: () => 'appraisal cycle started',
  },
  APPRAISAL_CYCLE_CLOSED: { icon: Target, color: '#9ca3af', title: () => 'appraisal cycle closed' },
  APPRAISAL_CYCLE_CANCELLED: {
    icon: Target,
    color: '#e34948',
    title: () => 'appraisal cycle was cancelled',
  },
  SELF_ASSESSMENT_SUBMITTED: {
    icon: ClipboardList,
    color: '#eda100',
    title: () => 'submitted a self-assessment',
  },
  MANAGER_REVIEW_SUBMITTED: {
    icon: ClipboardCheck,
    color: '#2a78d6',
    title: () => 'received a manager review',
  },
  APPRAISAL_FINALIZED: { icon: Award, color: '#1baf7a', title: () => 'appraisal was finalized' },
  VACANCY_CREATED: { icon: Briefcase, color: '#2a78d6', title: () => 'job opening was created' },
  VACANCY_CLOSED: { icon: Briefcase, color: '#9ca3af', title: () => 'job opening was closed' },
  APPLICATION_RECEIVED: { icon: FileUser, color: '#1baf7a', title: () => 'applied for a job' },
  CANDIDATE_MOVED: { icon: ArrowRightLeft, color: '#2a78d6', title: () => 'moved to a new stage' },
  INTERVIEW_SCHEDULED: {
    icon: CalendarClock,
    color: '#eda100',
    title: () => 'was scheduled for an interview',
  },
  PROJECT_CREATED: { icon: FolderPlus, color: '#2a78d6', title: () => 'project was created' },
  PROJECT_ARCHIVED: { icon: Archive, color: '#9ca3af', title: () => 'project was archived' },
  PROJECT_MEMBER_ADDED: { icon: UserPlus, color: '#1baf7a', title: () => 'gained a member' },
  PROJECT_MEMBER_REMOVED: { icon: UserMinus, color: '#e34948', title: () => 'lost a member' },
  PROJECT_TASK_MOVED: { icon: ListChecks, color: '#2a78d6', title: () => 'task progress changed' },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** The latest HR events: hires, status changes, offboarding, resignations, leave and
 * time-correction decisions, and payroll, appraisal, recruitment and project events. A live
 * feed, so it ignores the period filter. Fills its parent. */
export function RecentActivityList() {
  const { data, isLoading, isError } = useRecentActivity();
  // An event type this card has no style for (or an older backend) is skipped, not fatal.
  const events = (data?.activity ?? []).filter((event) => event.type in EVENT_STYLES);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-full items-center justify-center text-sm text-gray-400">
          Recent activity could not be loaded.
        </div>
      ) : events.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-gray-400">
          No activity yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => {
            const style = EVENT_STYLES[event.type];
            const Icon = style.icon;
            // Hires carry the job title and leave carries type and days; status and
            // decisions already say it in the title.
            const detail = event.type === 'STATUS_CHANGED' ? null : event.detail;
            return (
              <li key={event.id} className="flex items-start gap-2.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={waterIconStyle(style.color)}
                >
                  <Icon
                    className="w-3.5 h-3.5"
                    style={{ color: `color-mix(in oklab, ${style.color} 65%, black)` }}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="text-xs text-gray-700">
                    <span className="font-semibold text-gray-900">{event.subject}</span>{' '}
                    {style.title(event)}
                  </span>
                  <span className="truncate text-[10px] text-gray-400">
                    {[detail, event.actor && `by ${event.actor}`].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <span className="shrink-0 text-[10px] text-gray-400">
                  {timeAgo(event.timestamp)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
