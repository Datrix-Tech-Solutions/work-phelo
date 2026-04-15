'use client';

import { useState, useMemo } from 'react';
import { extractError } from '@/lib/extractError';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { BalanceCard } from '@/components/molecules/leave/BalanceCard';
import { ApplyLeavePanel } from '@/components/organisms/leave/ApplyLeavePanel';
import { useLeaveBalances, useMyLeaveRequests, useCancelLeaveRequest } from '@/hooks/useLeave';
import { useToast } from '@/hooks/useToast';
import { formatDate } from '@/lib/formatters';
import { LeaveBalance, LeaveRequest, LeaveRequestStatus } from '@/types/hr';

const STATUS_VARIANT: Record<LeaveRequestStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  Approved: 'success',
  Pending: 'warning',
  Rejected: 'danger',
  Cancelled: 'neutral',
};

const PAGE_SIZE = 10;

interface Props {
  tenantSlug: string;
}

export function MyLeaveTab({ tenantSlug }: Props) {
  const toast = useToast();

  const [applyOpen, setApplyOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null);
  const [mySearch, setMySearch] = useState('');
  const [myPage, setMyPage] = useState(1);

  const { data: balancesRaw } = useLeaveBalances();
  const balancesData: LeaveBalance[] = Array.isArray(balancesRaw)
    ? balancesRaw
    : ((balancesRaw as { data?: LeaveBalance[] } | undefined)?.data ?? []);

  const { data: myData, isLoading: myLoading } = useMyLeaveRequests();

  const myRequests: LeaveRequest[] = useMemo(() => {
    return Array.isArray(myData)
      ? myData
      : ((myData as { data?: LeaveRequest[] } | undefined)?.data ?? []);
  }, [myData]);

  const myFiltered = useMemo(() => {
    if (!mySearch) return myRequests;
    const q = mySearch.toLowerCase();
    return myRequests.filter((r) => r.leaveTypeName.toLowerCase().includes(q));
  }, [myRequests, mySearch]);

  const myPageData = myFiltered.slice((myPage - 1) * PAGE_SIZE, myPage * PAGE_SIZE);
  const myTotalPages = Math.max(1, Math.ceil(myFiltered.length / PAGE_SIZE));

  const { mutate: cancelRequest, isPending: isCancelling } = useCancelLeaveRequest();

  const columns: Column<LeaveRequest>[] = [
    {
      key: 'leaveTypeName',
      label: 'Leave Type',
      render: (r) => <span className="font-medium text-gray-900">{r.leaveTypeName}</span>,
    },
    {
      key: 'paid',
      label: 'Paid',
      render: (r) => (
        <Badge variant={r.isPaid ? 'success' : 'neutral'} label={r.isPaid ? 'Yes' : 'No'} />
      ),
    },
    {
      key: 'totalDays',
      label: 'Days',
      render: (r) => <span className="text-gray-700">{r.totalDays}</span>,
    },
    {
      key: 'usedDays',
      label: 'Total Days',
      render: (r) => {
        const b = balancesData.find((b) => b.leaveTypeId === r.leaveTypeId);
        return <span className="text-gray-700">{b ? b.used : '—'}</span>;
      },
    },
    {
      key: 'carryOver',
      label: 'Carry Over',
      render: (r) => {
        const b = balancesData.find((b) => b.leaveTypeId === r.leaveTypeId);
        return (
          <span className="text-gray-700">{b && b.carriedOver > 0 ? b.carriedOver : '—'}</span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <Badge variant={STATUS_VARIANT[r.status]} label={r.status} />,
    },
    {
      key: 'period',
      label: 'Period',
      render: (r) => (
        <span className="text-xs text-gray-500">
          {formatDate(r.startDate)} – {formatDate(r.endDate)}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-6 flex-1 min-h-0">
        <div className="flex justify-end shrink-0">
          <Button onClick={() => setApplyOpen(true)}>Apply for Leave</Button>
        </div>

        {balancesData.length > 0 && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4 shrink-0">
            {balancesData.map((b) => (
              <BalanceCard key={b.leaveTypeId} balance={b} />
            ))}
          </div>
        )}

        <DataTable
          columns={columns}
          data={myPageData}
          isLoading={myLoading}
          emptyMessage="You have no leave requests yet"
          searchPlaceholder="Search by leave type..."
          onSearch={(q) => {
            setMySearch(q);
            setMyPage(1);
          }}
          currentPage={myPage}
          totalPages={myTotalPages}
          onPageChange={setMyPage}
          rowActions={(row) =>
            row.status === 'Pending'
              ? [{ label: 'Cancel Request', danger: true, onClick: () => setCancelTarget(row) }]
              : []
          }
        />
      </div>

      <ApplyLeavePanel
        isOpen={applyOpen}
        onClose={() => setApplyOpen(false)}
        tenantSlug={tenantSlug}
        balances={balancesData}
      />

      <Modal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel Leave Request"
        description={`Cancel your ${cancelTarget?.leaveTypeName} request from ${cancelTarget ? formatDate(cancelTarget.startDate) : ''} to ${cancelTarget ? formatDate(cancelTarget.endDate) : ''}? This cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>
              Keep Request
            </Button>
            <Button
              variant="danger"
              isLoading={isCancelling}
              loadingText="Cancelling..."
              onClick={() =>
                cancelTarget &&
                cancelRequest(cancelTarget.id, {
                  onSuccess: () => {
                    toast.success('Leave request cancelled');
                    setCancelTarget(null);
                  },
                  onError: (err) => toast.error(extractError(err, 'Something went wrong')),
                })
              }
            >
              Cancel Request
            </Button>
          </div>
        }
      />
    </>
  );
}
