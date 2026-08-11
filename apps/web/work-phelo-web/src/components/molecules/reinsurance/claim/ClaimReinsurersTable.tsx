'use client';

import { useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { TableButton } from '@/components/atoms/TableButton';
import { fmt, fmtDate } from '@/lib/reinsurance/claimFormat';
import { PlacementClaimAllocation, PlacementParticipant } from '@/types/reinsurance';

interface ClaimReinsurersTableProps {
  participants: PlacementParticipant[];
  allocations: PlacementClaimAllocation[];
  claimAmount?: number | null;
  isActualAmount?: boolean;
  currency?: string | null;
  /** Allocation ids that already have a cash call — Send Mail is a one-shot action per
   * reinsurer, so those rows collapse to a status label instead. */
  sentAllocationIds: Set<string>;
  onMail: (participant: PlacementParticipant) => void;
  onPreview: (participant: PlacementParticipant) => void;
}

type ClaimReinsurerRow = {
  id: string;
  counterpartyId: string;
  reinsurerName: string;
  signedLinePercent: string | null;
  allocationSource: string;
  allocatedAmount: number | null;
  createdAt: string | null;
};

/** Per-reinsurer claim share — real allocation rows once generated, otherwise an estimate
 * derived from accepted participants. This is also where a claim actually gets sent to a
 * reinsurer: Preview shows the debit note, Send Mail raises + issues their cash call. What they
 * pay back afterward is recorded directly against that cash call, in the Cash Calls tab. */
export function ClaimReinsurersTable({
  participants,
  allocations,
  claimAmount,
  isActualAmount,
  currency,
  sentAllocationIds,
  onMail,
  onPreview,
}: ClaimReinsurersTableProps) {
  const rows = useMemo<ClaimReinsurerRow[]>(() => {
    if (allocations.length > 0) {
      return allocations.map((allocation) => ({
        id: allocation.id,
        counterpartyId: allocation.counterpartyId,
        reinsurerName: allocation.counterparty.name,
        signedLinePercent: allocation.signedLinePercent,
        allocationSource:
          allocation.endorsementClosing?.closingNumber ??
          allocation.placementClosing?.closingNumber ??
          'Confirmed closing snapshot',
        allocatedAmount: parseFloat(
          allocation.allocatedFinalLossAmount ?? allocation.allocatedEstimatedLossAmount,
        ),
        createdAt: allocation.createdAt,
      }));
    }

    return participants
      .filter((p) => p.role !== 'BROKER' && (p.status === 'ACCEPTED' || p.status === 'CLOSED'))
      .map((participant) => ({
        id: participant.id,
        counterpartyId: participant.counterpartyId,
        reinsurerName: participant.counterparty.name,
        signedLinePercent: participant.sharePercent,
        allocationSource: 'Estimate before allocation generation',
        allocatedAmount:
          participant.sharePercent != null && claimAmount != null
            ? (parseFloat(participant.sharePercent) / 100) * claimAmount
            : null,
        createdAt: participant.createdAt ?? null,
      }));
  }, [allocations, claimAmount, participants]);

  const columns: Column<ClaimReinsurerRow>[] = useMemo(
    () => [
      {
        key: 'reinsurerName',
        label: 'Reinsurer',
        width: 'minmax(120px, 1fr)',
        render: (row) => <span className="font-medium text-gray-900">{row.reinsurerName}</span>,
      },
      {
        key: 'signedLinePercent',
        label: 'Share',
        width: '100px',
        className: 'text-center',
        render: (row) => (
          <span className="text-gray-600 block text-center">
            {row.signedLinePercent != null ? `${row.signedLinePercent}%` : '—'}
          </span>
        ),
      },
      {
        key: 'allocatedAmount',
        label: isActualAmount ? 'Actual Claim' : 'Est. Claim',
        width: '150px',
        className: 'text-right pr-8',
        render: (row) => (
          <span className="text-gray-900 block text-right">
            {fmt(row.allocatedAmount, currency)}
          </span>
        ),
      },
      {
        key: 'createdAt',
        label: 'Created At',
        width: '130px',
        render: (row) => <span className="text-gray-600">{fmtDate(row.createdAt)}</span>,
      },
      {
        key: 'actions',
        label: 'Actions',
        width: '210px',
        className: 'pr-6',
        render: (row) => {
          const participant = participants.find((p) => p.counterpartyId === row.counterpartyId);
          if (!participant) {
            return <span className="text-xs text-gray-400">—</span>;
          }
          if (sentAllocationIds.has(row.id)) {
            return <span className="text-xs text-gray-400">Sent</span>;
          }
          return (
            <div className="flex items-center gap-2">
              <TableButton variant="blue" onClick={() => onPreview(participant)}>
                Preview
              </TableButton>
              <TableButton variant="green" onClick={() => onMail(participant)}>
                Send Mail
              </TableButton>
            </div>
          );
        },
      },
    ],
    [isActualAmount, currency, onMail, onPreview, participants, sentAllocationIds],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      extraFilters={
        <div className="flex flex-col">
          <span className="text-sm font-bold text-gray-900">
            {allocations.length > 0 ? 'Claim Allocations' : 'Participants'}
          </span>
          {allocations.length === 0 && claimAmount != null && (
            <p className="text-xs text-gray-400">
              Estimated claims for participants until actual claims are made.
            </p>
          )}
        </div>
      }
      emptyMessage="No accepted reinsurers"
      currentPage={1}
      totalPages={0}
      onPageChange={() => {}}
      noInternalScroll
    />
  );
}
