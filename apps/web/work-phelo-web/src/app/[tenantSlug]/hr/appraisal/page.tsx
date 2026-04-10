// ADMIN APRAISAL PAGE //

'use client';

import { use, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { AppraisalTabs } from '@/components/organisms/appraisal/AppraisalTab';
import { MyAppraisalsTable } from '@/components/organisms/appraisal/MyAppraisalTable';
import { TeamReviewTable } from '@/components/organisms/appraisal/TeamReviewTable';
import { HRAppraisalsTable } from '@/components/organisms/appraisal/HRAppraisalTable';

export default function AppraisalPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  use(params);
  const user = useAuthStore((s) => s.user);

  const isHR = user?.role === 'TENANT_ADMIN';
  const isManager = isHR || user?.isManager === true;

  const [activeTab, setActiveTab] = useState<'my' | 'team' | 'hr'>('my');
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
        isManager={isManager}
        isHR={isHR}
        onTabChange={setActiveTab}
      />

      {activeTab === 'my' && (
        <MyAppraisalsTable
          search={mySearch}
          onSearch={setMySearch}
          page={myPage}
          onPageChange={setMyPage}
        />
      )}

      {activeTab === 'team' && isManager && (
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
