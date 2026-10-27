'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { TypeChip } from '@/components/atoms/TypeChip';
import { sprintState } from '@/lib/projectSprints';
import { cardClass, cn, todayLocal } from '@/lib/utils';
import { useProjectSprints } from '@/hooks/hr/useProjectWork';
import type { ProjectSprint } from '@/types/hr';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** A sprint bar is coloured by where the sprint is: running now, still to come, or over. */
const BAR_STYLE: Record<string, string> = {
  Active: 'bg-green-100 text-green-800 border-green-300',
  Upcoming: 'bg-blue-100 text-blue-800 border-blue-300',
  Ended: 'bg-gray-100 text-gray-600 border-gray-300',
  Completed: 'bg-gray-100 text-gray-600 border-gray-300',
};

const LANE_HEIGHT = 22;
const DAY_NUMBER_HEIGHT = 28;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Whole days from one YYYY-MM-DD to another, ignoring time zones and daylight saving. */
function daysBetween(a: string, b: string) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface Segment {
  sprint: ProjectSprint;
  /** 0-6, Monday to Sunday, within this week. */
  startCol: number;
  endCol: number;
  /** The sprint begins / finishes in this week, so that end of the bar is rounded and labelled. */
  startsHere: boolean;
  endsHere: boolean;
  lane: number;
}

/** The weeks of a month as rows of seven days, Monday first, padded with the neighbouring months' days. */
function monthWeeks(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekCount = Math.ceil((offset + daysInMonth) / 7);
  return Array.from({ length: weekCount }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => new Date(year, month, 1 - offset + w * 7 + d)),
  );
}

/** The bars for one week: each sprint touching it, stacked into lanes so they never overlap. */
function weekSegments(week: Date[], sprints: ProjectSprint[]): Segment[] {
  const weekStart = iso(week[0]);
  const weekEnd = iso(week[6]);
  const segments = sprints
    .filter((sp) => sp.startDate <= weekEnd && sp.endDate >= weekStart)
    .map((sprint) => {
      const from = sprint.startDate < weekStart ? weekStart : sprint.startDate;
      const to = sprint.endDate > weekEnd ? weekEnd : sprint.endDate;
      return {
        sprint,
        startCol: daysBetween(weekStart, from),
        endCol: daysBetween(weekStart, to),
        startsHere: sprint.startDate >= weekStart,
        endsHere: sprint.endDate <= weekEnd,
        lane: 0,
      };
    })
    .sort((a, b) => a.startCol - b.startCol || b.endCol - a.endCol);

  const laneEnds: number[] = [];
  for (const seg of segments) {
    let lane = laneEnds.findIndex((end) => end < seg.startCol);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = seg.endCol;
    seg.lane = lane;
  }
  return segments;
}

interface Props {
  projectId: string;
}

/** A month calendar of the project's sprints: each one a bar running from its start date to its end date. */
export function ProjectCalendar({ projectId }: Props) {
  const today = todayLocal();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const { data: allSprints = [] } = useProjectSprints(projectId);
  const sprints = useMemo(
    () => [...allSprints].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [allSprints],
  );

  const weeks = useMemo(() => monthWeeks(cursor.year, cursor.month), [cursor]);
  const monthName = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  const step = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  const goToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-gray-900 min-w-44">{monthName}</h2>
        <Button variant="outline" size="sm" onClick={() => step(-1)} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => step(1)} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToday}>
          Today
        </Button>
      </div>

      <div className={cardClass('overflow-hidden')}>
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/60">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-gray-400"
            >
              {day}
            </div>
          ))}
        </div>

        {weeks.map((week, w) => {
          const segments = weekSegments(week, sprints);
          const lanes = segments.reduce((max, seg) => Math.max(max, seg.lane + 1), 0);
          const height = Math.max(88, DAY_NUMBER_HEIGHT + lanes * LANE_HEIGHT + 10);
          return (
            <div
              key={w}
              className="relative border-b border-gray-100 last:border-b-0"
              style={{ height }}
            >
              {/* The days: a grid of cells with their date numbers. */}
              <div className="absolute inset-0 grid grid-cols-7">
                {week.map((day) => {
                  const dayIso = iso(day);
                  const inMonth = day.getMonth() === cursor.month;
                  return (
                    <div key={dayIso} className="border-r border-gray-100 last:border-r-0 p-1.5">
                      <span
                        className={cn(
                          'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs',
                          inMonth ? 'text-gray-700' : 'text-gray-300',
                          dayIso === today && 'bg-brand font-semibold text-white',
                        )}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* The sprints: bars laid over the days, running from the start to the end date. */}
              <div
                className="absolute inset-x-0 grid grid-cols-7 content-start gap-y-0.5"
                style={{ top: DAY_NUMBER_HEIGHT, gridAutoRows: LANE_HEIGHT - 2 }}
              >
                {segments.map((seg) => {
                  const state = sprintState(seg.sprint, today);
                  return (
                    <div
                      key={`${seg.sprint.id}-${w}`}
                      title={`${seg.sprint.name}: ${formatDate(seg.sprint.startDate)} – ${formatDate(seg.sprint.endDate)} (${state.label})`}
                      className={cn(
                        'flex items-center overflow-hidden border-y px-2 text-xs font-medium',
                        BAR_STYLE[state.label],
                        seg.startsHere && 'ml-1 rounded-l-md border-l',
                        seg.endsHere && 'mr-1 rounded-r-md border-r',
                      )}
                      style={{
                        gridColumn: `${seg.startCol + 1} / ${seg.endCol + 2}`,
                        gridRow: seg.lane + 1,
                      }}
                    >
                      <span className="truncate">{seg.sprint.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {sprints.length === 0 ? (
        <p className="text-sm text-gray-400">
          No sprints yet. Create one in the Backlog and it will appear here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sprints.map((sprint) => {
            const state = sprintState(sprint, today);
            return (
              <li
                key={sprint.id}
                className={cardClass('flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5')}
              >
                <span className="text-sm font-semibold text-gray-900">{sprint.name}</span>
                <span className="text-sm text-gray-500">
                  Starts{' '}
                  <span className="font-medium text-gray-800">{formatDate(sprint.startDate)}</span>
                </span>
                <span className="text-sm text-gray-500">
                  Ends{' '}
                  <span className="font-medium text-gray-800">{formatDate(sprint.endDate)}</span>
                </span>
                <TypeChip label={state.label} color={state.color} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
