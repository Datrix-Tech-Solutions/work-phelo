'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RequestsTable } from '@/components/molecules/marketing/RequestsTable';
import { ConfirmDeleteProspectModal } from '@/components/molecules/marketing/ConfirmDeleteProspectModal';
import { RequestPanel } from '@/components/organisms/marketing/RequestPanel';
import { RequestDetailPanel } from '@/components/organisms/marketing/RequestDetailPanel';
import { ApproveRequestModal } from '@/components/organisms/marketing/ApproveRequestModal';
import { RejectRequestModal } from '@/components/organisms/marketing/RejectRequestModal';
import { CompleteTripModal } from '@/components/organisms/marketing/CompleteTripModal';
import { useCancelRequest, useRequest, useRequests } from '@/hooks/marketing/useRequests';
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
  // Everyone can raise, edit, complete and cancel their own requests (the rows below are limited to
  // their own); only approving, and acting on other people's requests, needs a permission.
  const canCreate = true;
  const canEdit = true;
  const canCancel = true;
  const canApprove = usePermissionRule('marketing.requests.all:APPROVE');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<TransportRequest | null>(null);
  const [viewing, setViewing] = useState<TransportRequest | null>(null);

  // A notification links here with ?requestId=…, which opens that request's details whichever
  // tab it lands on.
  const router = useRouter();
  const pathname = usePathname();
  const linkedId = useSearchParams().get('requestId');
  const { data: linked } = useRequest(linkedId ?? undefined);
  const detail = viewing ?? linked ?? null;

  function closeDetail() {
    setViewing(null);
    if (linkedId) router.replace(pathname);
  }
  const [approving, setApproving] = useState<TransportRequest | null>(null);
  const [rejecting, setRejecting] = useState<TransportRequest | null>(null);
  const [rescheduling, setRescheduling] = useState<TransportRequest | null>(null);
  const [completing, setCompleting] = useState<TransportRequest | null>(null);
  const [cancelling, setCancelling] = useState<TransportRequest | null>(null);

  const { data, isLoading, isError } = useRequests({
    page,
    limit: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
    status: statusFilter ? [statusFilter as TransportRequestStatus] : statuses,
  });
  const cancelRequest = useCancelRequest();

  const isOwn = (row: TransportRequest) => row.requester.userId === userId;

  // The requester can act on their own trip; anyone who can approve can act on any, and only
  // approvers can reschedule (it re-allocates a vehicle and driver).
  const isLive = (row: TransportRequest) =>
    row.status === 'PENDING' || row.status === 'APPROVED' || row.status === 'ON_ROUTE';
  const canCancelRow = (row: TransportRequest) =>
    isLive(row) && ((isOwn(row) && canCancel) || canApprove);
  const canCompleteRow = (row: TransportRequest) =>
    row.status === 'ON_ROUTE' && row.overdue && ((isOwn(row) && canEdit) || canApprove);
  const canRescheduleRow = (row: TransportRequest) =>
    canApprove && (row.status === 'APPROVED' || row.status === 'ON_ROUTE');

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
          onCancel={canCancel || canApprove ? setCancelling : undefined}
          canCancel={canCancelRow}
          onReschedule={canApprove ? setRescheduling : undefined}
          canReschedule={canRescheduleRow}
          onComplete={canEdit || canApprove ? setCompleting : undefined}
          canComplete={canCompleteRow}
        />
      </div>

      <RequestPanel isOpen={addOpen} onClose={() => setAddOpen(false)} />
      <RequestPanel isOpen={!!editing} request={editing} onClose={() => setEditing(null)} />
      <RequestDetailPanel
        request={detail}
        onClose={closeDetail}
        canReview={canApprove}
        canReschedule={!!detail && canRescheduleRow(detail)}
        canComplete={!!detail && canCompleteRow(detail)}
        canCancel={!!detail && canCancelRow(detail) && detail.status !== 'PENDING'}
        onApprove={(row) => {
          closeDetail();
          setApproving(row);
        }}
        onReject={(row) => {
          closeDetail();
          setRejecting(row);
        }}
        onReschedule={(row) => {
          closeDetail();
          setRescheduling(row);
        }}
        onComplete={(row) => {
          closeDetail();
          setCompleting(row);
        }}
        onCancel={(row) => {
          closeDetail();
          setCancelling(row);
        }}
      />
      <ApproveRequestModal request={approving} onClose={() => setApproving(null)} />
      <ApproveRequestModal
        request={rescheduling}
        mode="reschedule"
        onClose={() => setRescheduling(null)}
      />
      <RejectRequestModal request={rejecting} onClose={() => setRejecting(null)} />
      <CompleteTripModal request={completing} onClose={() => setCompleting(null)} />

      {cancelling && (
        <ConfirmDeleteProspectModal
          title={cancelling.status === 'PENDING' ? 'Cancel Request' : 'Cancel Trip'}
          verb="Cancelling"
          name={`${isOwn(cancelling) ? 'your' : `${cancelling.requester.name}'s`} trip to ${cancelling.destination}`}
          consequence={
            cancelling.status === 'PENDING'
              ? 'withdraws the request'
              : 'cancels it and frees the vehicle and driver'
          }
          warning={
            cancelling.status === 'PENDING'
              ? 'You can raise a new request at any time.'
              : 'Use this when the trip did not go ahead.'
          }
          confirmLabel={cancelling.status === 'PENDING' ? 'Cancel Request' : 'Cancel Trip'}
          confirmingLabel="Cancelling…"
          isDeleting={cancelRequest.isPending}
          onCancel={() => setCancelling(null)}
          onConfirm={() =>
            cancelRequest.mutate(cancelling.id, {
              onSuccess: () => {
                toast.success(
                  cancelling.status === 'PENDING' ? 'Request cancelled' : 'Trip cancelled',
                );
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
