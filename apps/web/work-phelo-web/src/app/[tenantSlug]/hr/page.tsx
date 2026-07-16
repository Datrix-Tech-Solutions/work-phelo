'use client';

import { use, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import {
  useMyProfile,
  useEmployeeOptions,
  useMyTasks,
  useEmployeeDashboard,
  useClockIn,
  useClockOut,
} from '@/hooks';
import { useLeaveBalances, useMyLeaveRequests } from '@/hooks/hr/useLeave';
import { useMyPayslips } from '@/hooks/hr/usePayroll';
import { formatTime, formatMinutes } from '@/lib/formatters';
import { EmployeeWelcomeCard } from '@/components/molecules/dashboard/EmployeeWelcomeCard';
import { QuickActionsCard } from '@/components/molecules/dashboard/QuickActionsCard';
import { AttendanceMetricCard } from '@/components/molecules/shared/AttendanceMetricCard';
import { MyLeavePanel } from '@/components/organisms/dashboard/MyLeavePanel';
import { MyPayslipsPanel } from '@/components/organisms/dashboard/MyPayslipsPanel';
import { MyAssetsPanel } from '@/components/organisms/dashboard/MyAssetsPanel';
import { MySchedulesPanel } from '@/components/organisms/dashboard/MySchedulesPanel';
import { MyProjectsPanel } from '@/components/organisms/dashboard/MyProjectsPanel';
import { ApplyLeavePanel } from '@/components/organisms/hr/leave/ApplyLeavePanel';

interface Attendance {
  status?: 'CLOCKED_IN' | 'CLOCKED_OUT';
  clockedInAt?: string;
  totalMinutes?: number;
}

export default function EmployeeDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);

  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);
  const fullName = !authLoading
    ? [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Employee'
    : '';

  const { data: myProfile } = useMyProfile();
  const { data: employeeOptions = [] } = useEmployeeOptions();
  const { data: balancesRaw } = useLeaveBalances();
  const { data: myLeaveRaw } = useMyLeaveRequests();
  const { data: myPayslipsRaw } = useMyPayslips();
  const { data: myTasksRaw = [] } = useMyTasks();
  const { data: dashboard } = useEmployeeDashboard();

  const managerName = (() => {
    if (!myProfile?.managerId) return undefined;
    const mgr = employeeOptions.find((e) => e.id === myProfile.managerId);
    return mgr ? `${mgr.firstName} ${mgr.lastName}` : undefined;
  })();

  const leaveBalances = Array.isArray(balancesRaw) ? balancesRaw : [];
  const myLeave = useMemo(() => (Array.isArray(myLeaveRaw) ? myLeaveRaw : []), [myLeaveRaw]);
  const myPayslips = Array.isArray(myPayslipsRaw) ? myPayslipsRaw : [];

  /* ── Panel states ── */
  const [applyLeaveOpen, setApplyLeaveOpen] = useState(false);
  const [payslipsOpen, setPayslipsOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [myLeaveOpen, setMyLeaveOpen] = useState(false);
  const [schedulesOpen, setSchedulesOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);

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

  const projectsBadgeCount = useMemo(
    () => myTasksRaw.filter((t) => t.status !== 'DONE').length,
    [myTasksRaw],
  );

  /* ── Attendance ── */
  const attendance = dashboard?.attendance as Attendance | undefined;
  const [optimisticClockedIn, setOptimisticClockedIn] = useState<boolean | null>(null);
  const clockedIn =
    optimisticClockedIn === true ||
    (optimisticClockedIn === null && attendance?.status === 'CLOCKED_IN');
  const isDone =
    optimisticClockedIn === false ||
    (optimisticClockedIn === null && attendance?.status === 'CLOCKED_OUT');
  const clockInTime = attendance?.clockedInAt ? formatTime(attendance.clockedInAt) : undefined;
  const hoursWorked = attendance?.totalMinutes ? formatMinutes(attendance.totalMinutes) : undefined;

  const { mutate: clockIn, isPending: isClockingIn } = useClockIn();
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

  const handleOpenMyLeave = () => {
    setMyLeaveOpen(true);
    const ids = myLeave
      .filter((r) => r.status === 'APPROVED' || r.status === 'REJECTED')
      .map((r) => r.id);
    setSeenLeaveIds(new Set(ids));
    localStorage.setItem('dashboard_leave_seen_ids', JSON.stringify(ids));
  };

  return (
    <div className="p-6 flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
      <div className="flex flex-wrap items-start gap-6">
        <div className="w-full max-w-md flex flex-col gap-6">
          <EmployeeWelcomeCard
            fullName={fullName}
            avatarUrl={myProfile?.avatarUrl}
            jobTitle={myProfile?.jobTitle}
            department={myProfile?.department?.name}
            branch={myProfile?.branch?.name}
            managerName={managerName}
            companyName={user?.tenantName}
          />
          <QuickActionsCard
            onApplyLeave={() => setApplyLeaveOpen(true)}
            onLeave={handleOpenMyLeave}
            onPayslips={() => setPayslipsOpen(true)}
            onAssets={() => setAssetsOpen(true)}
            onSchedules={() => setSchedulesOpen(true)}
            onProjects={() => setProjectsOpen(true)}
            leaveBadge={leaveBadgeCount}
            projectsBadge={projectsBadgeCount}
          />
        </div>

        <div className="w-full max-w-md flex-1 min-w-[320px]">
          <AttendanceMetricCard
            clockedIn={clockedIn}
            isDone={isDone}
            clockInTime={clockInTime}
            hoursWorked={hoursWorked}
            onClockIn={handleClockIn}
            onClockOut={handleClockOut}
            isLoading={isClockingIn || isClockingOut}
          />
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
      <MySchedulesPanel isOpen={schedulesOpen} onClose={() => setSchedulesOpen(false)} />
      <MyProjectsPanel
        isOpen={projectsOpen}
        onClose={() => setProjectsOpen(false)}
        tenantSlug={tenantSlug}
      />
    </div>
  );
}
