'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { useDeleteProspect, useProspect, useProspects } from '@/hooks/marketing/useProspects';
import { AllProspectsTable, Prospect } from '@/components/molecules/marketing/AllProspectsTable';
import { ConvertToClientModal } from '@/components/organisms/marketing/ConvertToClientModal';
import { ConfirmDeleteProspectModal } from '@/components/molecules/marketing/ConfirmDeleteProspectModal';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { pageContent } from '@/lib/layout';
import { formatMoney } from '@/lib/formatMoney';
import { cn } from '@/lib/utils';
import { ProspectListItem } from '@/types/marketing';

const PAGE_SIZE = 10;

function toRow(item: ProspectListItem): Prospect {
  return {
    id: item.id,
    prospectName: item.companyName,
    expectedRevenue: formatMoney(item.expectedValue),
    product: item.products.map((p) => p.name).join(', ') || '—',
    contactNo: item.primaryContact?.phone ?? '',
    salesStage: item.salesStage.name,
    salesStageProgress: item.salesStage.probability,
    decisionMaker: item.primaryContact?.decisionMaker?.name ?? '',
    lastInteraction: item.lastInteractionDate ?? '',
  };
}

export default function AllProspectsPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<Prospect | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const toast = useToast();
  const deleteProspect = useDeleteProspect();

  const { data, isLoading, isError } = useProspects({
    page,
    limit: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
  });

  // The list row doesn't carry the full contact/location details the modal shows.
  const { data: convertingProspect } = useProspect(convertingId ?? '');

  const rows = useMemo(() => (data?.data ?? []).map(toRow), [data]);
  const totalPages = Math.max(1, data?.meta.totalPages ?? 1);

  function handleRowClick(row: Prospect) {
    router.push(`/${tenantSlug}/marketing/prospects/all/${row.id}`);
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return;
    deleteProspect.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success('Prospect deleted');
        // Deleting the last row on a page would otherwise leave us on an empty page.
        if (rows.length === 1 && page > 1) setPage(page - 1);
      },
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to delete prospect')),
      onSettled: () => setPendingDelete(null),
    });
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
        onEdit={(row) => router.push(`/${tenantSlug}/marketing/prospects/all/${row.id}/edit`)}
        onDelete={setPendingDelete}
        onConvertToClient={(row) => setConvertingId(row.id)}
        onAdd={() => router.push(`/${tenantSlug}/marketing/prospects/all/new`)}
        isLoading={isLoading}
      />
      {convertingId && convertingProspect && (
        <ConvertToClientModal
          prospect={convertingProspect}
          isOpen
          onClose={() => setConvertingId(null)}
        />
      )}
      {pendingDelete && (
        <ConfirmDeleteProspectModal
          name={pendingDelete.prospectName}
          isDeleting={deleteProspect.isPending}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
