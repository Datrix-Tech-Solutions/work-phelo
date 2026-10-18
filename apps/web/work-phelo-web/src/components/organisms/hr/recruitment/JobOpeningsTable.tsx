'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column, RowAction } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { ShareJobOpeningModal } from './ShareJobOpeningModal';
import { Badge, BadgeProps } from '@/components/atoms/Badge';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/hooks/useToast';
import { usePermission } from '@/hooks/hr/usePermission';
import {
  useCloseJobOpening,
  useJobOpenings,
  usePublishJobOpening,
  useReopenJobOpening,
} from '@/hooks/hr/useRecruitment';
import { Permission } from '@/lib/permissionMap';
import { formatDate } from '@/lib/formatters';
import { extractError } from '@/lib/extractError';
import type { EmploymentType } from '@/types/hr';
import type { JobOpeningStatus, RecruitmentVacancy } from '@/types/recruitment';

const PAGE_SIZE = 8;
const CAREERS_SITE_URL = (
  process.env.NEXT_PUBLIC_CAREERS_SITE_URL ?? 'http://localhost:3001'
).replace(/\/$/, '');

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
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  const toast = useToast();
  const canCreate = usePermission(Permission.CREATE_RECRUITMENT_VACANCY);
  const canUpdate = usePermission(Permission.UPDATE_RECRUITMENT_VACANCY);
  const canClose = usePermission(Permission.CLOSE_RECRUITMENT_VACANCY);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [closeTarget, setCloseTarget] = useState<RecruitmentVacancy | null>(null);
  const [publishTarget, setPublishTarget] = useState<RecruitmentVacancy | null>(null);
  const [reopenTarget, setReopenTarget] = useState<RecruitmentVacancy | null>(null);
  const [shareTarget, setShareTarget] = useState<RecruitmentVacancy | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useJobOpenings({ search: debouncedSearch, page, limit: PAGE_SIZE });
  const { mutate: closeJobOpening, isPending: isClosing } = useCloseJobOpening();
  const { mutate: publishJobOpening, isPending: isPublishing } = usePublishJobOpening();
  const { mutate: reopenJobOpening, isPending: isReopening } = useReopenJobOpening();

  const openings = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.meta.total ?? 0) / PAGE_SIZE));
  const basePath = `/${params.tenantSlug}/hr/recruitment/job-openings`;
  const shareLink =
    shareTarget && tenantId ? `${CAREERS_SITE_URL}/jobs/${tenantId}_${shareTarget.id}/apply` : '';

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
    ...(canUpdate && row.status === 'DRAFT'
      ? [{ label: 'Publish', onClick: () => setPublishTarget(row) }]
      : []),
    ...(row.status === 'OPEN' ? [{ label: 'Share', onClick: () => setShareTarget(row) }] : []),
    ...(row.status === 'OPEN'
      ? [
          {
            label: 'View on site',
            onClick: () =>
              window.open(
                `${CAREERS_SITE_URL}/dashboard/jobs/${row.id}`,
                '_blank',
                'noopener,noreferrer',
              ),
          },
        ]
      : []),
    ...(canClose && row.status === 'CLOSED'
      ? [{ label: 'Reopen', onClick: () => setReopenTarget(row) }]
      : []),
    ...(canClose && row.status !== 'CLOSED'
      ? [{ label: 'Close', danger: true, onClick: () => setCloseTarget(row) }]
      : []),
  ];

  const confirmPublish = () => {
    if (!publishTarget) return;
    publishJobOpening(publishTarget.id, {
      onSuccess: () => {
        toast.success('Job opening published');
        setPublishTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to publish job opening')),
    });
  };

  const confirmReopen = () => {
    if (!reopenTarget) return;
    reopenJobOpening(reopenTarget.id, {
      onSuccess: () => {
        toast.success('Job opening reopened');
        setReopenTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to reopen job opening')),
    });
  };

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
        onRowClick={(row) => router.push(`${basePath}/${row.id}`)}
        rowActions={rowActions}
        singleActionAsButton={false}
        emptyMessage="No job openings found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <ShareJobOpeningModal
        opening={shareTarget}
        link={shareLink}
        onClose={() => setShareTarget(null)}
      />

      <Modal
        isOpen={!!publishTarget}
        onClose={() => setPublishTarget(null)}
        title="Publish Job Opening"
        description={`Publish "${publishTarget?.title ?? 'this job opening'}"? It will appear on the public job board and start accepting applications.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setPublishTarget(null)}>
              Cancel
            </Button>
            <Button isLoading={isPublishing} loadingText="Publishing…" onClick={confirmPublish}>
              Publish
            </Button>
          </div>
        }
      />

      <Modal
        isOpen={!!reopenTarget}
        onClose={() => setReopenTarget(null)}
        title="Reopen Job Opening"
        description={`Reopen "${reopenTarget?.title ?? 'this job opening'}"? It will appear on the public job board and accept applications again.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setReopenTarget(null)}>
              Cancel
            </Button>
            <Button isLoading={isReopening} loadingText="Reopening…" onClick={confirmReopen}>
              Reopen
            </Button>
          </div>
        }
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
