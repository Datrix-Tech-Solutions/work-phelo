'use client';

import { CalendarOff, ClipboardCheck, UserPlus, Users } from 'lucide-react';
import type { Period } from '@/components/atoms/PeriodToggle';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { useHrDashboardKpis } from '@/hooks/hr/useDashboard';
import { dashboardRanges, formatDay, trendBetween } from '@/lib/dashboardPeriod';

const PERIOD_LABELS: Record<Period, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
  yearly: 'year',
};

const MODULE_COLOR = 'var(--module-hr, #0047ab)';

const pct = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `${value.toFixed(1)}%`;

const orUndefined = (value: number | null | undefined) => value ?? undefined;

interface HrDashboardKpisProps {
  period: Period;
  year: number;
}

export function HrDashboardKpis({ period, year }: HrDashboardKpisProps) {
  const { data, isLoading } = useHrDashboardKpis(period, year);
  const periodLabel = PERIOD_LABELS[period];

  // What each badge was calculated against, so its percentage can be checked by hand.
  const { prevFromDate, prevToDate } = dashboardRanges(period, year);
  const previousFrom = `Previous (${formatDay(prevFromDate)} – ${formatDay(prevToDate)}): `;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        label="Headcount"
        value={data?.headcount.current ?? '—'}
        icon={Users}
        iconColor={MODULE_COLOR}
        sub={
          data
            ? [
                { label: 'Probation', value: data.headcount.onProbation },
                { label: 'Suspended', value: data.headcount.suspended },
              ]
            : undefined
        }
        trend={trendBetween(data?.headcount.current, data?.headcount.previous)}
        trendTooltip={`${previousFrom}${data?.headcount.previous ?? '—'}`}
        periodLabel={periodLabel}
        isLoading={isLoading}
      />
      <KpiCard
        label="Attendance"
        value={pct(data?.attendance.rate)}
        icon={ClipboardCheck}
        iconColor="#1baf7a"
        sub={
          data
            ? [
                { label: 'Late', value: data.attendance.late },
                { label: 'Absent', value: data.attendance.absent },
              ]
            : undefined
        }
        trend={trendBetween(
          orUndefined(data?.attendance.rate),
          orUndefined(data?.attendance.previousRate),
        )}
        trendTooltip={`${previousFrom}${pct(data?.attendance.previousRate)}`}
        periodLabel={periodLabel}
        isLoading={isLoading}
      />
      <KpiCard
        label="On Leave"
        value={data?.onLeave.current ?? '—'}
        icon={CalendarOff}
        iconColor="#f59e0b"
        sub={
          data
            ? [
                { label: 'Today', value: data.onLeave.today },
                { label: 'Pending', value: data.onLeave.pending },
              ]
            : undefined
        }
        trend={trendBetween(data?.onLeave.current, data?.onLeave.previous)}
        trendTooltip={`${previousFrom}${data?.onLeave.previous ?? '—'}`}
        periodLabel={periodLabel}
        isLoading={isLoading}
      />
      <KpiCard
        label="Hires & Exits"
        value={data ? `${data.hiresAndExits.hires} / ${data.hiresAndExits.exits}` : '—'}
        icon={UserPlus}
        iconColor="#8b5cf6"
        sub={
          data ? [{ label: 'Turnover', value: pct(data.hiresAndExits.turnoverRate) }] : undefined
        }
        trend={trendBetween(data?.hiresAndExits.hires, data?.hiresAndExits.previousHires)}
        trendTooltip={`${previousFrom}${data?.hiresAndExits.previousHires ?? '—'} hires / ${data?.hiresAndExits.previousExits ?? '—'} exits`}
        periodLabel={periodLabel}
        isLoading={isLoading}
      />
    </div>
  );
}
