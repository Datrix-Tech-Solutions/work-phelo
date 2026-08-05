'use client';

import { useMemo, useState } from 'react';
import {
  Facultative,
  PlacementClaim,
  PlacementClaimAllocation,
  PlacementClaimCashCall,
  PlacementClaimStatus,
  PlacementParticipant,
} from '@/types/reinsurance';
import { DetailField } from '@/components/atoms/DetailField';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { NumberField } from '@/components/atoms/NumberField';
import { Icons } from '@/components/atoms/icons';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { MailPreviewModal } from '@/components/organisms/reinsurance/MailPreviewModal';
import { ClaimDebitNoteModal } from '@/components/organisms/reinsurance/documents/ClaimDebitNoteModal';
import {
  useReinsurers,
  useCedants,
  useClaimAllocations,
  useClaimCashCalls,
  useClaimRecoveryPosition,
  useApproveClaimPayable,
  useClaimCedantSettlements,
  useCreateClaimCedantSettlement,
  useReverseClaimCedantSettlement,
} from '@/hooks';
import { isForeignCedant, FOREIGN_CEDANT_DEDUCTION_RATE } from '@/lib/reinsuranceTax';
import { cardClass } from '@/lib/utils';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

const CLAIM_STATUS_VARIANT: Record<
  PlacementClaimStatus,
  'neutral' | 'warning' | 'success' | 'danger'
> = {
  DRAFT: 'neutral',
  NOTIFIED: 'warning',
  RESERVED: 'warning',
  PARTIALLY_SETTLED: 'warning',
  SETTLED: 'success',
  DECLINED: 'danger',
  CLOSED: 'success',
  VOID: 'danger',
};

const CLAIM_STATUS_LABEL: Record<PlacementClaimStatus, string> = {
  DRAFT: 'Draft',
  NOTIFIED: 'Notified',
  RESERVED: 'Reserved',
  PARTIALLY_SETTLED: 'Partly Settled',
  SETTLED: 'Settled',
  DECLINED: 'Declined',
  CLOSED: 'Closed',
  VOID: 'Void',
};

function fmt(val: number | string | null | undefined, currency?: string | null) {
  if (val == null || val === '') return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface ClaimOverviewSectionProps {
  placement: Facultative;
  claim?: PlacementClaim;
}

function ClaimDetailsPanel({
  placement,
  claim,
  deductionRate,
}: Pick<ClaimOverviewSectionProps, 'placement' | 'claim'> & { deductionRate: number }) {
  const { facultativeOffer, sumInsured, premium, commission, currency, createdAt } = placement;

  const facSumInsured =
    sumInsured != null && facultativeOffer != null ? sumInsured * (facultativeOffer / 100) : null;

  const facPremium =
    premium != null && facultativeOffer != null ? (facultativeOffer / 100) * premium : null;

  const netPremium =
    facPremium != null && commission != null
      ? facPremium * (1 - commission / 100) - facPremium * deductionRate
      : facPremium;

  return (
    <div className={cardClass('flex flex-col gap-3 p-5')}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">
            {displayPolicyNumber(placement.policyNumber)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {placement.cedant?.name && (
            <span className="text-xs text-gray-600">{placement.cedant.name}</span>
          )}
          {placement.cedant?.name && placement.title && (
            <span className="text-gray-400 text-xs">·</span>
          )}
          {placement.title && <span className="text-xs text-gray-400">{placement.title}</span>}
          {placement.classOfBusiness && (
            <>
              <span className="text-gray-400 text-xs">·</span>
              <span className="text-xs text-gray-400">{placement.classOfBusiness}</span>
            </>
          )}
        </div>
      </div>

      <hr className="border-gray-100" />

      <DetailField
        horizontal
        label="Facultative Offer"
        value={facultativeOffer != null ? `${facultativeOffer}%` : '—'}
      />
      <DetailField horizontal label="Fac. Sum Insured" value={fmt(facSumInsured, currency)} />
      <DetailField
        horizontal
        label="Period of Insurance"
        value={`${fmtDate(placement.inceptionDate ?? '')} – ${fmtDate(placement.expiryDate ?? '')}`}
      />
      <DetailField
        horizontal
        label="Fac. Premium"
        value={<span className="font-semibold text-gray-900">{fmt(netPremium, currency)}</span>}
      />
      <DetailField horizontal label="Created At" value={fmtDate(createdAt)} />

      {claim && (
        <>
          <hr className="border-gray-100" />

          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">{claim.claimNumber}</span>
            <Badge
              label={CLAIM_STATUS_LABEL[claim.status]}
              variant={CLAIM_STATUS_VARIANT[claim.status]}
            />
          </div>

          <DetailField horizontal label="Occurrence Date" value={fmtDate(claim.occurrenceDate)} />
          <DetailField horizontal label="Reported Date" value={fmtDate(claim.reportedDate)} />
          <DetailField horizontal label="Claim Cause" value={claim.claimCause} />
          {claim.occurrenceDetails && (
            <DetailField horizontal label="Details" value={claim.occurrenceDetails} />
          )}
          <DetailField
            horizontal
            label="Estimated Loss"
            value={
              <span className="font-semibold text-gray-900">
                {fmt(claim.estimatedLossAmount, claim.currency)}
              </span>
            }
          />
          {claim.finalLossAmount && (
            <DetailField
              horizontal
              label="Final Loss"
              value={
                <span className="font-semibold text-gray-900">
                  {fmt(claim.finalLossAmount, claim.currency)}
                </span>
              }
            />
          )}
        </>
      )}
    </div>
  );
}

function ClaimReinsurersTable({
  participants,
  allocations,
  claimAmount,
  isActualAmount,
  currency,
  onMail,
  onPreview,
}: {
  participants: PlacementParticipant[];
  allocations: PlacementClaimAllocation[];
  claimAmount?: number | null;
  isActualAmount?: boolean;
  currency?: string | null;
  onMail: (participant: PlacementParticipant) => void;
  onPreview: (participant: PlacementParticipant) => void;
}) {
  type ClaimReinsurerRow = {
    id: string;
    reinsurerName: string;
    signedLinePercent: string | null;
    allocationSource: string;
    allocatedAmount: number | null;
    createdAt: string | null;
    participant: PlacementParticipant | null;
  };

  const rows = useMemo<ClaimReinsurerRow[]>(() => {
    if (allocations.length > 0) {
      return allocations.map((allocation) => ({
        id: allocation.id,
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
        participant: null,
      }));
    }

    return participants
      .filter((p) => p.role !== 'BROKER' && (p.status === 'ACCEPTED' || p.status === 'CLOSED'))
      .map((participant) => ({
        id: participant.id,
        reinsurerName: participant.counterparty.name,
        signedLinePercent: participant.sharePercent,
        allocationSource: 'Estimate before allocation generation',
        allocatedAmount:
          participant.sharePercent != null && claimAmount != null
            ? (parseFloat(participant.sharePercent) / 100) * claimAmount
            : null,
        createdAt: participant.createdAt ?? null,
        participant,
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
        label: allocations.length > 0 ? 'Est. Share' : 'Est. Share',
        width: '100px',
        className: 'text-center',
        render: (row) => (
          <span className="text-gray-600 block text-center">
            {row.signedLinePercent != null ? `${row.signedLinePercent}%` : '—'}
          </span>
        ),
      },
      {
        key: 'allocationSource',
        label: 'Source',
        width: '100px',
        render: (row) => <span className="text-gray-600">{row.allocationSource}</span>,
      },
      {
        key: 'allocatedAmount',
        label: isActualAmount ? 'Actual Claim' : 'Est. Claim',
        width: '120px',
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
        key: 'status',
        label: 'Actions',
        width: '100px',
        className: 'pr-6',
        render: (row) =>
          row.participant ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                title="Preview Debit Note"
                className="text-blue-500 hover:text-blue-600 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  if (row.participant) onPreview(row.participant);
                }}
              >
                <Icons.Eye className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Send Mail"
                className="text-green-500 hover:text-green-700 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  if (row.participant) onMail(row.participant);
                }}
              >
                <Icons.Mail className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <span className="text-xs text-gray-400">Backend allocation</span>
          ),
      },
    ],
    [allocations.length, isActualAmount, currency, onMail, onPreview],
  );

  return (
    <div className="flex flex-col gap-0">
      <div className="px-4 pt-4 pb-2 bg-white rounded-t-xl border border-b-0 border-gray-200">
        <span className="text-sm font-bold text-gray-900">
          {allocations.length > 0 ? 'Claim Allocations' : 'Participants'}
        </span>
        {allocations.length === 0 && claimAmount != null && (
          <p className="text-xs text-gray-400 mt-1">
            Estimated from current participants until backend allocations are generated.
          </p>
        )}
      </div>
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="No accepted reinsurers"
        currentPage={1}
        totalPages={0}
        onPageChange={() => {}}
        noInternalScroll
      />
    </div>
  );
}

function ClaimCashCallsTable({ cashCalls }: { cashCalls: PlacementClaimCashCall[] }) {
  const columns: Column<PlacementClaimCashCall>[] = useMemo(
    () => [
      {
        key: 'cashCallNumber',
        label: 'Cash Call',
        width: '100px',
        render: (row) => <span className="font-medium text-gray-900">{row.cashCallNumber}</span>,
      },
      {
        key: 'counterparty',
        label: 'Reinsurer',
        width: 'minmax(120px, 1fr)',
        render: (row) => <span className="text-gray-700">{row.counterparty.name}</span>,
      },
      {
        key: 'amount',
        label: 'Amount',
        width: '150px',
        className: 'text-right pr-8',
        render: (row) => (
          <span className="text-gray-900 block text-right">{fmt(row.amount, row.currency)}</span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: '100px',
        render: (row) => (
          <Badge
            label={row.status.charAt(0) + row.status.slice(1).toLowerCase()}
            variant={
              row.status === 'VOID' ? 'danger' : row.status === 'ISSUED' ? 'warning' : 'neutral'
            }
          />
        ),
      },
      {
        key: 'issuedAt',
        label: 'Issued',
        width: '130px',
        render: (row) => <span className="text-gray-600">{fmtDate(row.issuedAt)}</span>,
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className={cardClass('p-6 w-full')}>
        <span className="text-sm font-bold text-gray-900">Cash Calls</span>
        <p className="text-xs text-gray-400 mt-1">
          Backend cash-call records generated from this claim&apos;s allocation snapshots.
        </p>
      </div>
      <DataTable
        columns={columns}
        data={cashCalls}
        emptyMessage="No cash calls for this claim"
        currentPage={1}
        totalPages={0}
        onPageChange={() => {}}
        noInternalScroll
      />
    </div>
  );
}

function ClaimCedantSettlementPanel({
  placementId,
  claim,
}: {
  placementId: string;
  claim: PlacementClaim;
}) {
  const addToast = useToastStore((s) => s.addToast);
  const { data: position } = useClaimRecoveryPosition(placementId, claim.id);
  const { data: settlements = [] } = useClaimCedantSettlements(placementId, claim.id);
  const approvePayable = useApproveClaimPayable(placementId, claim.id);
  const createSettlement = useCreateClaimCedantSettlement(placementId, claim.id);
  const reverseSettlement = useReverseClaimCedantSettlement(placementId, claim.id);
  const [approvedAmount, setApprovedAmount] = useState('');
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementDate, setSettlementDate] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const finalLossAmount = position?.claim.finalLossAmount ?? claim.finalLossAmount;
  const approvedPayableAmount =
    position?.cedantSettlement.approvedPayableAmount ?? claim.approvedPayableAmount;
  const outstandingAmount = position?.cedantSettlement.outstandingAmount ?? '0.00';
  const canRecordSettlement = !!approvedPayableAmount && parseFloat(outstandingAmount) > 0;

  const handleApprove = async () => {
    try {
      await approvePayable.mutateAsync({
        approvedPayableAmount: Math.round((parseFloat(approvedAmount) || 0) * 100) / 100,
      });
      addToast({ message: 'Cedant payable amount approved', type: 'success' });
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  const handleRecordSettlement = async () => {
    try {
      await createSettlement.mutateAsync({
        currency: claim.currency,
        amount: Math.round((parseFloat(settlementAmount) || 0) * 100) / 100,
        settlementDate: new Date(settlementDate).toISOString(),
        reference: reference || undefined,
        notes: notes || undefined,
      });
      setSettlementAmount('');
      setReference('');
      setNotes('');
      addToast({ message: 'Cedant settlement recorded', type: 'success' });
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  const handleReverse = async (settlementId: string) => {
    const reversalNotes =
      window.prompt('Reason for reversing this cedant settlement?') ?? undefined;
    try {
      await reverseSettlement.mutateAsync({ settlementId, notes: reversalNotes });
      addToast({ message: 'Cedant settlement reversed', type: 'success' });
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  const settlementColumns: Column<(typeof settlements)[number]>[] = [
    {
      key: 'settlementDate',
      label: 'Date',
      width: '100px',
      render: (row) => <span className="text-gray-600">{fmtDate(row.settlementDate)}</span>,
    },
    {
      key: 'amount',
      label: 'Amount',
      className: 'text-right pr-8',
      width: '150px',
      render: (row) => (
        <span className="block text-right font-medium text-gray-900">
          {fmt(row.amount, row.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '110px',
      render: (row) => (
        <Badge
          label={row.status === 'REVERSED' ? 'Reversed' : 'Recorded'}
          variant={row.status === 'REVERSED' ? 'danger' : 'success'}
        />
      ),
    },
    {
      key: 'reference',
      label: 'Reference',
      width: 'minmax(120px, 1fr)',
      render: (row) => <span className="text-gray-600">{row.reference ?? '—'}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '100px',
      render: (row) =>
        row.status === 'RECORDED' && !row.reversalOfSettlementId ? (
          <button
            type="button"
            className="text-xs font-semibold text-red-600 hover:text-red-700"
            onClick={(event) => {
              event.stopPropagation();
              handleReverse(row.id);
            }}
            disabled={reverseSettlement.isPending}
          >
            Reverse
          </button>
        ) : (
          <span className="text-xs text-gray-400">Historical</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className={cardClass('p-6 w-full ')}>
        <span className="text-sm font-bold text-gray-900">Cedant Claim Settlement</span>
        <p className="text-xs text-gray-500 pb-2">
          Broker → Cedant settlement is approved and tracked separately from reinsurer recoveries.
        </p>
        <DetailField horizontal label="Final Loss" value={fmt(finalLossAmount, claim.currency)} />
        <DetailField
          horizontal
          label="Approved Payable"
          value={fmt(approvedPayableAmount, claim.currency)}
        />
        <DetailField
          horizontal
          label="Settled"
          value={fmt(position?.cedantSettlement.settledAmount, claim.currency)}
        />
        <DetailField
          horizontal
          label="Outstanding"
          value={fmt(outstandingAmount, claim.currency)}
        />
        <DetailField
          horizontal
          label="Broker Exposure"
          value={fmt(position?.funding.brokerFundedExposure, claim.currency)}
        />
      </div>

      {!finalLossAmount && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Final loss amount is required before approving cedant payable.
        </div>
      )}

      {approvedPayableAmount && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 rounded-lg bg-gray-50 p-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
            Settlement Date
            <input
              type="date"
              value={settlementDate}
              onChange={(event) => setSettlementDate(event.target.value)}
              className="rounded-input border border-gray-200 px-3 py-2 text-sm font-normal text-gray-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
            Amount
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={settlementAmount}
              onChange={(event) => setSettlementAmount(event.target.value)}
              placeholder={outstandingAmount}
              className="rounded-input border border-gray-200 px-3 py-2 text-sm font-normal text-gray-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
            Reference
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Payment reference"
              className="rounded-input border border-gray-200 px-3 py-2 text-sm font-normal text-gray-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
            Notes
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional notes"
              className="rounded-input border border-gray-200 px-3 py-2 text-sm font-normal text-gray-900"
            />
          </label>
          <div className="flex items-end">
            <Button
              type="button"
              onClick={handleRecordSettlement}
              disabled={!canRecordSettlement || !settlementDate || !settlementAmount}
              isLoading={createSettlement.isPending}
            >
              Record Settlement
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={settlementColumns}
        data={settlements}
        emptyMessage="No cedant settlements recorded"
        currentPage={1}
        totalPages={0}
        onPageChange={() => {}}
        noInternalScroll
        extraFilters={
          finalLossAmount && (
            <div className="flex items-end gap-2">
              <div className="w-40">
                <NumberField
                  label="Payable Amount"
                  value={approvedAmount ? Number(approvedAmount) : 0}
                  onChange={(n) => setApprovedAmount(n ? String(n) : '')}
                  placeholder={String(approvedPayableAmount ?? finalLossAmount)}
                />
              </div>
              <Button
                type="button"
                onClick={handleApprove}
                disabled={!approvedAmount || approvePayable.isPending}
                isLoading={approvePayable.isPending}
              >
                Approve Payable
              </Button>
            </div>
          )
        }
      />
    </div>
  );
}

export function ClaimOverviewSection({ placement, claim }: ClaimOverviewSectionProps) {
  const [mailTarget, setMailTarget] = useState<PlacementParticipant | null>(null);
  const [debitNoteTarget, setDebitNoteTarget] = useState<PlacementParticipant | null>(null);
  const { data: reinsurers = [] } = useReinsurers();
  const { data: cedants = [] } = useCedants();
  const { data: allocations = [] } = useClaimAllocations(placement.id, claim?.id ?? '');
  const { data: cashCalls = [] } = useClaimCashCalls(placement.id, claim?.id ?? '');

  const deductionRate = isForeignCedant(cedants.find((c) => c.id === placement.cedant.id))
    ? FOREIGN_CEDANT_DEDUCTION_RATE
    : 0;

  const claimAmount = claim ? parseFloat(claim.finalLossAmount ?? claim.estimatedLossAmount) : null;
  const isActualAmount = !!claim?.finalLossAmount;
  const mailAllocation = mailTarget
    ? allocations.find((a) => a.participantId === mailTarget.id)
    : undefined;

  const reinsurerEmails = useMemo<Record<string, string[]>>(
    () =>
      Object.fromEntries(
        reinsurers.map((r) => {
          const emails: string[] = [];
          if (r.email) emails.push(r.email);
          r.contacts.forEach((c) => {
            if (c.email) emails.push(c.email);
          });
          return [r.id, emails];
        }),
      ),
    [reinsurers],
  );

  const mailRecipients = mailTarget ? (reinsurerEmails[mailTarget.counterpartyId] ?? []) : [];

  const totalActualClaim = useMemo(() => {
    if (allocations.length > 0) {
      return allocations.reduce(
        (sum, allocation) =>
          sum +
          parseFloat(
            allocation.allocatedFinalLossAmount ?? allocation.allocatedEstimatedLossAmount,
          ),
        0,
      );
    }
    if (claimAmount == null) return null;
    return (placement.participants ?? [])
      .filter((p) => p.role !== 'BROKER' && (p.status === 'ACCEPTED' || p.status === 'CLOSED'))
      .reduce((sum, p) => {
        const share = p.sharePercent != null ? parseFloat(p.sharePercent) / 100 : 0;
        return sum + share * claimAmount;
      }, 0);
  }, [allocations, placement.participants, claimAmount]);

  return (
    <div className={cardClass('flex flex-col gap-4 p-4')}>
      <div className="flex flex-col md:flex-row gap-4 items-start">
        <div className="w-full md:flex-1 min-w-0">
          <ClaimDetailsPanel placement={placement} claim={claim} deductionRate={deductionRate} />
        </div>
        <div className="w-full md:flex-2 min-w-0">
          <ClaimReinsurersTable
            participants={placement.participants ?? []}
            allocations={allocations}
            claimAmount={claimAmount}
            isActualAmount={isActualAmount}
            currency={claim?.currency ?? placement.currency}
            onMail={setMailTarget}
            onPreview={setDebitNoteTarget}
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
        <span className="font-semibold text-gray-900">
          {allocations.length > 0 ? 'Total Allocated Claim' : 'Total Claim Estimate'}
        </span>
        <span className="font-semibold text-gray-900">
          {fmt(totalActualClaim, claim?.currency ?? placement.currency)}
        </span>
      </div>

      {claim && <ClaimCashCallsTable cashCalls={cashCalls} />}

      {claim && <ClaimCedantSettlementPanel placementId={placement.id} claim={claim} />}

      {mailTarget && (
        <MailPreviewModal
          isOpen
          placement={placement}
          brokerageFee={parseFloat(mailTarget.brokerageFee ?? '0')}
          recipients={mailRecipients}
          claim={claim}
          allocation={mailAllocation}
          onSend={() => setMailTarget(null)}
          onClose={() => setMailTarget(null)}
        />
      )}

      {debitNoteTarget && (
        <ClaimDebitNoteModal
          isOpen
          placement={placement}
          participant={debitNoteTarget}
          claimAmount={claimAmount}
          onPrint={() => {}}
          onClose={() => setDebitNoteTarget(null)}
        />
      )}
    </div>
  );
}
