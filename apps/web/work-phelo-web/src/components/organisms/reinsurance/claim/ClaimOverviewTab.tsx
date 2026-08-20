'use client';

import { useMemo, useState } from 'react';
import { Facultative, PlacementClaim, PlacementParticipant } from '@/types/reinsurance';
import { MailPreviewModal } from '@/components/organisms/reinsurance/MailPreviewModal';
import { ClaimDebitNoteModal } from '@/components/organisms/reinsurance/documents/ClaimDebitNoteModal';
import { ClaimCedantSettlementPanel } from '@/components/organisms/reinsurance/claim/ClaimCedantSettlementPanel';
import { ClaimReinsurersTable } from '@/components/molecules/reinsurance/claim/ClaimReinsurersTable';
import {
  useAllPlacementParticipants,
  useClaimAllocations,
  useClaimCashCalls,
  useReinsurers,
} from '@/hooks';
import { cardClass } from '@/lib/utils';
import { fmt } from '@/lib/reinsurance/claimFormat';

interface ClaimOverviewTabProps {
  placement: Facultative;
  claim?: PlacementClaim;
}

export function ClaimOverviewTab({ placement, claim }: ClaimOverviewTabProps) {
  const { data: reinsurers = [] } = useReinsurers();
  const { data: allocations = [] } = useClaimAllocations(placement.id, claim?.id ?? '');
  const { data: cashCalls = [] } = useClaimCashCalls(placement.id, claim?.id ?? '');
  const [mailTarget, setMailTarget] = useState<PlacementParticipant | null>(null);
  const [debitNoteTarget, setDebitNoteTarget] = useState<PlacementParticipant | null>(null);

  // Includes reinsurers added via an endorsement — placement.participants alone only reflects
  // the original placement closing, so it silently misses those.
  const allParticipants = useAllPlacementParticipants(placement.id, placement.participants ?? []);

  const claimAmount = claim ? parseFloat(claim.finalLossAmount ?? claim.estimatedLossAmount) : null;
  const isActualAmount = !!claim?.finalLossAmount;

  // A cash call only ever gets created via "Send Mail" below, so its existence for an
  // allocation means their share has already been sent to them.
  const sentAllocationIds = useMemo(
    () => new Set(cashCalls.map((cashCall) => cashCall.allocationId)),
    [cashCalls],
  );

  // Match by counterpartyId, not participantId — allocations sourced from an endorsement closing
  // carry endorsementParticipantId instead, so participantId alone would miss those reinsurers.
  const mailAllocation = mailTarget
    ? allocations.find((a) => a.counterpartyId === mailTarget.counterpartyId)
    : undefined;
  const debitNoteAllocation = debitNoteTarget
    ? allocations.find((a) => a.counterpartyId === debitNoteTarget.counterpartyId)
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
      <ClaimReinsurersTable
        participants={allParticipants}
        allocations={allocations}
        claimAmount={claimAmount}
        isActualAmount={isActualAmount}
        currency={claim?.currency ?? placement.currency}
        sentAllocationIds={sentAllocationIds}
        onMail={setMailTarget}
        onPreview={setDebitNoteTarget}
      />

      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
        <span className="font-semibold text-gray-900">
          {allocations.length > 0 ? 'Total Allocated Claim' : 'Total Claim Estimate'}
        </span>
        <span className="font-semibold text-gray-900">
          {fmt(totalActualClaim, claim?.currency ?? placement.currency)}
        </span>
      </div>

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
          allocation={debitNoteAllocation}
          onPrint={() => {}}
          onClose={() => setDebitNoteTarget(null)}
        />
      )}
    </div>
  );
}
