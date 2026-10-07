'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { CampaignsTable } from '@/components/molecules/marketing/CampaignsTable';
import { CampaignDetailPanel } from '@/components/organisms/marketing/CampaignDetailPanel';
import { AddCampaignPanel, CampaignForm } from '@/components/organisms/marketing/AddCampaignPanel';
import {
  useCampaigns,
  useCancelCampaign,
  useCreateCampaign,
  useUpdateCampaign,
  useSendCampaign,
} from '@/hooks/marketing/useCampaigns';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { formatDate } from '@/lib/formatters';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';
import type { Campaign } from '@/types/marketing';

const PAGE_SIZE = 10;

/**
 * The form values to start from; undefined for a brand new campaign. A resend or retry starts as an
 * instant send, while an edit keeps the campaign's own schedule.
 */
function initialFor(campaign: Campaign | null, keepSchedule: boolean) {
  if (!campaign) return undefined;
  return {
    ...(keepSchedule && campaign.dispatchMode === 'SCHEDULED' && campaign.scheduledDate
      ? { dispatch: 'schedule' as const, scheduledDate: campaign.scheduledDate }
      : {}),
    name: campaign.name,
    outreachChannel: campaign.channels,
    targetSegment: campaign.segments.map((segment) => segment.id),
    subject: campaign.subject,
    message: campaign.message,
    senderIdentityId: campaign.senderIdentityId ?? '',
  };
}

export default function CampaignsPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  /** The campaign being resent or retried; the form opens with its details. */
  const [reusing, setReusing] = useState<Campaign | null>(null);
  /** The scheduled campaign being edited; the form opens with its details. */
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [sending, setSending] = useState<Campaign | null>(null);
  const [cancelling, setCancelling] = useState<Campaign | null>(null);
  const canCreate = usePermissionRule('marketing.campaigns:CREATE');
  const canSend = usePermissionRule('marketing.campaigns:RUN');
  const canCancel = usePermissionRule('marketing.campaigns:CANCEL');

  const { data, isLoading, isError } = useCampaigns({
    page,
    limit: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
  });
  // Looked up from the list, so a campaign that is still sending updates as the list refreshes.
  const viewing = data?.data.find((campaign) => campaign.id === viewingId) ?? null;
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const sendCampaign = useSendCampaign();
  const cancelCampaign = useCancelCampaign();

  function handleSubmit(form: CampaignForm) {
    const payload = {
      name: form.name.trim(),
      channels: form.outreachChannel,
      segmentIds: form.targetSegment,
      subject: form.subject.trim(),
      message: form.message.trim(),
      dispatchMode: form.dispatch === 'schedule' ? ('SCHEDULED' as const) : ('INSTANT' as const),
      ...(form.outreachChannel.includes('SMS') && form.senderIdentityId
        ? { senderIdentityId: form.senderIdentityId }
        : {}),
      ...(form.dispatch === 'schedule' && form.scheduledDate
        ? { scheduledDate: form.scheduledDate }
        : {}),
    };
    const done = (success: string, failure: string) => ({
      onSuccess: () => {
        toast.success(success);
        closePanel();
      },
      onError: (error: unknown) => toast.error(apiErrorMessage(error, failure)),
    });
    if (editing) {
      updateCampaign.mutate(
        { id: editing.id, ...payload },
        done('Campaign updated', 'Failed to update campaign'),
      );
    } else {
      createCampaign.mutate(payload, done('Campaign created', 'Failed to create campaign'));
    }
  }

  function openEdit(campaign: Campaign) {
    setViewingId(null);
    setEditing(campaign);
    setPanelOpen(true);
  }

  function openReuse(campaign: Campaign) {
    setViewingId(null);
    setReusing(campaign);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setReusing(null);
    setEditing(null);
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

  function handleSend() {
    if (!sending) return;
    sendCampaign.mutate(sending.id, {
      onSuccess: () => {
        toast.success('Campaign queued for sending');
        setSending(null);
      },
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to send campaign')),
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
          onReuse={canCreate ? openReuse : undefined}
          onEdit={canCreate ? openEdit : undefined}
          onRowClick={(campaign) => setViewingId(campaign.id)}
          onSend={canSend ? setSending : undefined}
          onCancel={canCancel ? setCancelling : undefined}
        />
      </div>

      <CampaignDetailPanel
        campaign={viewing}
        onClose={() => setViewingId(null)}
        onReuse={canCreate ? openReuse : undefined}
        onEdit={canCreate ? openEdit : undefined}
      />

      <AddCampaignPanel
        isOpen={panelOpen}
        onClose={closePanel}
        onSubmit={handleSubmit}
        isSubmitting={createCampaign.isPending || updateCampaign.isPending}
        initial={initialFor(editing ?? reusing, !!editing)}
        title={
          editing
            ? 'Edit Campaign'
            : reusing
              ? reusing.status === 'FAILED'
                ? 'Retry Campaign'
                : 'Resend Campaign'
              : undefined
        }
        description={
          editing
            ? 'Change the details of this scheduled campaign. Recipients are worked out again when you save.'
            : reusing
              ? 'Review the details from the original campaign, then send it again.'
              : undefined
        }
        submitLabel={editing ? 'Save Changes' : undefined}
      />

      <Modal
        isOpen={!!sending}
        onClose={() => setSending(null)}
        title="Send Campaign"
        description={`Send "${sending?.name ?? ''}" now? This will reserve ${sending?.estimatedCredits ?? 0} SMS credits and submit messages to the approved sender provider.`}
        width="max-w-sm"
        height="max-h-fit"
        footer={
          <>
            <Button variant="outline" onClick={() => setSending(null)}>
              Keep Draft
            </Button>
            <Button onClick={handleSend} isLoading={sendCampaign.isPending}>
              Send Campaign
            </Button>
          </>
        }
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
