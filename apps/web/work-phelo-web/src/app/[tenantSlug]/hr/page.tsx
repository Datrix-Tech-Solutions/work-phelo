// EMPLOYEE DASHBOARD //

'use client';

import { use, useMemo, useState, useRef } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useUpcomingBirthdays, useEmployeeDashboard } from '@/hooks';
import { useMyProfile } from '@/hooks';
import { useLeaveBalances, useMyLeaveRequests } from '@/hooks/useLeave';
import { useMyPayslips } from '@/hooks/usePayroll';
import { usePublicHolidays } from '@/hooks/usePublicHolidays';
import { useClockIn, useClockOut } from '@/hooks/useTimeClock';
import { ApplyLeavePanel } from '@/components/organisms/leave/ApplyLeavePanel';
import { DashboardWelcomeBanner } from '@/components/molecules/dashboard/DashboardWelcomeBanner';
import { QuickActionsCard } from '@/components/molecules/dashboard/QuickActionsCard';
import { UpcomingHolidaysCard } from '@/components/molecules/dashboard/UpcomingHolidaysCard';
import { AnnouncementCard } from '@/components/molecules/dashboard/announcmentCard';
import { BirthdaysCard } from '@/components/molecules/dashboard/birthdayCard';
import { DashboardStatCards } from '@/components/organisms/dashboard/DashboardStatCards';
import { MyLeavePanel } from '@/components/organisms/dashboard/MyLeavePanel';
import { MyPayslipsPanel } from '@/components/organisms/dashboard/MyPayslipsPanel';
import { MyAssetsPanel } from '@/components/organisms/dashboard/MyAssetsPanel';
import { DashboardSkeleton } from '@/components/molecules/dashboard/DashboardSkeleton';
import { formatTime, resolveHolidayUpcomingDate } from '@/lib/formatters';

/* ── Avatar colour picker ── */
const AVATAR_COLORS = [
  '#0D2244',
  '#1E3A8A',
  '#6D28D9',
  '#B45309',
  '#047857',
  '#0369A1',
  '#9D174D',
  '#374151',
];
function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function EmployeeDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);

  /* ── Identity ── */
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);
  const fullName = !authLoading
    ? [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Employee'
    : '';
  const tenantName = user?.tenantName ?? 'Your Company';

  /* ── Remote data ── */
  const { data: myProfile } = useMyProfile();
  const department = myProfile?.department?.name;
  const branch = myProfile?.branch?.name;

  const { data: dashboard, isLoading: isDashboardLoading } = useEmployeeDashboard();
  const { data: balancesRaw } = useLeaveBalances();
  const { data: myLeaveRaw } = useMyLeaveRequests();
  const { data: myPayslipsRaw } = useMyPayslips();
  const { data: holidaysRaw } = usePublicHolidays();
  const { data: birthdaysRaw } = useUpcomingBirthdays();

  /* ── Derived: leave balances ── */
  const leaveBalances = Array.isArray(balancesRaw) ? balancesRaw : [];
  const annualBalance =
    leaveBalances.find((b: { leaveTypeName?: string }) =>
      b.leaveTypeName?.toLowerCase().includes('annual'),
    ) ?? null;

  /* ── Derived: my leave requests ── */
  const myLeave = useMemo(() => (Array.isArray(myLeaveRaw) ? myLeaveRaw : []), [myLeaveRaw]);

  /* ── Derived: upcoming leave ── */
  const today = new Date().toISOString().slice(0, 10);
  const nextLeave =
    myLeave
      .filter((r) => (r.status === 'APPROVED' || r.status === 'PENDING') && r.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null;
  const upcomingLeave = nextLeave
    ? {
        leaveType: nextLeave.leaveTypeName,
        startDate: nextLeave.startDate,
        endDate: nextLeave.endDate,
        status: nextLeave.status,
      }
    : null;

  /* ── Derived: my payslips ── */
  const myPayslips = Array.isArray(myPayslipsRaw) ? myPayslipsRaw : [];

  /* ── Derived: announcements ── */
  const announcements = (dashboard?.announcements ?? []).map(
    (a: { id: string; title: string; publishedAt: string; body?: string; preview?: string }) => ({
      id: a.id,
      title: a.title,
      date: new Date(a.publishedAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      body: a.body ?? a.preview ?? '',
    }),
  );

  /* ── Derived: upcoming holidays (future only, first 5) ── */
  const now = new Date();
  const holidays = (Array.isArray(holidaysRaw) ? holidaysRaw : [])
    .filter((h: { date: string }) => resolveHolidayUpcomingDate(h.date) >= now)
    .sort(
      (a: { date: string }, b: { date: string }) =>
        resolveHolidayUpcomingDate(a.date).getTime() - resolveHolidayUpcomingDate(b.date).getTime(),
    )
    .slice(0, 5);

  /* ── Derived: birthdays ── */
  const rawBirthdays = birthdaysRaw?.birthdays ?? [];
  const birthdays = (Array.isArray(rawBirthdays) ? rawBirthdays : []).map((b) => {
    const name = b.name;
    const initials = name
      .split(' ')
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
    return {
      id: b.id,
      name,
      date: new Date(b.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }),
      initials,
      color: avatarColor(name),
    };
  });

  /* ── Attendance ── */
  const attendance = dashboard?.attendance;
  const [optimisticClockedIn, setOptimisticClockedIn] = useState<boolean | null>(null);
  const clockedIn =
    optimisticClockedIn === true ||
    (optimisticClockedIn === null && attendance?.status === 'CLOCKED_IN');
  const isDone =
    optimisticClockedIn === false ||
    (optimisticClockedIn === null && attendance?.status === 'CLOCKED_OUT');
  const clockInTime = attendance?.clockedInAt ? formatTime(attendance.clockedInAt) : undefined;
  const hoursWorked = attendance?.totalMinutes
    ? (() => {
        const h = Math.floor(attendance.totalMinutes / 60);
        const m = attendance.totalMinutes % 60;
        return h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
      })()
    : undefined;

  const { mutate: clockIn, isPending: isClockinIn } = useClockIn();
  const { mutate: clockOut, isPending: isClockingOut } = useClockOut();

  const handleClockIn = () => {
    setOptimisticClockedIn(true);
    clockIn(undefined, {
      onError: () => setOptimisticClockedIn(null),
      onSettled: () => setOptimisticClockedIn(null),
    });
  };

  const handleClockOut = () => {
    setOptimisticClockedIn(false);
    clockOut(undefined, {
      onError: () => setOptimisticClockedIn(null),
      onSettled: () => setOptimisticClockedIn(null),
    });
  };

  /* ── Leave notification badge ── */
  const [seenLeaveIds, setSeenLeaveIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      return new Set<string>(JSON.parse(localStorage.getItem('dashboard_leave_seen_ids') ?? '[]'));
    } catch {
      return new Set();
    }
  });

  const leaveBadgeCount = useMemo(
    () =>
      myLeave.filter(
        (r) => (r.status === 'APPROVED' || r.status === 'REJECTED') && !seenLeaveIds.has(r.id),
      ).length,
    [myLeave, seenLeaveIds],
  );

  // projects badge: wire up when the projects page and hook are ready
  const projectsBadgeCount = 0;

  /* ── Panel states ── */
  const [applyLeaveOpen, setApplyLeaveOpen] = useState(false);
  const [payslipsOpen, setPayslipsOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [myLeaveOpen, setMyLeaveOpen] = useState(false);

  const handleOpenMyLeave = () => {
    setMyLeaveOpen(true);
    const ids = myLeave
      .filter((r) => r.status === 'APPROVED' || r.status === 'REJECTED')
      .map((r) => r.id);
    setSeenLeaveIds(new Set(ids));
    localStorage.setItem('dashboard_leave_seen_ids', JSON.stringify(ids));
  };

  /* ── Birthday scroll ── */
  const birthdayRef = useRef<HTMLDivElement>(null);
  const scrollBirthdays = (dir: 'left' | 'right') => {
    birthdayRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  if (authLoading || isDashboardLoading) return <DashboardSkeleton />;

  /* ── Render ── */
  return (
    <div className="p-6 flex flex-col gap-6 h-full overflow-y-auto">
      <div className="sticky top-0 z-10 -mx-6 -mt-6 px-6 pt-6 pb-2 bg-gray-50">
        <DashboardWelcomeBanner
          tenantName={tenantName}
          fullName={fullName}
          department={department}
          branch={branch}
        />
      </div>

      <DashboardStatCards
        annualBalance={annualBalance}
        upcomingLeave={upcomingLeave}
        clockedIn={clockedIn}
        isDone={isDone}
        clockInTime={clockInTime}
        hoursWorked={hoursWorked}
        isClockLoading={isClockinIn || isClockingOut}
        onRequestLeave={() => setApplyLeaveOpen(true)}
        onClockIn={handleClockIn}
        onClockOut={handleClockOut}
      />

      <div className="grid grid-cols-[3fr_2fr] gap-4">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          <AnnouncementCard announcements={announcements} />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <QuickActionsCard
            onPayslips={() => setPayslipsOpen(true)}
            onAssets={() => setAssetsOpen(true)}
            onLeave={handleOpenMyLeave}
            onSchedules={() => {}}
            onProjects={() => {}}
            leaveBadge={leaveBadgeCount}
            projectsBadge={projectsBadgeCount}
          />
          <BirthdaysCard
            birthdays={birthdays}
            scrollRef={birthdayRef}
            onScrollLeft={() => scrollBirthdays('left')}
            onScrollRight={() => scrollBirthdays('right')}
          />
          <UpcomingHolidaysCard holidays={holidays} />
        </div>
      </div>

      {/* Panels */}
      <ApplyLeavePanel
        isOpen={applyLeaveOpen}
        onClose={() => setApplyLeaveOpen(false)}
        tenantSlug={tenantSlug}
        balances={leaveBalances}
      />
      <MyLeavePanel
        isOpen={myLeaveOpen}
        onClose={() => setMyLeaveOpen(false)}
        onRequestLeave={() => {
          setMyLeaveOpen(false);
          setApplyLeaveOpen(true);
        }}
        requests={myLeave}
      />
      <MyPayslipsPanel
        isOpen={payslipsOpen}
        onClose={() => setPayslipsOpen(false)}
        payslips={myPayslips}
      />
      <MyAssetsPanel isOpen={assetsOpen} onClose={() => setAssetsOpen(false)} />
    </div>
  );
}
