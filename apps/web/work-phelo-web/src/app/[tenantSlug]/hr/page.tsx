// EMPLOYEE DASHBOARD //

'use client';

import { use, useState, useRef } from 'react';
import { Calendar } from 'lucide-react';
import { ModuleIcons, moduleColor } from '@/components/atoms/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { useUpcomingBirthdays, useEmployeeDashboard } from '@/hooks';
import { useLeaveBalances, useMyLeaveRequests } from '@/hooks/useLeave';
import { useMyPayslips } from '@/hooks/usePayroll';
import { usePublicHolidays } from '@/hooks/usePublicHolidays';
import { useClockIn, useClockOut } from '@/hooks/useTimeClock';
import { UpcomingBirthday } from '@/types/hr';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { ApplyLeavePanel } from '@/components/organisms/leave/ApplyLeavePanel';
import { MetricCard } from '@/components/molecules/shared/MetricCard';
import { AttendanceMetricCard } from '@/components/molecules/shared/AttendanceMetricCard';
import { AnnouncementCard } from '@/components/molecules/dashboard/announcmentCard';
import { BirthdaysCard } from '@/components/molecules/dashboard/birthdayCard';
import { cn } from '@/lib/utils';
import { getGreeting } from '@/lib/formatters';

/* ── Avatar colour picker (deterministic from name) ── */
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

/* ── Format birthday date for display ── */
function formatBirthdayDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

/* ── Format time from ISO string ── */
function formatTime(iso: string | null | undefined) {
  if (!iso) return undefined;
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/* ── Format date range ── */
function formatDateRange(start: string, end: string) {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

/* ── Format holiday date ── */
function formatHolidayDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/* ── Quick action button ── */
function QuickActionBtn({
  icon,
  label,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-white transition-transform group-hover:scale-105"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>
      <span className="text-xs font-medium text-gray-700 text-center leading-tight">{label}</span>
    </button>
  );
}

/* ── Leave request status badge ── */
function LeaveStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    APPROVED: 'bg-green-50 text-green-700',
    PENDING: 'bg-yellow-50 text-yellow-700',
    REJECTED: 'bg-red-50 text-red-700',
    CANCELLED: 'bg-gray-50 text-gray-500',
  };
  const labels: Record<string, string> = {
    APPROVED: 'Approved',
    PENDING: 'Pending',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
  };
  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded-full text-xs font-semibold',
        styles[status] ?? 'bg-gray-50 text-gray-600',
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}

/* ── Empty state helper ── */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

/* ── Page ── */
export default function EmployeeDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const queryClient = useQueryClient();

  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? 'Employee';
  const lastName = user?.lastName ?? '';
  const fullName = lastName ? `${firstName} ${lastName}` : firstName;
  const tenantName = user?.tenantName ?? 'Your Company';

  /* ── Data ── */
  const { data: dashboard } = useEmployeeDashboard();
  const { data: balancesRaw } = useLeaveBalances();
  const { data: myLeaveRaw } = useMyLeaveRequests();
  const { data: myPayslipsRaw } = useMyPayslips();
  const { data: holidaysRaw } = usePublicHolidays();
  const { data: birthdaysRaw } = useUpcomingBirthdays();

  /* ── Derived: leave balances ── */
  const leaveBalances = Array.isArray(balancesRaw) ? balancesRaw : [];
  const annualBalance = leaveBalances.find((b: { leaveTypeName?: string }) =>
    b.leaveTypeName?.toLowerCase().includes('annual'),
  );

  /* ── Derived: upcoming leave from dashboard ── */
  const upcomingLeave = dashboard?.leave?.upcomingLeave ?? null;

  /* ── Derived: announcements ── */
  const announcements: { id: string; title: string; date: string; body: string }[] = (
    dashboard?.announcements ?? []
  ).map(
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

  /* ── Derived: my leave requests ── */
  const myLeave = Array.isArray(myLeaveRaw) ? myLeaveRaw : [];

  /* ── Derived: my payslips ── */
  const myPayslips = Array.isArray(myPayslipsRaw) ? myPayslipsRaw : [];

  /* ── Derived: birthdays ── */
  const rawBirthdays = Array.isArray(birthdaysRaw)
    ? birthdaysRaw
    : ((birthdaysRaw as unknown as { data?: UpcomingBirthday[] })?.data ?? []);
  const birthdays = (Array.isArray(rawBirthdays) ? rawBirthdays : []).map((b) => {
    const name = `${b.firstName} ${b.lastName}`;
    return {
      id: b.id,
      name,
      date: formatBirthdayDate(b.dateOfBirth),
      initials: `${b.firstName[0]}${b.lastName[0]}`.toUpperCase(),
      color: avatarColor(name),
    };
  });

  /* ── Attendance ── */
  const attendance = dashboard?.attendance;
  const clockedIn = attendance?.status === 'CLOCKED_IN';
  const clockInTime = formatTime(attendance?.clockedInAt);

  const { mutate: clockIn, isPending: isClockinIn } = useClockIn();
  const { mutate: clockOut, isPending: isClockingOut } = useClockOut();

  const handleClockIn = () => {
    clockIn(undefined, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employee-dashboard'] }),
    });
  };

  const handleClockOut = () => {
    clockOut(undefined, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employee-dashboard'] }),
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
    if (!birthdayRef.current) return;
    birthdayRef.current.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  return (
    <div className="p-6 flex flex-col gap-4 h-full overflow-hidden">
      {/* ── Welcome banner ── */}
      <div
        className="rounded-card px-8 py-5 flex items-center justify-between shrink-0"
        style={{ background: 'linear-gradient(to right, #0D1F44, #1E3A8A)' }}
      >
        <div>
          <p className="text-sm font-semibold text-orange-400">{tenantName}</p>
          <h1 className="text-2xl font-bold text-white mt-0.5">
            {getGreeting()}, {fullName}
          </h1>
        </div>
      </div>

      {/* ── Stat cards row ── */}
      <div className="grid grid-cols-3 gap-4 shrink-0">
        {/* Annual Leave */}
        <MetricCard
          title="Annual Leave"
          value={annualBalance ? annualBalance.remaining : '—'}
          unit={annualBalance ? `/ ${annualBalance.entitled} Days` : undefined}
          icon={ModuleIcons.leave}
          actionLabel="Request Leave"
          onAction={() => setApplyLeaveOpen(true)}
        />

        {/* Upcoming Leave */}
        <MetricCard
          title="Upcoming Leave"
          value={upcomingLeave ? upcomingLeave.leaveType : '—'}
          unit={
            upcomingLeave
              ? formatDateRange(upcomingLeave.startDate, upcomingLeave.endDate)
              : 'No upcoming leave'
          }
          icon={ModuleIcons.leave}
        />

        {/* Clock In / Out */}
        <AttendanceMetricCard
          clockedIn={clockedIn}
          clockInTime={clockInTime}
          onClockIn={handleClockIn}
          onClockOut={handleClockOut}
          isLoading={isClockinIn || isClockingOut}
        />
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-[3fr_2fr] gap-4 flex-1 min-h-0 overflow-hidden">
        {/* ── Left column ── */}
        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
          {/* General Announcements */}
          <AnnouncementCard
            announcements={announcements}
            currentIndex={announcementIdx}
            onPrev={prevAnnouncement}
            onNext={nextAnnouncement}
          />

          {/* Upcoming Birthdays */}
          <BirthdaysCard
            birthdays={birthdays}
            scrollRef={birthdayRef}
            onScrollLeft={() => scrollBirthdays('left')}
            onScrollRight={() => scrollBirthdays('right')}
          />
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
          {/* Quick Actions */}
          <div className="bg-white border border-gray-200 rounded-card p-5 shrink-0">
            <h2 className="text-base font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="flex items-start justify-around">
              <QuickActionBtn
                icon={<ModuleIcons.payroll className="w-6 h-6" />}
                label="My Payslips"
                color={moduleColor('payroll')}
                onClick={() => setPayslipsOpen(true)}
              />
              <QuickActionBtn
                icon={<ModuleIcons.assets className="w-6 h-6" />}
                label="My Assets"
                color={moduleColor('assets')}
                onClick={() => setAssetsOpen(true)}
              />
              <QuickActionBtn
                icon={<ModuleIcons.leave className="w-6 h-6" />}
                label="My Leave"
                color={moduleColor('leave')}
                onClick={() => setMyLeaveOpen(true)}
              />
            </div>
          </div>

          {/* Upcoming Holidays */}
          <div className="bg-white border border-gray-200 rounded-card p-5 flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
            <h2 className="text-base font-bold text-gray-900">Upcoming Holidays</h2>
            {holidays.length === 0 ? (
              <EmptyState message="No upcoming public holidays" />
            ) : (
              <div className="flex flex-col gap-3">
                {holidays.map((h: { id: string; name: string; date: string }) => (
                  <div key={h.id} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">{formatHolidayDate(h.date)}</p>
                      <p className="text-sm font-semibold text-gray-900">{h.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Apply Leave Panel ── */}
      <ApplyLeavePanel
        isOpen={applyLeaveOpen}
        onClose={() => setApplyLeaveOpen(false)}
        tenantSlug={tenantSlug}
        balances={leaveBalances}
      />

      {/* ── My Payslips Panel ── */}
      <SidePanel
        isOpen={payslipsOpen}
        onClose={() => setPayslipsOpen(false)}
        title="My Payslips"
        description="Your recent payslip history."
        width="w-[480px]"
      >
        {myPayslips.length === 0 ? (
          <EmptyState message="No payslips available yet" />
        ) : (
          <div className="flex flex-col gap-3">
            {myPayslips.map(
              (p: {
                id: string;
                grossPay?: number | null;
                netPay?: number | null;
                payrollRun?: { year: number; month: number; status?: string };
              }) => {
                const run = p.payrollRun;
                const month = run
                  ? new Date(run.year, run.month - 1).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—';
                const gross = p.grossPay != null ? `GHS ${Number(p.grossPay).toFixed(2)}` : '—';
                const net = p.netPay != null ? `GHS ${Number(p.netPay).toFixed(2)}` : '—';
                const status = run?.status === 'PAID' ? 'Paid' : (run?.status ?? '—');
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-4 py-4 border border-gray-200 rounded-card bg-white"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{month}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Gross: {gross}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{net}</p>
                        <p className="text-xs text-green-600 font-medium">{status}</p>
                      </div>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </SidePanel>

      {/* ── My Assets Panel ── */}
      <SidePanel
        isOpen={assetsOpen}
        onClose={() => setAssetsOpen(false)}
        title="My Assets"
        description="Assets currently assigned to you."
        width="w-[480px]"
      >
        <EmptyState message="Asset management is not available yet" />
      </SidePanel>

      {/* ── My Leave Panel ── */}
      <SidePanel
        isOpen={myLeaveOpen}
        onClose={() => setMyLeaveOpen(false)}
        title="My Leave"
        description="Your leave request history."
        width="w-[480px]"
        footer={
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setMyLeaveOpen(false);
                setApplyLeaveOpen(true);
              }}
            >
              Request Leave
            </Button>
          </div>
        }
      >
        {myLeave.length === 0 ? (
          <EmptyState message="No leave requests yet" />
        ) : (
          <div className="flex flex-col gap-3">
            {myLeave.map(
              (r: {
                id: string;
                startDate: string;
                endDate: string;
                status: string;
                leaveType?: { name: string };
              }) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-4 py-4 border border-gray-200 rounded-card bg-white"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {r.leaveType?.name ?? 'Leave'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDateRange(r.startDate, r.endDate)}
                    </p>
                  </div>
                  <LeaveStatusBadge status={r.status} />
                </div>
              ),
            )}
          </div>
        )}
      </SidePanel>
    </div>
  );
}
