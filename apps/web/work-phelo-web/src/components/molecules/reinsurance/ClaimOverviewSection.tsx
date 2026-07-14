'use client';

import { useMemo, useState } from 'react';
import {
  Facultative,
  PlacementClaim,
  PlacementClaimAllocation,
  PlacementClaimStatus,
  PlacementParticipant,
} from '@/types/reinsurance';
import { DetailField } from '@/components/atoms/DetailField';
import { Badge } from '@/components/atoms/Badge';
import { Icons } from '@/components/atoms/icons';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { MailPreviewModal } from '@/components/organisms/reinsurance/MailPreviewModal';
import { ClaimDebitNoteModal } from '@/components/organisms/reinsurance/documents/ClaimDebitNoteModal';
import { useReinsurers, useCedants, useClaimAllocations } from '@/hooks';
import { isForeignCedant, FOREIGN_CEDANT_DEDUCTION_RATE } from '@/lib/reinsuranceTax';

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
      ? facPremium * (1 - commission / 100) * (1 - deductionRate)
      : facPremium;

  return (
    <div className="bg-white rounded-xl p-5 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">{placement.reference ?? '—'}</span>
          {placement.policyNumber && (
            <span className="text-xs text-gray-400">{placement.policyNumber}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {placement.cedant?.name && (
            <span className="text-xs text-gray-600">{placement.cedant.name}</span>
          )}
          {placement.cedant?.name && placement.title && (
            <span className="text-gray-300 text-xs">·</span>
          )}
          {placement.title && <span className="text-xs text-gray-400">{placement.title}</span>}
          {placement.classOfBusiness && (
            <>
              <span className="text-gray-300 text-xs">·</span>
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
  currency,
  grossPremium,
  commission,
  deductionRate,
  onMail,
  onPreview,
}: {
  participants: PlacementParticipant[];
  allocations: PlacementClaimAllocation[];
  claimAmount?: number | null;
  currency?: string | null;
  grossPremium: number;
  commission: number;
  deductionRate: number;
  onMail: (participant: PlacementParticipant) => void;
  onPreview: (participant: PlacementParticipant) => void;
}) {
  const reinsurers = useMemo(
    () =>
      participants.filter(
        (p) => p.role !== 'BROKER' && (p.status === 'ACCEPTED' || p.status === 'CLOSED'),
      ),
    [participants],
  );

  const columns: Column<PlacementParticipant>[] = useMemo(
    () => [
      {
        key: 'counterparty',
        label: 'Reinsurer',
        render: (row) => <span className="font-medium text-gray-900">{row.counterparty.name}</span>,
      },
      {
        key: 'brokerageFee',
        label: 'Premium Share',
        width: '160px',
        className: 'text-right',
        render: (row) => {
          const share = row.sharePercent != null ? parseFloat(row.sharePercent) / 100 : 0;
          const brokerage = row.brokerageFee != null ? parseFloat(row.brokerageFee) : 0;
          const premiumShare =
            share * grossPremium * (1 - (commission + brokerage) / 100) * (1 - deductionRate);
          return (
            <span className="text-gray-700 block text-right">{fmt(premiumShare, currency)}</span>
          );
        },
      },
      {
        key: 'sharePercent',
        label: 'Share',
        width: '80px',
        className: 'text-center',
        render: (row) => (
          <span className="text-gray-600 block text-center">
            {row.sharePercent != null ? `${row.sharePercent}%` : '—'}
          </span>
        ),
      },
      {
        key: 'signedLinePercent',
        label: 'Actual Claim',
        width: '180px',
        className: 'text-right pr-8',
        render: (row) => {
          const allocation = allocations.find((a) => a.participantId === row.id);
          const actual = allocation
            ? parseFloat(allocation.allocatedEstimatedLossAmount)
            : row.sharePercent != null && claimAmount != null
              ? (parseFloat(row.sharePercent) / 100) * claimAmount
              : null;
          return <span className="text-gray-900 block text-right">{fmt(actual, currency)}</span>;
        },
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
        render: (row) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Preview Debit Note"
              className="text-blue-500 hover:text-blue-600 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onPreview(row);
              }}
            >
              <Icons.Eye className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Preview Email"
              className="text-green-500 hover:text-green-700 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onMail(row);
              }}
            >
              <Icons.Mail className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [
      allocations,
      claimAmount,
      currency,
      grossPremium,
      commission,
      deductionRate,
      onMail,
      onPreview,
    ],
  );

  return (
    <div className="flex flex-col gap-0">
      <div className="px-4 pt-4 pb-2 bg-white rounded-t-xl border border-b-0 border-gray-200">
        <span className="text-sm font-bold text-gray-900">Participants</span>
      </div>
      <DataTable
        columns={columns}
        data={reinsurers}
        emptyMessage="No accepted reinsurers"
        currentPage={1}
        totalPages={0}
        onPageChange={() => {}}
        noInternalScroll
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

  const deductionRate = isForeignCedant(cedants.find((c) => c.id === placement.cedant.id))
    ? FOREIGN_CEDANT_DEDUCTION_RATE
    : 0;

  const claimAmount = claim ? parseFloat(claim.estimatedLossAmount) : null;
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
    if (claimAmount == null) return null;
    return (placement.participants ?? [])
      .filter((p) => p.role !== 'BROKER' && (p.status === 'ACCEPTED' || p.status === 'CLOSED'))
      .reduce((sum, p) => {
        const share = p.sharePercent != null ? parseFloat(p.sharePercent) / 100 : 0;
        return sum + share * claimAmount;
      }, 0);
  }, [placement.participants, claimAmount]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-4">
      <div className="flex flex-col md:flex-row gap-4 items-start">
        <div className="w-full md:flex-1 min-w-0">
          <ClaimDetailsPanel placement={placement} claim={claim} deductionRate={deductionRate} />
        </div>
        <div className="w-full md:flex-2 min-w-0">
          <ClaimReinsurersTable
            participants={placement.participants ?? []}
            allocations={allocations}
            claimAmount={claimAmount}
            currency={claim?.currency ?? placement.currency}
            grossPremium={placement.premium ?? 0}
            commission={placement.commission ?? 0}
            deductionRate={deductionRate}
            onMail={setMailTarget}
            onPreview={setDebitNoteTarget}
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
        <span className="font-semibold text-gray-900">Total Claim</span>
        <span className="font-semibold text-gray-900">
          {fmt(totalActualClaim, claim?.currency ?? placement.currency)}
        </span>
      </div>

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
