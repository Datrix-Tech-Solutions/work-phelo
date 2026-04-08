// ADMIN APRAISAL PAGE //

'use client';

import { use, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import { Button } from '@/components/atoms/Button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  AppraisalStatus,
  EmployeeAppraisalStatus,
  FinalRating,
  AppraisalCycleSummary,
  MyAppraisalRow,
  TeamReviewRow,
} from '@/types/appraisal';
import { RatingBadge } from '@/components/molecules/appraisal/RatingBadge';
import { formatDate } from '@/lib/formatters';

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const TAB_ACTIVE =
  'relative text-[#0D2244] font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#0D2244] after:rounded-t-full';
const TAB_IDLE = 'text-gray-500 hover:text-gray-800';
const PAGE_SIZE = 10;

export default function AppraisalPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const isHR = user?.role === 'TENANT_ADMIN';
  const isManager = isHR || user?.isManager === true;

  const TABS = [
    { key: 'my', label: 'My Appraisal' },
    ...(isManager ? [{ key: 'team', label: 'Team Review' }] : []),
    ...(isHR ? [{ key: 'hr', label: 'Appraisals' }] : []),
  ];

  const [activeTab, setActiveTab] = useState(TABS[0]?.key ?? 'my');
  const [myPage, setMyPage] = useState(1);
  const [teamPage, setTeamPage] = useState(1);
  const [hrPage, setHrPage] = useState(1);
  const [mySearch, setMySearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [hrSearch, setHrSearch] = useState('');

  /* ── My Appraisal ── */
  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: ['my-appraisals', tenantSlug],
    queryFn: () => api.get('/hr/appraisals/my').then((r) => r.data),
    enabled: activeTab === 'my',
  });

  const myRows: MyAppraisalRow[] = useMemo(() => {
    const list = Array.isArray(myData) ? myData : (myData?.data ?? []);
    return list.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      cycleId: String(r.cycleId),
      cycleName: String(r.cycleName ?? ''),
      cycleStatus: (r.cycleStatus as AppraisalStatus) ?? 'Upcoming',
      overallStatus: (r.overallStatus as EmployeeAppraisalStatus) ?? 'NotStarted',
      overallScore: r.overallScore != null ? Number(r.overallScore) : undefined,
      finalRating: r.finalRating as FinalRating | undefined,
      selfAssessmentDeadline: String(r.selfAssessmentDeadline ?? ''),
    }));
  }, [myData]);

  const myFiltered = useMemo(() => {
    if (!mySearch) return myRows;
    const q = mySearch.toLowerCase();
    return myRows.filter((r) => r.cycleName.toLowerCase().includes(q));
  }, [myRows, mySearch]);

  /* ── Team Review ── */
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team-appraisals', tenantSlug],
    queryFn: () => api.get('/hr/appraisals/team').then((r) => r.data),
    enabled: activeTab === 'team',
  });

  const teamRows: TeamReviewRow[] = useMemo(() => {
    const list = Array.isArray(teamData) ? teamData : (teamData?.data ?? []);
    return list.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      employeeId: String(r.employeeId),
      employeeName: String(r.employeeName ?? ''),
      cycleId: String(r.cycleId),
      cycleName: String(r.cycleName ?? ''),
      selfSubmittedAt: r.selfSubmittedAt ? String(r.selfSubmittedAt) : undefined,
      managerReviewDeadline: String(r.managerReviewDeadline ?? ''),
      overallStatus: (r.overallStatus as EmployeeAppraisalStatus) ?? 'NotStarted',
    }));
  }, [teamData]);

  const teamFiltered = useMemo(() => {
    if (!teamSearch) return teamRows;
    const q = teamSearch.toLowerCase();
    return teamRows.filter(
      (r) => r.employeeName.toLowerCase().includes(q) || r.cycleName.toLowerCase().includes(q),
    );
  }, [teamRows, teamSearch]);

  /* ── HR Appraisals ── */
  const { data: hrData, isLoading: hrLoading } = useQuery({
    queryKey: ['appraisal-cycles-summary', tenantSlug, hrPage, hrSearch],
    queryFn: () =>
      api
        .get('/hr/appraisals/cycles', {
          params: { page: hrPage, search: hrSearch || undefined, includeSummary: true },
        })
        .then((r) => r.data),
    enabled: isHR && activeTab === 'hr',
  });

  const hrCycles: AppraisalCycleSummary[] = useMemo(() => {
    const list = Array.isArray(hrData) ? hrData : (hrData?.data ?? hrData?.cycles ?? []);
    return list;
  }, [hrData]);
  const hrTotalPages = hrData?.totalPages ?? 1;

  /* ── Columns ── */
  const myColumns: Column<MyAppraisalRow>[] = [
    {
      key: 'cycleName',
      label: 'Cycle',
      width: '2fr',
      render: (r) => <span className="font-medium text-gray-900">{r.cycleName}</span>,
    },
    {
      key: 'overallStatus',
      label: 'Status',
      width: '1.2fr',
      render: (r) => <StatusBadge status={r.overallStatus} />,
    },
    {
      key: 'finalRating',
      label: 'Rating',
      width: '1.2fr',
      render: (r) => <RatingBadge rating={r.finalRating} />,
    },
    {
      key: 'overallScore',
      label: 'Score',
      width: '80px',
      render: (r) =>
        r.overallScore != null ? (
          <span className="font-semibold text-gray-900">{r.overallScore}%</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'action',
      label: '',
      width: '120px',
      render: (r) => {
        if (r.overallStatus === 'NotStarted' && r.cycleStatus === 'InProgress') {
          return (
            <Button size="sm" onClick={() => router.push(`/${tenantSlug}/hr/appraisal/${r.id}`)}>
              Start
            </Button>
          );
        }
        if (r.overallStatus !== 'NotStarted') {
          return (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => router.push(`/${tenantSlug}/hr/appraisal/${r.id}`)}
            >
              View
            </Button>
          );
        }
        return <span className="text-xs text-gray-400">Not started</span>;
      },
    },
  ];

  const teamColumns: Column<TeamReviewRow>[] = [
    {
      key: 'employeeName',
      label: 'Employee',
      width: '1.5fr',
      render: (r) => <span className="font-medium text-gray-900">{r.employeeName}</span>,
    },
    {
      key: 'cycleName',
      label: 'Cycle',
      width: '1.5fr',
      render: (r) => <span className="text-gray-700">{r.cycleName}</span>,
    },
    {
      key: 'selfSubmittedAt',
      label: 'Self Submitted',
      width: '1.2fr',
      render: (r) =>
        r.selfSubmittedAt ? (
          <span className="text-sm text-gray-700">{formatDate(r.selfSubmittedAt)}</span>
        ) : (
          <span className="text-sm text-gray-400">Pending</span>
        ),
    },
    {
      key: 'managerReviewDeadline',
      label: 'Manager Deadline',
      width: '1.2fr',
      render: (r) => (
        <span className="text-sm text-gray-700">{formatDate(r.managerReviewDeadline)}</span>
      ),
    },
    {
      key: 'daysLeft',
      label: 'Days Left',
      width: '100px',
      render: (r) => {
        const days = daysUntil(r.managerReviewDeadline);
        return (
          <span
            className={cn(
              'font-semibold text-sm',
              days < 0 ? 'text-red-500' : days <= 3 ? 'text-orange-500' : 'text-gray-700',
            )}
          >
            {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
          </span>
        );
      },
    },
  ];

  const hrColumns: Column<AppraisalCycleSummary>[] = [
    {
      key: 'title',
      label: 'Cycle Name',
      width: '2fr',
      render: (r) => <span className="font-medium text-gray-900">{r.title}</span>,
    },
    {
      key: 'period',
      label: 'Period',
      width: '1.5fr',
      render: (r) => (
        <span className="text-xs text-gray-600">
          {formatDate(r.startDate)} – {formatDate(r.endDate)}
        </span>
      ),
    },
    {
      key: 'totalEmployees',
      label: 'Employees',
      width: '90px',
      render: (r) => <span className="font-medium text-gray-700">{r.totalEmployees ?? '—'}</span>,
    },
    {
      key: 'completionRate',
      label: 'Completion',
      width: '1.5fr',
      render: (r) => {
        const rate = r.completionRate ?? 0;
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-24">
              <div
                className="h-full bg-[#0D2244] rounded-full transition-all"
                style={{ width: `${rate}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 shrink-0 w-9 text-right">{rate}%</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      width: '110px',
      render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'viewResults',
      label: '',
      width: '140px',
      render: (r) =>
        r.isActive ? (
          <span className="text-xs text-gray-400 italic">Results pending</span>
        ) : r.completionRate === 100 ? (
          <Button
            size="sm"
            onClick={() => router.push(`/${tenantSlug}/hr/appraisal/cycles/${r.id}/results`)}
          >
            View Results
          </Button>
        ) : null,
    },
  ];

  const myPageData = myFiltered.slice((myPage - 1) * PAGE_SIZE, myPage * PAGE_SIZE);
  const myTotalPages = Math.max(1, Math.ceil(myFiltered.length / PAGE_SIZE));
  const teamPageData = teamFiltered.slice((teamPage - 1) * PAGE_SIZE, teamPage * PAGE_SIZE);
  const teamTotalPages = Math.max(1, Math.ceil(teamFiltered.length / PAGE_SIZE));

  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Appraisal</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Track performance reviews across your organisation
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-end gap-1 border-b border-gray-200 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'relative px-4 py-3 text-sm transition-colors whitespace-nowrap',
              activeTab === tab.key ? TAB_ACTIVE : TAB_IDLE,
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* My Appraisal */}
      {activeTab === 'my' && (
        <DataTable
          columns={myColumns}
          data={myPageData}
          isLoading={myLoading}
          emptyMessage="No appraisal cycles assigned to you yet"
          searchPlaceholder="Search cycles..."
          onSearch={(q) => {
            setMySearch(q);
            setMyPage(1);
          }}
          currentPage={myPage}
          totalPages={myTotalPages}
          onPageChange={setMyPage}
        />
      )}

      {/* Team Review */}
      {activeTab === 'team' && (
        <DataTable
          columns={teamColumns}
          data={teamPageData}
          isLoading={teamLoading}
          emptyMessage="No team members have active appraisals"
          searchPlaceholder="Search employee or cycle..."
          onSearch={(q) => {
            setTeamSearch(q);
            setTeamPage(1);
          }}
          rowActions={(row) => {
            const actions = [];
            if (row.overallStatus === 'SelfSubmitted') {
              actions.push({
                label: 'Review',
                onClick: () => router.push(`/${tenantSlug}/hr/appraisal/${row.id}/review`),
              });
            }
            if (
              row.overallStatus === 'ManagerSubmitted' ||
              row.overallStatus === 'HRPending' ||
              row.overallStatus === 'Finalized'
            ) {
              actions.push({
                label: 'View',
                onClick: () => router.push(`/${tenantSlug}/hr/appraisal/${row.id}`),
              });
            }
            return actions;
          }}
          currentPage={teamPage}
          totalPages={teamTotalPages}
          onPageChange={setTeamPage}
        />
      )}

      {/* HR Appraisals */}
      {activeTab === 'hr' && (
        <DataTable
          columns={hrColumns}
          data={hrCycles}
          isLoading={hrLoading}
          emptyMessage="No appraisal cycles created yet"
          searchPlaceholder="Search cycles..."
          onSearch={(q) => {
            setHrSearch(q);
            setHrPage(1);
          }}
          currentPage={hrPage}
          totalPages={hrTotalPages}
          onPageChange={setHrPage}
        />
      )}
    </div>
  );
}
