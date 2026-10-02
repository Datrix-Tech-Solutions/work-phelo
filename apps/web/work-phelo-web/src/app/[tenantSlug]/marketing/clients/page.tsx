'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { useClients } from '@/hooks/marketing/useClients';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { DataCardGrid } from '@/components/organisms/shared/DataCardGrid';
import { ClientCard } from '@/components/molecules/marketing/ClientCard';
import { AddClientPanel } from '@/components/organisms/marketing/AddClientPanel';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 12;

export default function ClientsPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const canCreate = usePermissionRule('marketing.clients:CREATE');

  const { data, isLoading, isError } = useClients({
    page,
    limit: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
  });

  if (isError) {
    return (
      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
        <p className="text-sm text-red-500 text-center py-8">Failed to load clients.</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
        <DataCardGrid
          data={data?.data ?? []}
          isLoading={isLoading}
          searchPlaceholder="Search clients…"
          searchValue={search}
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          actionButton={
            canCreate ? { label: 'Add Client', onClick: () => setPanelOpen(true) } : undefined
          }
          emptyMessage="No clients found"
          currentPage={page}
          totalPages={Math.max(1, data?.meta.totalPages ?? 1)}
          onPageChange={setPage}
          renderCard={(client) => (
            <ClientCard
              client={client}
              onClick={() => router.push(`/${tenantSlug}/marketing/clients/${client.id}`)}
            />
          )}
        />
      </div>

      <AddClientPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
