'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { CampaignsTable } from '@/components/molecules/marketing/CampaignsTable';
import { AddCampaignPanel, CampaignForm } from '@/components/organisms/marketing/AddCampaignPanel';
import { useCampaigns, useCancelCampaign, useCreateCampaign } from '@/hooks/marketing/useCampaigns';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { formatDate } from '@/lib/formatters';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';
import type { Campaign } from '@/types/marketing';

const PAGE_SIZE = 10;

export default function CampaignsPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [cancelling, setCancelling] = useState<Campaign | null>(null);
  const canCreate = usePermissionRule('marketing.campaigns:CREATE');
  const canCancel = usePermissionRule('marketing.campaigns:CANCEL');

  const { data, isLoading, isError } = useCampaigns({
    page,
    limit: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
  });
  const createCampaign = useCreateCampaign();
  const cancelCampaign = useCancelCampaign();

  function handleSubmit(form: CampaignForm) {
    createCampaign.mutate(
      {
        name: form.name.trim(),
        channels: form.outreachChannel,
        businessTypeIds: form.targetSegment,
        subject: form.subject.trim(),
        message: form.message.trim(),
        dispatchMode: form.dispatch === 'schedule' ? 'SCHEDULED' : 'INSTANT',
        ...(form.dispatch === 'schedule' && form.scheduledDate
          ? { scheduledDate: form.scheduledDate }
          : {}),
      },
      {
        onSuccess: () => {
          toast.success('Campaign created');
          setPanelOpen(false);
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to create campaign')),
      },
    );
  }

  function handleCancel() {
    if (!cancelling) return;
    cancelCampaign.mutate(cancelling.id, {
      onSuccess: () => {
        toast.success('Campaign cancelled');
        setCancelling(null);
      },
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to cancel campaign')),
    });
  }

  if (isError) {
    return (
      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
        <p className="text-sm text-red-500 text-center py-8">Failed to load campaigns.</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
        <CampaignsTable
          data={data?.data ?? []}
          isLoading={isLoading}
          searchValue={search}
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          currentPage={page}
          totalPages={Math.max(1, data?.meta.totalPages ?? 1)}
          onPageChange={setPage}
          onAdd={canCreate ? () => setPanelOpen(true) : undefined}
          onCancel={canCancel ? setCancelling : undefined}
        />
      </div>

      <AddCampaignPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSubmit={handleSubmit}
        isSubmitting={createCampaign.isPending}
      />

      <Modal
        isOpen={!!cancelling}
        onClose={() => setCancelling(null)}
        title="Cancel Campaign"
        description={`Are you sure you want to cancel "${cancelling?.name ?? ''}"? It is scheduled for ${cancelling?.scheduledDate ? formatDate(cancelling.scheduledDate) : 'a later date'} and its messages will not be sent. This cannot be undone.`}
        width="max-w-sm"
        height="max-h-fit"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelling(null)}>
              Keep
            </Button>
            <Button variant="danger" onClick={handleCancel} isLoading={cancelCampaign.isPending}>
              Cancel Campaign
            </Button>
          </>
        }
      />
    </>
  );
}
