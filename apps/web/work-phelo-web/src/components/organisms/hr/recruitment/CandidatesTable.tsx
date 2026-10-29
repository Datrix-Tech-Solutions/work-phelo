'use client';

import { useEffect, useMemo, useState } from 'react';
import { Briefcase, CalendarClock } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { ScheduleInterviewPanel } from '@/components/organisms/hr/recruitment/ScheduleInterviewPanel';
import { ChangeCandidateStageModal } from '@/components/molecules/hr/recruitment/ChangeCandidateStageModal';
import { DataTable, Column, RowAction } from '@/components/organisms/shared/DataTable';
import { DataCardGrid } from '@/components/organisms/shared/DataCardGrid';
import { DataCard, DataCardAction } from '@/components/organisms/shared/DataCard';
import { ViewModeToggle, type ViewMode } from '@/components/atoms/ViewModeToggle';
import { Avatar } from '@/components/atoms/Avatar';
import { Badge, BadgeProps } from '@/components/atoms/Badge';
import { TypeChip, type TypeChipColor } from '@/components/atoms/TypeChip';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import {
  InviteEmployeePanel,
  type InviteEmployeeDefaults,
} from '@/components/organisms/hr/employee/inviteEmployeePanel';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { usePermission } from '@/hooks/hr/usePermission';
import {
  useCandidates,
  useCandidate,
  useJobOpening,
  useJobOpenings,
  useMoveCandidateStage,
  useRecruitmentStages,
} from '@/hooks/hr/useRecruitment';
import { Permission } from '@/lib/permissionMap';
import { formatDate } from '@/lib/formatters';
import type { RecruitmentCandidate } from '@/types/recruitment';

const PAGE_SIZE = 10;

function isHired(c: RecruitmentCandidate): boolean {
  return c.currentStage?.name.trim().toLowerCase() === 'hired';
}

function stageVariant(name: string): BadgeProps['variant'] {
  switch (name.toLowerCase()) {
    case 'hired':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'offer':
      return 'warning';
    case 'screening':
    case 'interview':
      return 'info';
    default:
      return 'neutral';
  }
}

/** Colour of a candidate's score: strong from 70, partial from 40, weak below. */
function scoreChipColor(score: number): TypeChipColor {
  if (score >= 70) return 'green';
  if (score >= 40) return 'amber';
  return 'red';
}

function candidateName(c: RecruitmentCandidate): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed candidate';
}

function CardInfoRow({ icon: Icon, value }: { icon: typeof Briefcase; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <Icon size={14} className="shrink-0 text-gray-400" />
      <span className="truncate" title={value}>
        {value}
      </span>
    </div>
  );
}

export function CandidatesTable({ onManage }: { onManage?: () => void } = {}) {
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const canReadCandidate = usePermission(Permission.READ_RECRUITMENT_CANDIDATES);
  const openCandidate = (row: RecruitmentCandidate) =>
    canReadCandidate && router.push(`/${params.tenantSlug}/hr/recruitment/candidates/${row.id}`);
  const canMoveStage = usePermission(Permission.UPDATE_RECRUITMENT_CANDIDATE_STAGE);
  const canSchedule = usePermission(Permission.SCHEDULE_RECRUITMENT_INTERVIEW);
  const canReadStages = usePermission(Permission.READ_RECRUITMENT_STAGES);
  const canReadVacancies = usePermission(Permission.READ_RECRUITMENT_VACANCIES);
  const canOnboard = usePermission(Permission.CREATE_EMPLOYEE);
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [vacancyId, setVacancyId] = useState('');
  const [stageId, setStageId] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const [scheduleTarget, setScheduleTarget] = useState<RecruitmentCandidate | null>(null);
  const [moveTarget, setMoveTarget] = useState<RecruitmentCandidate | null>(null);
  const [onboardTarget, setOnboardTarget] = useState<RecruitmentCandidate | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RecruitmentCandidate | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useCandidates({
    search: debouncedSearch,
    vacancyId,
    stageId,
    page,
    limit: PAGE_SIZE,
  });
  const { data: stages = [] } = useRecruitmentStages(canReadStages === true);
  const { data: vacancies } = useJobOpenings({ limit: 100 });

  const { data: onboardVacancy } = useJobOpening(onboardTarget?.vacancyId ?? '');
  const { data: onboardDetail } = useCandidate(canReadCandidate ? (onboardTarget?.id ?? '') : '');
  const { data: allEmployees } = useAllEmployees(undefined, { enabled: !!onboardTarget });
  const { mutate: moveStage, isPending: isRejecting } = useMoveCandidateStage();
  const rejectedStage = stages.find((s) => s.name.trim().toLowerCase() === 'rejected');

  const onboardDefaults = useMemo<InviteEmployeeDefaults | undefined>(() => {
    if (!onboardTarget) return undefined;
    return {
      firstName: onboardTarget.firstName ?? '',
      lastName: onboardTarget.lastName ?? '',
      email: onboardDetail?.email ?? '',
      phone: onboardDetail?.phone ?? '',
      jobTitle: onboardVacancy?.title ?? onboardTarget.vacancy.title ?? '',
      departmentId: onboardVacancy?.departmentId ?? undefined,
      branchId: onboardVacancy?.branchId ?? undefined,
      employmentType: onboardVacancy?.jobType ?? 'FULL_TIME',
    };
  }, [onboardTarget, onboardVacancy, onboardDetail]);

  const confirmReject = () => {
    if (!rejectTarget || !rejectedStage) return;
    moveStage(
      { id: rejectTarget.id, stageId: rejectedStage.id },
      {
        onSuccess: () => {
          toast.success('Candidate rejected');
          setRejectTarget(null);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to reject candidate')),
      },
    );
  };

  const candidates = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.meta.total ?? 0) / PAGE_SIZE));

  const stageOptions = useMemo(() => stages.map((s) => ({ value: s.id, label: s.name })), [stages]);
  const vacancyOptions = useMemo(
    () =>
      (vacancies?.items ?? [])
        .filter((v) => v.title)
        .map((v) => ({ value: v.id, label: v.title as string })),
    [vacancies],
  );

  const columns: Column<RecruitmentCandidate>[] = [
    {
      key: 'candidate',
      label: 'Candidate',
      width: 'minmax(160px, 1fr)',
      render: (row) => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={candidateName(row)} size="sm" />
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-gray-900 truncate">{candidateName(row)}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'jobRole',
      label: 'Job Role',
      width: 'minmax(160px,1fr)',
      render: (row) => <span className="text-sm text-gray-600">{row.vacancy.title ?? '—'}</span>,
    },
    {
      key: 'appliedAt',
      label: 'Date Applied',
      width: '100px',
      render: (row) => (
        <span className="text-sm text-gray-600">
          {formatDate(row.submittedAt ?? row.appliedAt)}
        </span>
      ),
    },
    {
      key: 'score',
      label: 'Score',
      width: '100px',
      render: (row) =>
        row.matchScore === null ? (
          <span className="text-sm text-gray-400">—</span>
        ) : (
          <TypeChip label={`${row.matchScore}%`} color={scoreChipColor(row.matchScore)} />
        ),
    },
    {
      key: 'stage',
      label: 'Stage',
      width: '130px',
      render: (row) =>
        row.currentStage ? (
          <Badge label={row.currentStage.name} variant={stageVariant(row.currentStage.name)} />
        ) : (
          <span className="text-sm text-gray-400">—</span>
        ),
    },
  ];

  const canReject = canMoveStage && canReadStages && !!rejectedStage;

  // A hired candidate only has two ways forward: onboard them as an employee, or reject.
  const hiredRowActions = (row: RecruitmentCandidate): RowAction[] => [
    ...(canOnboard ? [{ label: 'Onboard', onClick: () => setOnboardTarget(row) }] : []),
    ...(canReject ? [{ label: 'Reject', danger: true, onClick: () => setRejectTarget(row) }] : []),
  ];

  const rowActions = (row: RecruitmentCandidate): RowAction[] =>
    isHired(row)
      ? hiredRowActions(row)
      : [
          ...(canMoveStage && canReadStages
            ? [
                {
                  label: 'Change Stage',
                  onClick: () => openMoveModal(row),
                },
              ]
            : []),
          ...(canSchedule
            ? [{ label: 'Schedule Interview', onClick: () => setScheduleTarget(row) }]
            : []),
        ];

  const openMoveModal = (row: RecruitmentCandidate) => {
    setMoveTarget(row);
  };

  const cardActions = (row: RecruitmentCandidate): DataCardAction[] =>
    isHired(row)
      ? [
          ...(canOnboard
            ? [
                {
                  label: 'Onboard',
                  onClick: () => setOnboardTarget(row),
                  className: 'bg-green-50 text-green-700 hover:bg-green-100',
                },
              ]
            : []),
          ...(canReject
            ? [
                {
                  label: 'Reject',
                  onClick: () => setRejectTarget(row),
                  className: 'bg-red-50 text-red-600 hover:bg-red-100',
                },
              ]
            : []),
        ]
      : [
          ...(canMoveStage && canReadStages
            ? [
                {
                  label: 'Change Stage',
                  onClick: () => openMoveModal(row),
                  className: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
                },
              ]
            : []),
          ...(canSchedule
            ? [
                {
                  label: 'Schedule Interview',
                  onClick: () => setScheduleTarget(row),
                  className: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                },
              ]
            : []),
        ];

  const closeMoveModal = () => setMoveTarget(null);

  const toolbarProps = {
    searchPlaceholder: 'Search candidates...',
    searchValue: search,
    onSearch: (q: string) => {
      setSearch(q);
      setPage(1);
    },
    extraFilters: (
      <>
        {canReadVacancies && vacancyOptions.length > 0 && (
          <SearchSelect
            size="sm"
            placeholder="Job role"
            allLabel="All job roles"
            options={vacancyOptions}
            value={vacancyId}
            showAllOption
            onChange={(v) => {
              setVacancyId(v);
              setPage(1);
            }}
          />
        )}
        {stageOptions.length > 0 && (
          <SearchSelect
            size="sm"
            placeholder="Stage"
            allLabel="All stages"
            options={stageOptions}
            value={stageId}
            showAllOption
            onChange={(v) => {
              setStageId(v);
              setPage(1);
            }}
          />
        )}
      </>
    ),
    toolbarTrailing: (
      <>
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
        {onManage && (
          <Button variant="outline" onClick={onManage}>
            Manage recruitment
          </Button>
        )}
      </>
    ),
  };

  return (
    <div className="flex flex-col">
      {viewMode === 'grid' ? (
        <DataCardGrid
          data={candidates}
          isLoading={isLoading}
          renderCard={(row) => (
            <DataCard
              surface="card"
              onClick={() => openCandidate(row)}
              icon={<Avatar name={candidateName(row)} size="md" />}
              title={candidateName(row)}
              badge={
                row.currentStage ? (
                  <Badge
                    label={row.currentStage.name}
                    variant={stageVariant(row.currentStage.name)}
                  />
                ) : undefined
              }
              note={
                <div className="flex flex-col gap-1.5">
                  <CardInfoRow icon={Briefcase} value={row.vacancy.title ?? '—'} />
                  <CardInfoRow
                    icon={CalendarClock}
                    value={formatDate(row.submittedAt ?? row.appliedAt)}
                  />
                </div>
              }
              actions={cardActions(row)}
            />
          )}
          renderSkeleton={() => <div className="h-52 rounded-2xl bg-gray-200 animate-pulse" />}
          emptyMessage="No candidates found"
          {...toolbarProps}
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      ) : (
        <DataTable
          columns={columns}
          data={candidates}
          isLoading={isLoading}
          {...toolbarProps}
          onRowClick={openCandidate}
          rowActions={rowActions}
          singleActionAsButton={false}
          emptyMessage="No candidates found"
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          noInternalScroll
        />
      )}

      <ScheduleInterviewPanel candidate={scheduleTarget} onClose={() => setScheduleTarget(null)} />
      <ChangeCandidateStageModal candidate={moveTarget} onClose={closeMoveModal} />

      {canOnboard && (
        <InviteEmployeePanel
          isOpen={!!onboardTarget}
          onClose={() => setOnboardTarget(null)}
          onSuccess={() => {
            toast.success('Employee invited');
            setOnboardTarget(null);
          }}
          employees={allEmployees?.data ?? []}
          initialValues={onboardDefaults}
        />
      )}

      <Modal
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject Candidate"
        description={`Reject ${rejectTarget ? candidateName(rejectTarget) : 'this candidate'}? They will be moved to Rejected.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isRejecting}
              loadingText="Rejecting…"
              onClick={confirmReject}
            >
              Reject
            </Button>
          </div>
        }
      />
    </div>
  );
}
