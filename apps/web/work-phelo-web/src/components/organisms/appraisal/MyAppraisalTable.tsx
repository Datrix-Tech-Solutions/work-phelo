import { useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { RatingBadge } from '@/components/molecules/appraisal/RatingBadge';
import { Button } from '@/components/atoms/Button';
import { Column, DataTable } from '../shared/DataTable';
import { StatusBadge } from '@/components/molecules/shared/StatusBadge';

const PAGE_SIZE = 10;

interface Props {
  search: string;
  onSearch: (q: string) => void;
  page: number;
  onPageChange: (page: number) => void;
}

export function MyAppraisalsTable({ search, onSearch, page, onPageChange }: Props) {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const { data: myData, isLoading } = useQuery({
    queryKey: ['my-appraisals'],
    queryFn: () => api.get('/hr/appraisals/my').then((r) => r.data),
  });

  const myRows = useMemo(() => {
    const list = Array.isArray(myData) ? myData : (myData?.data ?? []);
    return list.map(
      (r: {
        id: unknown;
        cycleId: unknown;
        cycleName?: unknown;
        cycleStatus?: string;
        overallStatus?: string;
        overallScore?: number | null;
        finalRating?: unknown;
        selfAssessmentDeadline?: unknown;
      }) => ({
        id: String(r.id),
        cycleId: String(r.cycleId),
        cycleName: String(r.cycleName ?? ''),
        cycleStatus: r.cycleStatus ?? 'Upcoming',
        overallStatus: r.overallStatus ?? 'NotStarted',
        overallScore: r.overallScore != null ? Number(r.overallScore) : undefined,
        finalRating: r.finalRating,
        selfAssessmentDeadline: String(r.selfAssessmentDeadline ?? ''),
      }),
    );
  }, [myData]);

  const filteredRows = useMemo(() => {
    if (!search) return myRows;
    const q = search.toLowerCase();
    return myRows.filter((r: (typeof myRows)[0]) => r.cycleName.toLowerCase().includes(q));
  }, [myRows, search]);

  const pageData = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  type MyRow = (typeof myRows)[0];
  const columns: Column<MyRow>[] = [
    {
      key: 'cycleName',
      label: 'Cycle',
      render: (r) => <span className="font-medium text-gray-900">{r.cycleName}</span>,
    },
    {
      key: 'overallStatus',
      label: 'Status',
      render: (r) => <StatusBadge status={r.overallStatus} />,
    },
    {
      key: 'finalRating',
      label: 'Rating',
      render: (r) => <RatingBadge rating={r.finalRating} />,
    },
    {
      key: 'overallScore',
      label: 'Score',
      render: (r) =>
        r.overallScore != null ? (
          <span className="font-semibold">{r.overallScore}%</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'action',
      label: '',
      render: (r) => {
        const isStartable = r.overallStatus === 'NotStarted' && r.cycleStatus === 'InProgress';
        return (
          <Button
            size="sm"
            variant={isStartable ? 'primary' : 'secondary'}
            onClick={() =>
              router.push(`/${tenantSlug}/hr/appraisal/cycles/${r.cycleId}/results/${r.id}`)
            }
          >
            {isStartable ? 'Start' : 'View'}
          </Button>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={pageData}
      isLoading={isLoading}
      searchPlaceholder="Search cycles..."
      onSearch={onSearch}
      currentPage={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      emptyMessage="No appraisal cycles assigned to you yet"
    />
  );
}
