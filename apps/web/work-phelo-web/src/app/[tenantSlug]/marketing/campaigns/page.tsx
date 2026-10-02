'use client';

import { useState } from 'react';
import { CampaignsTable, Campaign } from '@/components/molecules/marketing/CampaignsTable';
import { AddCampaignPanel } from '@/components/organisms/marketing/AddCampaignPanel';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 10;

export default function CampaignsPage() {
  const [campaigns] = useState<Campaign[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);

  const filtered = campaigns.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.channel.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
        <CampaignsTable
          data={paginated}
          searchValue={search}
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onAdd={() => setPanelOpen(true)}
        />
      </div>

      <AddCampaignPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSubmit={(data) => {
          console.log('Add campaign:', data);
          setPanelOpen(false);
        }}
      />
    </>
  );
}
