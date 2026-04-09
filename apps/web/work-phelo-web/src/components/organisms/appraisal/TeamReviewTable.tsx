// components/TeamReviewTable.tsx
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatDate } from '@/lib/formatters';
import { Column, DataTable } from '../shared/DataTable';
import { api } from '@/lib/api';

const PAGE_SIZE = 10;

interface Props {
  search: string;
  onSearch: (q: string) => void;
  page: number;
  onPageChange: (page: number) => void;
}

export function TeamReviewTable({ search, onSearch, page, onPageChange }: Props) {
  const router = useRouter();

  const { data: teamData, isLoading } = useQuery({
    queryKey: ['team-appraisals'],
    queryFn: () => api.get('/hr/appraisals/team').then((r) => r.data),
  });

  const teamRows = useMemo(() => {
    const list = Array.isArray(teamData) ? teamData : (teamData?.data ?? []);
    return list.map((r: any) => ({
      id: String(r.id),
      employeeId: String(r.employeeId),
      employeeName: String(r.employeeName ?? ''),
      cycleId: String(r.cycleId),
      cycleName: String(r.cycleName ?? ''),
      selfSubmittedAt: r.selfSubmittedAt ? String(r.selfSubmittedAt) : undefined,
      managerReviewDeadline: String(r.managerReviewDeadline ?? ''),
      overallStatus: r.overallStatus ?? 'NotStarted',
    }));
  }, [teamData]);

  const filteredRows = useMemo(() => {
    if (!search) return teamRows;
    const q = search.toLowerCase();
    return teamRows.filter(
      (r) => r.employeeName.toLowerCase().includes(q) || r.cycleName.toLowerCase().includes(q),
    );
  }, [teamRows, search]);

  const pageData = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const columns: Column<any>[] = [
    {
      key: 'employeeName',
      label: 'Employee',
      render: (r) => <span className="font-medium text-gray-900">{r.employeeName}</span>,
    },
    {
      key: 'cycleName',
      label: 'Cycle',
      render: (r) => <span className="text-gray-700">{r.cycleName}</span>,
    },
    {
      key: 'selfSubmittedAt',
      label: 'Self Submitted',
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
      render: (r) => (
        <span className="text-sm text-gray-700">{formatDate(r.managerReviewDeadline)}</span>
      ),
    },
    {
      key: 'daysLeft',
      label: 'Days Left',
      render: (r) => {
        const days = daysUntil(r.managerReviewDeadline);
        return (
          <span
            className={`font-semibold text-sm ${days < 0 ? 'text-red-500' : days <= 3 ? 'text-orange-500' : 'text-gray-700'}`}
          >
            {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
          </span>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={pageData}
      isLoading={isLoading}
      searchPlaceholder="Search employee or cycle..."
      onSearch={onSearch}
      currentPage={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      emptyMessage="No team members have active appraisals"
    />
  );
}
