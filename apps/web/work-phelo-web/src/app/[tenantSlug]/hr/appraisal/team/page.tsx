'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useIsManager } from '@/hooks/hr/useIsManager';
import { TeamReviewTable } from '@/components/organisms/hr/appraisal/TeamReviewTable';
import { pageHeader, pageContent } from '@/lib/layout';

export default function TeamReviewPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const { isManager, isLoading } = useIsManager();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isLoading && !isManager) {
      router.replace(`/${tenantSlug}/hr/appraisal`);
    }
  }, [isLoading, isManager, tenantSlug, router]);

  if (!isManager) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-bold text-gray-900">Team Review</h1>
      </div>
      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto flex flex-col`}>
        <TeamReviewTable search={search} onSearch={setSearch} page={page} onPageChange={setPage} />
      </div>
    </div>
  );
}
