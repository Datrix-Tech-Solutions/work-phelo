'use client';

import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { DetailField } from '@/components/atoms/DetailField';
import {
  Column,
  DataTable,
  RowAction,
} from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import {
  PlacementClaimCashCall,
  PlacementClaimCashCallStatus,
} from '@/types/reinsurance';

interface ClaimCashCallsTableProps {
  cashCalls: PlacementClaimCashCall[];
  isLoading: boolean;
  isError: boolean;
  busyCashCallId: string | null;
  onIssue: (cashCall: PlacementClaimCashCall) => void;
  onVoid: (cashCall: PlacementClaimCashCall, voidReason: string) => void;
  onPreviewEmail: (cashCall: PlacementClaimCashCall) => void;
}

const STATUS_LABEL: Record<PlacementClaimCashCallStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  PAID: 'Paid',
  VOID: 'Void',
};

const STATUS_VARIANT: Record<
  PlacementClaimCashCallStatus,
  'neutral' | 'warning' | 'success' | 'danger'
> = {
  DRAFT: 'neutral',
  ISSUED: 'warning',
  PAID: 'success',
  VOID: 'danger',
};

function fmtAmount(value: string, currency: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function ClaimCashCallsTable({
  cashCalls,
  isLoading,
  isError,
  busyCashCallId,
  onIssue,
  onVoid,
  onPreviewEmail,
}: ClaimCashCallsTableProps) {
  const [viewTarget, setViewTarget] =
    useState<PlacementClaimCashCall | null>(null);
  const [voidTarget, setVoidTarget] =
    useState<PlacementClaimCashCall | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const columns: Column<PlacementClaimCashCall>[] = [
    {
      key: 'cashCallNumber',
      label: 'Cash Call No.',
      width: '1.2fr',
      render: (row) => (
        <span className="font-medium text-gray-900">{row.cashCallNumber}</span>
      ),
    },
    {
      key: 'counterparty',
      label: 'Counterparty',
      width: '1.5fr',
      render: (row) => (
        <span className="text-gray-700">{row.counterparty.name}</span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      width: '1fr',
      className: 'text-right',
      render: (row) => (
        <span className="block text-right font-medium text-gray-900">
          {fmtAmount(row.amount, row.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '0.8fr',
      render: (row) =>
        busyCashCallId === row.id ? (
          <span className="text-xs font-medium text-gray-500">Updating…</span>
        ) : (
          <Badge
            label={STATUS_LABEL[row.status]}
            variant={STATUS_VARIANT[row.status]}
          />
        ),
    },
    {
      key: 'issuedAt',
      label: 'Issue Date',
      width: '0.9fr',
      render: (row) => (
        <span className="text-gray-600">{fmtDate(row.issuedAt)}</span>
      ),
    },
  ];

  const rowActions = (cashCall: PlacementClaimCashCall): RowAction[] => {
    const actions: RowAction[] = [
      {
        label: 'View',
        onClick: () => setViewTarget(cashCall),
      },
      {
        label: 'Preview Email',
        onClick: () => onPreviewEmail(cashCall),
      },
    ];

    if (cashCall.status === 'DRAFT' && busyCashCallId !== cashCall.id) {
      actions.push({
        label: 'Issue',
        onClick: () => onIssue(cashCall),
      });
    }
    if (
      (cashCall.status === 'DRAFT' || cashCall.status === 'ISSUED') &&
      busyCashCallId !== cashCall.id
    ) {
      actions.push({
        label: 'Void',
        danger: true,
        onClick: () => {
          setVoidReason('');
          setVoidTarget(cashCall);
        },
      });
    }
    return actions;
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1 px-1">
          <span className="text-sm font-bold text-gray-900">
            Cash Call History
          </span>
          <span className="text-xs text-gray-500">
            Saved cash calls for this claim. Email remains preview-only in
            Phase 1.
          </span>
        </div>
        <DataTable
          columns={columns}
          data={cashCalls}
          isLoading={isLoading}
          emptyMessage={
            isError
              ? 'Unable to load cash calls'
              : 'No cash calls have been created for this claim'
          }
          currentPage={1}
          totalPages={1}
          onPageChange={() => {}}
          noInternalScroll
          rowActions={rowActions}
        />
      </div>

      <Modal
        isOpen={!!viewTarget}
        onClose={() => setViewTarget(null)}
        title={viewTarget?.cashCallNumber ?? 'Cash Call'}
        description="Persisted backend cash-call record."
        footer={
          <Button variant="secondary" onClick={() => setViewTarget(null)}>
            Close
          </Button>
        }
      >
        {viewTarget && (
          <div className="mt-4 flex flex-col gap-3">
            <DetailField
              horizontal
              label="Counterparty"
              value={viewTarget.counterparty.name}
            />
            <DetailField
              horizontal
              label="Amount"
              value={fmtAmount(viewTarget.amount, viewTarget.currency)}
            />
            <DetailField
              horizontal
              label="Signed Line"
              value={`${viewTarget.signedLinePercent}%`}
            />
            <DetailField
              horizontal
              label="Status"
              value={STATUS_LABEL[viewTarget.status]}
            />
            <DetailField
              horizontal
              label="Issue Date"
              value={fmtDate(viewTarget.issuedAt)}
            />
            {viewTarget.voidReason && (
              <DetailField
                horizontal
                label="Void Reason"
                value={viewTarget.voidReason}
              />
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!voidTarget}
        onClose={() => {
          setVoidTarget(null);
          setVoidReason('');
        }}
        title="Void cash call"
        description="Provide a reason before voiding this cash call. The record remains in history for audit."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setVoidTarget(null);
                setVoidReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={busyCashCallId === voidTarget?.id}
              disabled={!voidReason.trim()}
              onClick={() => {
                if (!voidTarget || !voidReason.trim()) return;
                onVoid(voidTarget, voidReason.trim());
                setVoidTarget(null);
                setVoidReason('');
              }}
            >
              Void Cash Call
            </Button>
          </>
        }
      >
        <textarea
          value={voidReason}
          onChange={(event) => setVoidReason(event.target.value)}
          placeholder="Reason for voiding this cash call"
          className="mt-4 min-h-28 w-full rounded-input border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-gray-400"
        />
      </Modal>
    </>
  );
}
