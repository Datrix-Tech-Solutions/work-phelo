// ADMIN APRAISAL PAGE //

'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';
import { AppraisalTabs } from '@/components/molecules/appraisal/AppraisalTabs';
import { MyAppraisalsTable } from '@/components/organisms/appraisal/MyAppraisalTable';
import { TeamReviewTable } from '@/components/organisms/appraisal/TeamReviewTable';
import { HRAppraisalsTable } from '@/components/organisms/appraisal/HRAppraisalTable';

export default function AppraisalPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user !== null && !user.featureConfig?.hr?.appraisal) {
      router.replace(`/${tenantSlug}/hr`);
    }
  }, [user, tenantSlug, router]);
  // isManager comes from the employee profile (department head), not from permissions.
  const isHR = user?.role === 'TENANT_ADMIN';
  const hasHRProfile = user?.role === 'EMPLOYEE';
  const canReviewTeam = usePermission(Permission.SUBMIT_MANAGER_REVIEW);
  // Department head OR explicitly granted manager-review permission
  const canSeeTeamReview = user?.isManager === true || canReviewTeam || isHR;

  // Admin (TENANT_ADMIN) has no personal appraisal record — default to team review.
  // Use getState() so the initializer reads the correct role on first render
  // without needing a useEffect.
  const [activeTab, setActiveTab] = useState<'my' | 'team' | 'hr'>(() => {
    const role = useAuthStore.getState().user?.role;
    return role === 'TENANT_ADMIN' ? 'team' : 'my';
  });
  const [mySearch, setMySearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [hrSearch, setHrSearch] = useState('');
  const [myPage, setMyPage] = useState(1);
  const [teamPage, setTeamPage] = useState(1);
  const [hrPage, setHrPage] = useState(1);

  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      <AppraisalTabs
        activeTab={activeTab}
        isEmployee={hasHRProfile}
        isManager={canSeeTeamReview}
        isHR={isHR}
        onTabChange={setActiveTab}
      />

      {activeTab === 'my' && hasHRProfile && (
        <MyAppraisalsTable
          search={mySearch}
          onSearch={setMySearch}
          page={myPage}
          onPageChange={setMyPage}
        />
      )}

      {activeTab === 'team' && canSeeTeamReview && (
        <TeamReviewTable
          search={teamSearch}
          onSearch={setTeamSearch}
          page={teamPage}
          onPageChange={setTeamPage}
        />
      )}

      {activeTab === 'hr' && isHR && (
        <HRAppraisalsTable
          search={hrSearch}
          onSearch={setHrSearch}
          page={hrPage}
          onPageChange={setHrPage}
        />
      )}
    </div>
  );
}
