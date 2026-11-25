'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { TypeChip } from '@/components/atoms/TypeChip';
import { useProject, useProjectSetup } from '@/hooks';
import { useProjectTimeValue } from '@/hooks/hr/useProjectTimeValue';
import { plannedWork } from '@/lib/projectComparison';
import { formatMoney } from '@/lib/projectPricing';
import { formatHoursMinutes } from '@/lib/taskTime';
import { cn } from '@/lib/utils';

const HOUR = 3_600_000;

/** One line of the comparison: the actual figure against the planned one, and the gap. */
function Measure({
  label,
  actual,
  planned,
  note,
  bad,
  percent,
}: {
  label: string;
  actual: string;
  planned?: string;
  note?: string;
  bad?: boolean;
  /** How much of the plan is used up; draws a bar when there is a plan to measure against. */
  percent?: number;
}) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)_auto] items-center gap-x-4 py-2 text-sm sm:grid-cols-[8rem_16rem_minmax(0,1fr)_9rem]">
      <span className="text-gray-500">{label}</span>
      <span className="truncate tabular-nums">
        <span className="font-semibold text-gray-900">{actual}</span>
        {planned && <span className="text-gray-400"> of {planned}</span>}
      </span>
      <div className="hidden sm:block">
        {percent !== undefined && (
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className={cn('h-full rounded-full', bad ? 'bg-red-500' : 'bg-brand')}
              style={{ width: `${Math.min(100, percent)}%` }}
            />
          </div>
        )}
      </div>
      <span className={cn('text-right text-xs', bad ? 'text-red-600' : 'text-gray-400')}>
        {note}
      </span>
    </div>
  );
}

/**
 * For a project not billed by time: what is being charged against what the time spent is worth at each
 * person's rate, and the hours against the estimate. None of it changes an invoice.
 */
export function ProjectPriceVsTime({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId);
  const pricing = useProjectSetup(projectId)?.pricing;
  const { totalMs, rows, value, unrated } = useProjectTimeValue(projectId);
  const [showPeople, setShowPeople] = useState(false);
  const planned =
    pricing &&
    plannedWork(pricing, project?.startDate?.slice(0, 10), project?.endDate?.slice(0, 10));
  if (!planned) return null;

  const { amount, hours, basis } = planned;
  const difference = value - amount;
  const percent = amount > 0 ? Math.round((value / amount) * 100) : undefined;
  const overMs = hours ? totalMs - hours * HOUR : 0;
  const plannedRate = hours && amount > 0 ? amount / hours : undefined;
  // Under an hour logged says nothing about the rate the price works out to.
  const actualRate = totalMs >= HOUR && amount > 0 ? amount / (totalMs / HOUR) : undefined;
  const rateGap =
    plannedRate !== undefined && actualRate !== undefined ? actualRate - plannedRate : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Price vs time</h2>
          {percent !== undefined && (
            <TypeChip
              label={`${difference > 0 ? 'Over' : 'Under'} by ${formatMoney(Math.abs(difference))}`}
              color={difference > 0 ? 'red' : 'green'}
            />
          )}
        </div>
        {rows.length > 0 && (
          <Button size="xs" variant="outline" onClick={() => setShowPeople((open) => !open)}>
            {showPeople ? 'Hide people' : 'By person'}
          </Button>
        )}
      </div>

      <div className="flex flex-col divide-y divide-gray-100">
        <Measure
          label="Hours"
          actual={formatHoursMinutes(totalMs)}
          planned={hours ? `${hours} h` : undefined}
          percent={hours ? (totalMs / (hours * HOUR)) * 100 : undefined}
          note={
            hours
              ? `${formatHoursMinutes(Math.abs(overMs))} ${overMs > 0 ? 'over' : 'left'}`
              : 'no estimate'
          }
          bad={overMs > 0}
        />
        <Measure
          label="Value of time"
          actual={formatMoney(value)}
          planned={amount > 0 ? formatMoney(amount) : undefined}
          percent={percent}
          note={percent !== undefined ? `${percent}% of ${basis}` : undefined}
          bad={difference > 0}
        />
        <Measure
          label="Earned per hour"
          actual={actualRate === undefined ? '—' : formatMoney(actualRate)}
          planned={plannedRate === undefined ? undefined : `${formatMoney(plannedRate)} planned`}
          note={
            rateGap === undefined
              ? undefined
              : `${formatMoney(Math.abs(rateGap))} ${rateGap < 0 ? 'less' : 'more'}`
          }
          bad={(rateGap ?? 0) < 0}
        />
      </div>

      {showPeople && (
        <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-lg bg-gray-50 px-4 py-3">
          {rows.map((r) => (
            <li key={r.personId} className="flex items-center gap-4 text-sm">
              <span className="min-w-0 flex-1 truncate text-gray-900">{r.personName}</span>
              <span className="tabular-nums text-gray-500">{formatHoursMinutes(r.ms)}</span>
              <span
                className={cn(
                  'w-28 text-right tabular-nums',
                  r.rate > 0 ? 'text-gray-900' : 'text-amber-600',
                )}
              >
                {r.rate > 0 ? formatMoney(r.value) : 'No rate'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {unrated.length > 0 && (
        <p className="text-xs text-amber-600">
          No rate set for {unrated.join(', ')}, so their time isn’t in the value.
        </p>
      )}
      {/* <p className="text-xs text-gray-400">
        Time-tracked tasks only, at current rates. It never changes an invoice.
      </p> */}
    </div>
  );
}
