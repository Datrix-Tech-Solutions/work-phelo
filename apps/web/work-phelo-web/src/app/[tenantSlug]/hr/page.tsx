// EMPLOYEE DASHBOARD //

'use client';

import { use, useState, useRef } from 'react';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  MonitorSmartphone,
  CalendarRange,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { SidePanel } from '@/components/organisms/SidePanel';
import { Button } from '@/components/atoms/Button';
import { ApplyLeavePanel } from '@/components/organisms/leave/ApplyLeavePanel';
import { cn } from '@/lib/utils';

/* ── Greeting ── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ── Dummy data ── */
const DUMMY_ANNOUNCEMENTS = [
  {
    id: '1',
    title: 'General Meeting',
    date: '22 Apr 2025',
    body: '',
  },
];

const DUMMY_BIRTHDAYS = [
  { id: '1', name: 'John Doe', date: '6th April', initials: 'JD', color: '#0D2244' },
];

const DUMMY_HOLIDAYS = [{ id: '2', name: 'Easter Monday', date: '6 Apr 2026' }];

const DUMMY_PAYSLIPS = [
  { id: '1', month: 'March 2026', gross: 'GHS 5,500.00', net: 'GHS 4,820.00', status: 'Paid' },
];

const DUMMY_MY_ASSETS = [
  {
    id: '1',
    name: 'MacBook Pro 14"',
    type: 'Laptop',
    assetNumber: 'LAP-0001',
    assignedAt: '1 Feb 2024',
  },
];

const DUMMY_LEAVE_REQUESTS = [
  {
    id: '1',
    type: 'Annual Leave',
    start: '27 Apr 2026',
    end: '3 May 2026',
    days: 5,
    status: 'Approved',
  },
];

const DUMMY_LEAVE_BALANCES = [
  {
    leaveTypeId: 'annual',
    leaveTypeName: 'Annual Leave',
    entitled: 22,
    used: 8,
    pending: 5,
    remaining: 14,
    carriedOver: 0,
  },
];

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
    Approved: 'bg-green-50 text-green-700',
    Pending: 'bg-yellow-50 text-yellow-700',
    Rejected: 'bg-red-50 text-red-700',
  };
  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded-full text-xs font-semibold',
        styles[status] ?? 'bg-gray-50 text-gray-600',
      )}
    >
      {status}
    </span>
  );
}

/* ── Page ── */
export default function EmployeeDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const user = useAuthStore((s) => s.user);

  const firstName = user?.firstName ?? 'Employee';
  const lastName = user?.lastName ?? '';
  const fullName = lastName ? `${firstName} ${lastName}` : firstName;
  const tenantName = user?.tenantName ?? 'Your Company';

  /* ── Panel states ── */
  const [applyLeaveOpen, setApplyLeaveOpen] = useState(false);
  const [payslipsOpen, setPayslipsOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [myLeaveOpen, setMyLeaveOpen] = useState(false);

  /* ── Clock in state ── */
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<string | null>(null);

  const handleClockIn = () => {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    setClockedIn(true);
    setClockInTime(time);
  };

  const handleClockOut = () => {
    setClockedIn(false);
    setClockInTime(null);
  };

  /* ── Announcement pagination ── */
  const [announcementIdx, setAnnouncementIdx] = useState(0);
  const announcement = DUMMY_ANNOUNCEMENTS[announcementIdx];
  const [expanded, setExpanded] = useState(false);

  const prevAnnouncement = () => {
    setAnnouncementIdx((i) => Math.max(0, i - 1));
    setExpanded(false);
  };
  const nextAnnouncement = () => {
    setAnnouncementIdx((i) => Math.min(DUMMY_ANNOUNCEMENTS.length - 1, i + 1));
    setExpanded(false);
  };

  /* ── Birthday scroll ── */
  const birthdayRef = useRef<HTMLDivElement>(null);
  const scrollBirthdays = (dir: 'left' | 'right') => {
    if (!birthdayRef.current) return;
    birthdayRef.current.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  /* ── Truncated announcement body ── */
  const BODY_LIMIT = 400;
  const bodyTruncated = announcement.body.length > BODY_LIMIT && !expanded;
  const displayBody = bodyTruncated
    ? announcement.body.slice(0, BODY_LIMIT) + '…'
    : announcement.body;

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
        <div className="bg-white border border-gray-200 rounded-card px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Annual Leave</span>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-gray-900">
              14<span className="text-base font-normal text-gray-400">/ 22 Days</span>
            </p>
            <button
              onClick={() => setApplyLeaveOpen(true)}
              className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors"
            >
              Request Leave
            </button>
          </div>
        </div>

        {/* Upcoming Leave */}
        <div className="bg-white border border-gray-200 rounded-card px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Upcoming Leave</span>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-base font-semibold text-gray-900 mt-1">27 Apr 2026 – 03 May 2026</p>
        </div>

        {/* Clock In / Out */}
        <div className="bg-white border border-gray-200 rounded-card px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{clockedIn ? 'Clock In' : 'Clock In'}</span>
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex items-end justify-between">
            {clockedIn ? (
              <p className="text-sm text-gray-700">
                Clocked in at <span className="font-bold">{clockInTime}</span>
              </p>
            ) : (
              <p className="text-sm text-gray-400">Not clocked in</p>
            )}
            {clockedIn ? (
              <button
                onClick={handleClockOut}
                className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors"
              >
                Clock Out
              </button>
            ) : (
              <button
                onClick={handleClockIn}
                className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors"
              >
                Clock In
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-[3fr_2fr] gap-4 flex-1 min-h-0 overflow-hidden">
        {/* ── Left column ── */}
        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
          {/* General Announcements */}
          <div className="bg-white border border-gray-200 rounded-card p-5 flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">General Announcements</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={prevAnnouncement}
                  disabled={announcementIdx === 0}
                  className="p-1.5 rounded-full hover:bg-gray-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  onClick={nextAnnouncement}
                  disabled={announcementIdx === DUMMY_ANNOUNCEMENTS.length - 1}
                  className="p-1.5 rounded-full hover:bg-gray-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-bold text-gray-900">{announcement.title}</p>
                <span className="text-xs text-gray-400 shrink-0 ml-4">{announcement.date}</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                {displayBody}
                {bodyTruncated && (
                  <button
                    onClick={() => setExpanded(true)}
                    className="ml-1 text-sm font-semibold text-gray-900 hover:underline"
                  >
                    Read More
                  </button>
                )}
              </p>
            </div>
          </div>

          {/* Upcoming Birthdays */}
          <div className="bg-white border border-gray-200 rounded-card p-5 flex flex-col gap-4 shrink-0 overflow-hidden">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Upcoming Birthdays</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => scrollBirthdays('left')}
                  className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  onClick={() => scrollBirthdays('right')}
                  className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            <div
              ref={birthdayRef}
              className="flex gap-4 overflow-x-auto scrollbar-hide pb-1"
              style={{ scrollbarWidth: 'none' }}
            >
              {DUMMY_BIRTHDAYS.map((person) => (
                <div key={person.id} className="flex flex-col items-center gap-2 shrink-0 w-28">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
                    style={{ backgroundColor: person.color }}
                  >
                    {person.initials}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-900 leading-tight">
                      {person.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{person.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
          {/* Quick Actions */}
          <div className="bg-white border border-gray-200 rounded-card p-5 shrink-0">
            <h2 className="text-base font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="flex items-start justify-around">
              <QuickActionBtn
                icon={<CircleDollarSign className="w-6 h-6" />}
                label="My Payslips"
                color="#22994A"
                onClick={() => setPayslipsOpen(true)}
              />
              <QuickActionBtn
                icon={<MonitorSmartphone className="w-6 h-6" />}
                label="My Assets"
                color="#D97706"
                onClick={() => setAssetsOpen(true)}
              />
              <QuickActionBtn
                icon={<CalendarRange className="w-6 h-6" />}
                label="My Leave"
                color="#3B82F6"
                onClick={() => setMyLeaveOpen(true)}
              />
            </div>
          </div>

          {/* Upcoming Holidays */}
          <div className="bg-white border border-gray-200 rounded-card p-5 flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
            <h2 className="text-base font-bold text-gray-900">Upcoming Holidays</h2>
            <div className="flex flex-col gap-3">
              {DUMMY_HOLIDAYS.map((h) => (
                <div key={h.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{h.date}</p>
                    <p className="text-sm font-semibold text-gray-900">{h.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Apply Leave Panel ── */}
      <ApplyLeavePanel
        isOpen={applyLeaveOpen}
        onClose={() => setApplyLeaveOpen(false)}
        tenantSlug={tenantSlug}
        balances={DUMMY_LEAVE_BALANCES}
      />

      {/* ── My Payslips Panel ── */}
      <SidePanel
        isOpen={payslipsOpen}
        onClose={() => setPayslipsOpen(false)}
        title="My Payslips"
        description="Your recent payslip history."
        width="w-[480px]"
      >
        <div className="flex flex-col gap-3">
          {DUMMY_PAYSLIPS.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-4 py-4 border border-gray-200 rounded-card bg-white"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">{p.month}</p>
                <p className="text-xs text-gray-400 mt-0.5">Gross: {p.gross}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{p.net}</p>
                  <p className="text-xs text-green-600 font-medium">{p.status}</p>
                </div>
                <button className="text-xs font-semibold text-[#0D2244] hover:underline">
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      </SidePanel>

      {/* ── My Assets Panel ── */}
      <SidePanel
        isOpen={assetsOpen}
        onClose={() => setAssetsOpen(false)}
        title="My Assets"
        description="Assets currently assigned to you."
        width="w-[480px]"
      >
        <div className="flex flex-col gap-3">
          {DUMMY_MY_ASSETS.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-4 px-4 py-4 border border-gray-200 rounded-card bg-white"
            >
              <div className="w-10 h-10 rounded-lg bg-[#EEF1F8] flex items-center justify-center shrink-0">
                <MonitorSmartphone className="w-5 h-5 text-[#0D2244]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{a.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {a.assetNumber} · {a.type}
                </p>
              </div>
              <p className="text-xs text-gray-400 shrink-0">Since {a.assignedAt}</p>
            </div>
          ))}
        </div>
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
        <div className="flex flex-col gap-3">
          {DUMMY_LEAVE_REQUESTS.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between px-4 py-4 border border-gray-200 rounded-card bg-white"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">{r.type}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {r.start} – {r.end} · {r.days} {r.days === 1 ? 'day' : 'days'}
                </p>
              </div>
              <LeaveStatusBadge status={r.status} />
            </div>
          ))}
        </div>
      </SidePanel>
    </div>
  );
}
