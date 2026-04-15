// EMPLOYEE DASHBOARD //

'use client';

import { use, useState, useRef } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useUpcomingBirthdays, useEmployeeDashboard } from '@/hooks';
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
import { UpcomingBirthday } from '@/types/hr';
import { formatTime } from '@/lib/formatters';

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
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Employee';
  const tenantName = user?.tenantName ?? 'Your Company';

  /* ── Remote data ── */
  const { data: dashboard } = useEmployeeDashboard();
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

  /* ── Derived: upcoming leave ── */
  const upcomingLeave = dashboard?.leave?.upcomingLeave ?? null;

  /* ── Derived: my leave requests ── */
  const myLeave = Array.isArray(myLeaveRaw) ? myLeaveRaw : [];

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
  const holidays = (Array.isArray(holidaysRaw) ? holidaysRaw : [])
    .filter((h: { date: string }) => new Date(h.date) >= new Date())
    .sort(
      (a: { date: string }, b: { date: string }) =>
        new Date(a.date).getTime() - new Date(b.date).getTime(),
    )
    .slice(0, 5);

  /* ── Derived: birthdays ── */
  const rawBirthdays = Array.isArray(birthdaysRaw)
    ? birthdaysRaw
    : ((birthdaysRaw as unknown as { data?: UpcomingBirthday[] })?.data ?? []);
  const birthdays = (Array.isArray(rawBirthdays) ? rawBirthdays : []).map((b) => {
    const name = `${b.firstName} ${b.lastName}`;
    return {
      id: b.id,
      name,
      date: new Date(b.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }),
      initials: `${b.firstName[0]}${b.lastName[0]}`.toUpperCase(),
      color: avatarColor(name),
    };
  });

  /* ── Attendance ── */
  const attendance = dashboard?.attendance;
  const [optimisticClockedIn, setOptimisticClockedIn] = useState<boolean | null>(null);
  const clockedIn = optimisticClockedIn ?? attendance?.status === 'CLOCKED_IN';
  const clockInTime = attendance?.clockedInAt ? formatTime(attendance.clockedInAt) : undefined;

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

  /* ── Panel states ── */
  const [applyLeaveOpen, setApplyLeaveOpen] = useState(false);
  const [payslipsOpen, setPayslipsOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [myLeaveOpen, setMyLeaveOpen] = useState(false);

  /* ── Announcement pagination ── */
  const [announcementIdx, setAnnouncementIdx] = useState(0);
  const prevAnnouncement = () => setAnnouncementIdx((i) => Math.max(0, i - 1));
  const nextAnnouncement = () =>
    setAnnouncementIdx((i) => Math.min(Math.max(announcements.length - 1, 0), i + 1));

  /* ── Birthday scroll ── */
  const birthdayRef = useRef<HTMLDivElement>(null);
  const scrollBirthdays = (dir: 'left' | 'right') => {
    birthdayRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  /* ── Render ── */
  return (
    <div className="p-6 flex flex-col gap-4 h-full overflow-hidden">
      <DashboardWelcomeBanner tenantName={tenantName} fullName={fullName} />

      <DashboardStatCards
        annualBalance={annualBalance}
        upcomingLeave={upcomingLeave}
        clockedIn={clockedIn}
        clockInTime={clockInTime}
        isClockLoading={isClockinIn || isClockingOut}
        onRequestLeave={() => setApplyLeaveOpen(true)}
        onClockIn={handleClockIn}
        onClockOut={handleClockOut}
      />

      <div className="grid grid-cols-[3fr_2fr] gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left column */}
        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
          <AnnouncementCard
            announcements={announcements}
            currentIndex={announcementIdx}
            onPrev={prevAnnouncement}
            onNext={nextAnnouncement}
          />
          <BirthdaysCard
            birthdays={birthdays}
            scrollRef={birthdayRef}
            onScrollLeft={() => scrollBirthdays('left')}
            onScrollRight={() => scrollBirthdays('right')}
          />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
          <QuickActionsCard
            onPayslips={() => setPayslipsOpen(true)}
            onAssets={() => setAssetsOpen(true)}
            onLeave={() => setMyLeaveOpen(true)}
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
        onRequestLeave={() => setApplyLeaveOpen(true)}
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
