'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { usePermission } from '@/hooks/hr/usePermission';
import { useRedirectWhenDenied } from '@/hooks/hr/useRedirectWhenDenied';
import {
  useCandidate,
  useCandidateInterviews,
  useCandidateStageHistory,
  useRecruitmentStages,
  useVacancyRequirements,
} from '@/hooks/hr/useRecruitment';
import { computeMatchScore } from '@/lib/hr/candidateMatch';
import { Permission } from '@/lib/permissionMap';
import { pageBreadcrumb, pagePx, pageContent } from '@/lib/layout';
import { EmployeeDetailSkeleton } from '@/components/molecules/hr/employees/employeeDetailSkeleton';
import { CandidateBanner } from '@/components/molecules/hr/recruitment/CandidateBanner';
import { CandidateOverviewTab } from '@/components/molecules/hr/recruitment/CandidateOverviewTab';
import { CandidateDocumentsTab } from '@/components/molecules/hr/recruitment/CandidateDocumentsTab';
import { CandidateInterviewsTab } from '@/components/molecules/hr/recruitment/CandidateInterviewsTab';
import { ScheduleInterviewPanel } from '@/components/organisms/hr/recruitment/ScheduleInterviewPanel';
import { ChangeCandidateStageModal } from '@/components/molecules/hr/recruitment/ChangeCandidateStageModal';
import { candidateFullName } from '@/components/molecules/hr/recruitment/candidateUtils';

type CandidateTab = 'overview' | 'documents' | 'interviews';

export default function CandidateDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const listPath = `/${tenantSlug}/hr/recruitment/candidates`;

  const canView = usePermission(Permission.READ_RECRUITMENT_CANDIDATES);
  const canChangeStage = usePermission(Permission.UPDATE_RECRUITMENT_CANDIDATE_STAGE);
  const canScheduleInterview = usePermission(Permission.SCHEDULE_RECRUITMENT_INTERVIEW);
  useRedirectWhenDenied(canView === false, `/${tenantSlug}/hr/recruitment`);

  const [activeTab, setActiveTab] = useState<CandidateTab>('overview');
  const [changingStage, setChangingStage] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const { data: candidate, isLoading } = useCandidate(canView ? id : '');
  const canReadStages = usePermission(Permission.READ_RECRUITMENT_STAGES);
  const canReadVacancies = usePermission(Permission.READ_RECRUITMENT_VACANCIES);
  const { data: history = [] } = useCandidateStageHistory(canView ? id : '');
  const { data: stages = [] } = useRecruitmentStages(canReadStages === true);
  const { data: requirements } = useVacancyRequirements(
    candidate?.vacancyId ?? '',
    canReadVacancies === true,
  );
  const { data: interviews = [], isLoading: interviewsLoading } = useCandidateInterviews(
    canView ? id : '',
  );

  if (!canView) return null;
  if (isLoading) return <EmployeeDetailSkeleton />;

  if (!candidate) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-center text-sm text-gray-400">
        Candidate not found.{' '}
        <Link href={listPath} className="text-gray-700 underline">
          Back to candidates
        </Link>
      </div>
    );
  }

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'documents', label: 'Documents' },
    { key: 'interviews', label: 'Interviews', count: interviews.length },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageBreadcrumb} shrink-0`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={listPath} className="hover:text-gray-700 transition-colors">
            Candidates
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">{candidateFullName(candidate)}</span>
        </nav>
      </div>

      <div className={`${pagePx} pb-4 sm:pb-6 shrink-0 relative z-20`}>
        <CandidateBanner
          color="#0047AB"
          candidate={candidate}
          canChangeStage={canChangeStage === true}
          canScheduleInterview={canScheduleInterview === true}
          onChangeStage={() => setChangingStage(true)}
          onScheduleInterview={() => setScheduling(true)}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as CandidateTab)}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className={pageContent}>
          {activeTab === 'overview' && (
            <CandidateOverviewTab
              candidate={candidate}
              stages={stages}
              history={history}
              match={computeMatchScore(candidate, requirements)}
            />
          )}
          {activeTab === 'documents' && <CandidateDocumentsTab candidate={candidate} />}
          {activeTab === 'interviews' && (
            <CandidateInterviewsTab interviews={interviews} isLoading={interviewsLoading} />
          )}
        </div>
      </div>

      <ScheduleInterviewPanel
        candidate={scheduling ? candidate : null}
        onClose={() => setScheduling(false)}
      />

      <ChangeCandidateStageModal
        candidate={changingStage ? candidate : null}
        onClose={() => setChangingStage(false)}
      />
    </div>
  );
}
