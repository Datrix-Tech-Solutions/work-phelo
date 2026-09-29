'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { useProspects } from '@/hooks/marketing/useProspects';
import { AllProspectsTable, Prospect } from '@/components/molecules/marketing/AllProspectsTable';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';
import { ProspectListItem } from '@/types/marketing';

const PAGE_SIZE = 10;

function toRow(item: ProspectListItem): Prospect {
  return {
    id: item.id,
    prospectName: item.companyName,
    expectedRevenue: item.expectedValue,
    product: item.products.map((p) => p.name).join(', ') || '—',
    contactNo: item.primaryContact?.phone ?? '',
    salesStage: item.salesStage.name,
    decisionMaker: item.primaryContact?.decisionMaker?.name ?? '',
    lastInteraction: item.lastInteractionDate ?? '',
  };
}

export default function AllProspectsPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useProspects({
    page,
    limit: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
  });

  const rows = useMemo(() => (data?.data ?? []).map(toRow), [data]);
  const totalPages = Math.max(1, data?.meta.totalPages ?? 1);

  function handleRowClick(row: Prospect) {
    router.push(
      `/${tenantSlug}/marketing/prospects/all/${row.id}?name=${encodeURIComponent(row.prospectName)}`,
    );
  }

  if (isError) {
    return (
      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
        <p className="text-sm text-red-500 text-center py-8">Failed to load prospects.</p>
      </div>
    );
  }

  return (
    <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
      <AllProspectsTable
        data={rows}
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRowClick={handleRowClick}
        onAdd={() => router.push(`/${tenantSlug}/marketing/prospects/all/new`)}
        isLoading={isLoading}
      />
    </div>
  );
}
