'use client';

import { useState } from 'react';
import { RequestsTable } from '@/components/molecules/marketing/RequestsTable';
import { ConfirmDeleteProspectModal } from '@/components/molecules/marketing/ConfirmDeleteProspectModal';
import { RequestPanel } from '@/components/organisms/marketing/RequestPanel';
import { RequestDetailPanel } from '@/components/organisms/marketing/RequestDetailPanel';
import { ApproveRequestModal } from '@/components/organisms/marketing/ApproveRequestModal';
import { RejectRequestModal } from '@/components/organisms/marketing/RejectRequestModal';
import { useCancelRequest, useRequests } from '@/hooks/marketing/useRequests';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { pageContent } from '@/lib/layout';
import { REQUEST_STATUS_BADGES } from '@/lib/requestOptions';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import type { TransportRequest, TransportRequestStatus } from '@/types/marketing';

const PAGE_SIZE = 10;

interface Props {
  /** Which statuses this tab lists. */
  statuses: TransportRequestStatus[];
  /** The raise-a-request button only belongs on the active tab. */
  allowCreate?: boolean;
}

export function RequestsView({ statuses, allowCreate = false }: Props) {
  const toast = useToast();
  const userId = useAuthStore((s) => s.user?.id);
  const canCreate = usePermissionRule('marketing.requests:CREATE');
  const canEdit = usePermissionRule('marketing.requests:EDIT');
  const canCancel = usePermissionRule('marketing.requests:CANCEL');
  const canApprove = usePermissionRule('marketing.requests.all:APPROVE');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<TransportRequest | null>(null);
  const [viewing, setViewing] = useState<TransportRequest | null>(null);
  const [approving, setApproving] = useState<TransportRequest | null>(null);
  const [rejecting, setRejecting] = useState<TransportRequest | null>(null);
  const [cancelling, setCancelling] = useState<TransportRequest | null>(null);

  const { data, isLoading, isError } = useRequests({
    page,
    limit: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
    status: statusFilter ? [statusFilter as TransportRequestStatus] : statuses,
  });
  const cancelRequest = useCancelRequest();

  const isOwn = (row: TransportRequest) => row.requester.userId === userId;

  if (isError) {
    return (
      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
        <p className="text-sm text-red-500 text-center py-8">Failed to load requests.</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
        <RequestsTable
          data={data?.data ?? []}
          isLoading={isLoading}
          searchValue={search}
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          statusOptions={statuses.map((value) => ({
            value,
            label: REQUEST_STATUS_BADGES[value].label,
          }))}
          statusFilter={statusFilter}
          onStatusFilter={(status) => {
            setStatusFilter(status);
            setPage(1);
          }}
          currentPage={page}
          totalPages={Math.max(1, data?.meta.totalPages ?? 1)}
          onPageChange={setPage}
          onView={setViewing}
          onApprove={canApprove ? setApproving : undefined}
          onReject={canApprove ? setRejecting : undefined}
          canApprove={(row) => row.status === 'PENDING'}
          onAdd={allowCreate && canCreate ? () => setAddOpen(true) : undefined}
          onEdit={canEdit ? setEditing : undefined}
          canEdit={(row) => isOwn(row) && row.status === 'PENDING'}
          onCancel={canCancel ? setCancelling : undefined}
          canCancel={(row) => isOwn(row) && (row.status === 'PENDING' || row.status === 'APPROVED')}
        />
      </div>

      <RequestPanel isOpen={addOpen} onClose={() => setAddOpen(false)} />
      <RequestPanel isOpen={!!editing} request={editing} onClose={() => setEditing(null)} />
      <RequestDetailPanel
        request={viewing}
        onClose={() => setViewing(null)}
        canReview={canApprove}
        onApprove={(row) => {
          setViewing(null);
          setApproving(row);
        }}
        onReject={(row) => {
          setViewing(null);
          setRejecting(row);
        }}
      />
      <ApproveRequestModal request={approving} onClose={() => setApproving(null)} />
      <RejectRequestModal request={rejecting} onClose={() => setRejecting(null)} />

      {cancelling && (
        <ConfirmDeleteProspectModal
          title="Cancel Request"
          verb="Cancelling"
          name={`your trip to ${cancelling.destination}`}
          consequence="withdraws the request"
          warning="You can raise a new request at any time."
          confirmLabel="Cancel Request"
          confirmingLabel="Cancelling…"
          isDeleting={cancelRequest.isPending}
          onCancel={() => setCancelling(null)}
          onConfirm={() =>
            cancelRequest.mutate(cancelling.id, {
              onSuccess: () => {
                toast.success('Request cancelled');
                setCancelling(null);
              },
              onError: (error) => toast.error(apiErrorMessage(error, 'Failed to cancel request')),
            })
          }
        />
      )}
    </>
  );
}
