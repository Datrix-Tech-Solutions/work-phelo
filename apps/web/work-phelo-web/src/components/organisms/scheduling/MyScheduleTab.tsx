'use client';

import { useState, useMemo } from 'react';
import { WeekDayCard, DayShift, DayShiftType } from '@/components/molecules/scheduling/WeekDayCard';
import {
  WeekSelector,
  getSundayOf,
  addDays,
  toISODate,
} from '@/components/molecules/scheduling/WeekSelector';
import { SwapRequestCard, SwapRequest } from '@/components/molecules/scheduling/SwapRequestCard';
import { SwapShiftPanel } from '@/components/organisms/scheduling/SwapShiftPanel';
import {
  useMyScheduleOverview,
  useMyShiftSwaps,
  useRespondToShiftSwap,
  useCancelShiftSwap,
} from '@/hooks/useScheduling';
import { ShiftSwapRequest, ShiftSwapStatus } from '@/types/scheduling';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Button } from '@/components/atoms/Button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';

const WEEKDAYS = [
  { label: 'SUN', isoDay: 1 },
  { label: 'MON', isoDay: 2 },
  { label: 'TUE', isoDay: 3 },
  { label: 'WED', isoDay: 4 },
  { label: 'THU', isoDay: 5 },
  { label: 'FRI', isoDay: 6 },
  { label: 'SAT', isoDay: 7 },
];

const STATUS_BADGE: Record<ShiftSwapStatus, { label: string; className: string }> = {
  PENDING_COLLEAGUE: { label: 'Pending Colleague', className: 'bg-amber-100 text-amber-700' },
  PENDING_MANAGER: { label: 'Pending Approval', className: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  DECLINED: { label: 'Declined', className: 'bg-red-100 text-red-600' },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-600' },
  EXPIRED: { label: 'Expired', className: 'bg-gray-100 text-gray-500' },
  CANCELLED: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' },
};

const CANCELLABLE: ShiftSwapStatus[] = ['PENDING_COLLEAGUE', 'PENDING_MANAGER'];

function toCardRequest(r: ShiftSwapRequest): SwapRequest {
  return {
    id: r.id,
    requester: {
      name: r.requesterEmployee
        ? `${r.requesterEmployee.firstName} ${r.requesterEmployee.lastName}`
        : 'Unknown',
    },
    requesterShift: {
      date: r.requesterShiftDate.slice(0, 10),
      startTime: r.requesterSchedule?.startTime ?? '',
      endTime: r.requesterSchedule?.endTime ?? '',
    },
    target: {
      name: r.targetEmployee
        ? `${r.targetEmployee.firstName} ${r.targetEmployee.lastName}`
        : 'Unknown',
    },
    targetShift: {
      date: r.targetShiftDate.slice(0, 10),
      startTime: r.targetSchedule?.startTime ?? '',
      endTime: r.targetSchedule?.endTime ?? '',
    },
    reason: r.reason ?? '',
    status: 'PENDING',
  };
}

function SwapRequestItem({
  request,
  currentEmployeeId,
  onRespond,
  onCancel,
  respondingId,
  cancellingId,
}: {
  request: ShiftSwapRequest;
  currentEmployeeId: string | undefined;
  onRespond: (id: string, action: 'ACCEPT' | 'DECLINE') => void;
  onCancel: (id: string) => void;
  respondingId: { id: string; action: 'ACCEPT' | 'DECLINE' } | null;
  cancellingId: string | null;
}) {
  const isTarget = request.targetEmployeeId === currentEmployeeId;
  const cardData = toCardRequest(request);
  const badge = STATUS_BADGE[request.status];

  let footer: React.ReactNode;

  if (isTarget) {
    if (request.status === 'PENDING_COLLEAGUE') {
      /* Target employee — awaiting their response */
      footer = (
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRespond(request.id, 'DECLINE')}
            isLoading={respondingId?.id === request.id && respondingId.action === 'DECLINE'}
            loadingText="Declining..."
            disabled={respondingId?.id === request.id && respondingId.action === 'ACCEPT'}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-[#0d1b3e] hover:bg-[#0d1b3e]/90 focus:ring-[#0d1b3e]"
            onClick={() => onRespond(request.id, 'ACCEPT')}
            isLoading={respondingId?.id === request.id && respondingId.action === 'ACCEPT'}
            loadingText="Approving..."
            disabled={respondingId?.id === request.id && respondingId.action === 'DECLINE'}
          >
            Approve
          </Button>
        </div>
      );
    } else {
      /* Target already responded — show status badge only */
      footer = badge ? (
        <div className="flex justify-end">
          <span className={cn('text-xs font-semibold px-3 py-1 rounded-full', badge.className)}>
            {badge.label}
          </span>
        </div>
      ) : null;
    }
  } else {
    /* Requester — status badge + cancel while still cancellable */
    const canCancel = CANCELLABLE.includes(request.status);
    footer = (
      <div className="flex items-center justify-between gap-3">
        {badge && (
          <span className={cn('text-xs font-semibold px-3 py-1 rounded-full', badge.className)}>
            {badge.label}
          </span>
        )}
        {canCancel && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCancel(request.id)}
            isLoading={cancellingId === request.id}
            loadingText="Cancelling..."
          >
            Cancel Request
          </Button>
        )}
      </div>
    );
  }

  return <SwapRequestCard request={cardData} footer={footer} />;
}

export function MyScheduleTab() {
  const toast = useToast();

  const [weekStart, setWeekStart] = useState<Date>(() => getSundayOf(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [swapPanelOpen, setSwapPanelOpen] = useState(false);
  const [swapShift, setSwapShift] = useState<DayShift | null>(null);
  const [swapDate, setSwapDate] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<{
    id: string;
    action: 'ACCEPT' | 'DECLINE';
  } | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d, 7));
  const today = toISODate(new Date());

  const weekFrom = toISODate(weekStart);
  const weekTo = toISODate(addDays(weekStart, 6));

  const { data: overview, isLoading } = useMyScheduleOverview({ from: weekFrom, to: weekTo });

  const { data: swapRequests = [] } = useMyShiftSwaps();

  /* Derive current employee ID from schedules (more reliable than userId on swap summaries) */
  const currentEmployeeId = overview?.schedules[0]?.employeeId;
  const { mutate: respondToSwap } = useRespondToShiftSwap();
  const { mutate: cancelSwap } = useCancelShiftSwap();

  const handleRespond = (id: string, action: 'ACCEPT' | 'DECLINE') => {
    setRespondingId({ id, action });
    respondToSwap(
      { shiftSwapId: id, payload: { action } },
      {
        onSuccess: () => toast.success(action === 'ACCEPT' ? 'Swap accepted' : 'Swap declined'),
        onSettled: () => setRespondingId(null),
      },
    );
  };

  const handleCancel = (id: string) => {
    setCancellingId(id);
    cancelSwap(id, {
      onSuccess: () => toast.success('Swap request cancelled'),
      onSettled: () => setCancellingId(null),
    });
  };

  const requestsForDay = useMemo(
    () =>
      selectedDate
        ? swapRequests.filter(
            (r) =>
              r.requesterShiftDate.slice(0, 10) === selectedDate ||
              r.targetShiftDate.slice(0, 10) === selectedDate,
          )
        : [],
    [swapRequests, selectedDate],
  );

  /* Build a date → DayShift[] map for the current week, then apply swap overrides */
  const shiftsForWeek = useMemo(() => {
    const schedules = overview?.schedules ?? [];
    const assignmentOverrides = overview?.assignmentOverrides ?? [];
    const shiftSwaps = overview?.shiftSwaps ?? [];
    const map: Record<string, DayShift[]> = {};

    for (const s of schedules) {
      for (const { isoDay } of WEEKDAYS) {
        const dayDate = addDays(weekStart, isoDay - 1);
        const date = toISODate(dayDate);
        const dow = dayDate.getDay();
        const from = s.effectiveFrom.slice(0, 10);
        const to = s.effectiveTo?.slice(0, 10) ?? null;

        if (s.dayOfWeek.includes(dow) && from <= date && (to === null || to >= date)) {
          if (!map[date]) map[date] = [];
          map[date].push({
            scheduleId: s.id,
            type: s.shiftType.toLowerCase() as DayShiftType,
            workMode: s.workMode,
            startTime: s.startTime,
            endTime: s.endTime,
          });
        }
      }
    }

    /* Remove dates the employee gave away in approved swaps.
       REQUESTER gave away requesterShiftDate; COLLEAGUE gave away targetShiftDate. */
    for (const swap of shiftSwaps) {
      if (swap.status !== 'APPROVED') continue;
      const givenAwayDate =
        swap.role === 'REQUESTER'
          ? swap.requesterShiftDate.slice(0, 10)
          : swap.targetShiftDate.slice(0, 10);
      delete map[givenAwayDate];
    }

    /* Add the new shifts received from approved swaps */
    for (const o of assignmentOverrides) {
      const date = o.shiftDate.slice(0, 10);
      if (!map[date]) map[date] = [];
      map[date].push({
        scheduleId: o.scheduleId,
        type: o.shiftType.toLowerCase() as DayShiftType,
        workMode: o.workMode,
        startTime: o.startTime,
        endTime: o.endTime,
      });
    }

    return map;
  }, [overview, weekStart]);

  const handleCardClick = (isoDate: string) => {
    setSelectedDate((prev) => (prev === isoDate ? null : isoDate));
  };

  return (
    <div className="flex-1 flex flex-col gap-6">
      {/* ── Week navigator ── */}
      <div className="flex items-center justify-between shrink-0">
        <p className="text-xs text-gray-400">Your schedule for this week</p>
        <WeekSelector weekStart={weekStart} onPrev={prevWeek} onNext={nextWeek} endOffset={6} />
      </div>

      {/* ── Day cards ── */}
      {isLoading ? (
        <div className="grid grid-cols-7 gap-4">
          {WEEKDAYS.map(({ label }) => (
            <div
              key={label}
              className="flex flex-col rounded-2xl overflow-hidden border-2 border-gray-200"
            >
              {/* Header skeleton */}
              <div className="bg-gray-100 px-4 py-3 flex flex-col items-center gap-2">
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              {/* Body skeleton */}
              <div className="flex flex-col flex-1 p-4 min-h-36 bg-white gap-2.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-24" />
                <div className="flex-1" />
                <Skeleton className="h-8 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-4">
          {WEEKDAYS.map(({ label, isoDay }) => {
            const dayDate = addDays(weekStart, isoDay - 1);
            const isoDate = toISODate(dayDate);

            return (
              <WeekDayCard
                key={label}
                day={label}
                date={dayDate.getDate()}
                isToday={isoDate === today}
                shifts={shiftsForWeek[isoDate] ?? []}
                isSelected={selectedDate === isoDate}
                onClick={() => handleCardClick(isoDate)}
                onSwapShift={(shift) => {
                  setSwapShift(shift);
                  setSwapDate(isoDate);
                  setSwapPanelOpen(true);
                }}
              />
            );
          })}
        </div>
      )}

      {/* ── Swap requests for selected day ── */}
      {selectedDate && requestsForDay.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Swap Requests
          </p>
          {requestsForDay.map((req) => (
            <SwapRequestItem
              key={req.id}
              request={req}
              currentEmployeeId={currentEmployeeId}
              onRespond={handleRespond}
              onCancel={handleCancel}
              respondingId={respondingId}
              cancellingId={cancellingId}
            />
          ))}
        </div>
      )}

      <SwapShiftPanel
        isOpen={swapPanelOpen}
        onClose={() => setSwapPanelOpen(false)}
        shift={swapShift}
        date={swapDate}
      />
    </div>
  );
}
