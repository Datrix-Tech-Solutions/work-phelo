'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column, RowAction } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Badge, BadgeProps } from '@/components/atoms/Badge';
import { useToast } from '@/hooks/useToast';
import { usePermission } from '@/hooks/hr/usePermission';
import { useCloseJobOpening, useJobOpenings } from '@/hooks/hr/useRecruitment';
import { Permission } from '@/lib/permissionMap';
import { formatDate } from '@/lib/formatters';
import { extractError } from '@/lib/extractError';
import type { EmploymentType } from '@/types/hr';
import type { JobOpeningStatus, RecruitmentVacancy } from '@/types/recruitment';

const PAGE_SIZE = 8;

const TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: 'Full Time',
  PART_TIME: 'Part Time',
  CONTRACT: 'Contract',
  INTERN: 'Intern',
};

const STATUS_BADGES: Record<JobOpeningStatus, { label: string; variant: BadgeProps['variant'] }> = {
  DRAFT: { label: 'Draft', variant: 'neutral' },
  OPEN: { label: 'Open', variant: 'success' },
  CLOSED: { label: 'Closed', variant: 'danger' },
};

export function JobOpeningsTable() {
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const toast = useToast();
  const canCreate = usePermission(Permission.CREATE_RECRUITMENT_VACANCY);
  const canUpdate = usePermission(Permission.UPDATE_RECRUITMENT_VACANCY);
  const canClose = usePermission(Permission.CLOSE_RECRUITMENT_VACANCY);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [closeTarget, setCloseTarget] = useState<RecruitmentVacancy | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useJobOpenings({ search: debouncedSearch, page, limit: PAGE_SIZE });
  const { mutate: closeJobOpening, isPending: isClosing } = useCloseJobOpening();

  const openings = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.meta.total ?? 0) / PAGE_SIZE));
  const basePath = `/${params.tenantSlug}/hr/recruitment/job-openings`;

  const columns: Column<RecruitmentVacancy>[] = [
    {
      key: 'title',
      label: 'Job Title',
      width: 'minmax(200px, 2fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.title ?? 'Untitled'}</span>,
    },
    {
      key: 'department',
      label: 'Department',
      width: 'minmax(130px, 1.2fr)',
      render: (row) => <span className="text-sm text-gray-600">{row.department?.name ?? '—'}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      width: '120px',
      render: (row) => (
        <span className="text-sm text-gray-600">
          {row.jobType ? TYPE_LABELS[row.jobType] : '—'}
        </span>
      ),
    },
    {
      key: 'applicants',
      label: 'Applicants',
      width: '100px',
      render: (row) => (
        <span className="text-sm font-medium text-gray-700">{row.applicantCount}</span>
      ),
    },
    {
      key: 'closingDate',
      label: 'Closing Date',
      width: '130px',
      render: (row) => (
        <span className="text-sm text-gray-600">
          {row.closingDate ? formatDate(row.closingDate) : '—'}
        </span>
      ),
    },
    {
      key: 'branch',
      label: 'Branch',
      width: 'minmax(120px, 1.2fr)',
      render: (row) => <span className="text-sm text-gray-600">{row.branch?.name ?? '—'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '100px',
      render: (row) => {
        const { label, variant } = STATUS_BADGES[row.status];
        return <Badge label={label} variant={variant} />;
      },
    },
  ];

  const rowActions = (row: RecruitmentVacancy): RowAction[] => [
    ...(canUpdate
      ? [{ label: 'Edit', onClick: () => router.push(`${basePath}/${row.id}/edit`) }]
      : []),
    ...(canClose && row.status !== 'CLOSED'
      ? [{ label: 'Close', danger: true, onClick: () => setCloseTarget(row) }]
      : []),
  ];

  const confirmClose = () => {
    if (!closeTarget) return;
    closeJobOpening(closeTarget.id, {
      onSuccess: () => {
        toast.success('Job opening closed');
        setCloseTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to close job opening')),
    });
  };

  return (
    <div className="flex flex-col">
      <DataTable
        columns={columns}
        data={openings}
        isLoading={isLoading}
        searchPlaceholder="Search job openings..."
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        {...(canCreate && {
          actionButton: {
            label: 'New Job Opening',
            onClick: () => router.push(`${basePath}/new`),
          },
        })}
        rowActions={rowActions}
        singleActionAsButton={false}
        emptyMessage="No job openings found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <Modal
        isOpen={!!closeTarget}
        onClose={() => setCloseTarget(null)}
        title="Close Job Opening"
        description={`Close "${closeTarget?.title ?? 'this job opening'}"? It will stop accepting applications. Existing applicants are kept.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCloseTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isClosing}
              loadingText="Closing…"
              onClick={confirmClose}
            >
              Close Job Opening
            </Button>
          </div>
        }
      />
    </div>
  );
}
