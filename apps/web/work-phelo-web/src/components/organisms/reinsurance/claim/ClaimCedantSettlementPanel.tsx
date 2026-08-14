'use client';

import { useMemo, useState } from 'react';
import { DetailField } from '@/components/atoms/DetailField';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { NumberField } from '@/components/atoms/NumberField';
import { DatePicker } from '@/components/atoms/DatePicker';
import {
  useApproveClaimPayable,
  useClaimAllocations,
  useClaimRecoveryPosition,
  useCreateClaimCedantSettlement,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { cardClass } from '@/lib/utils';
import { fmt } from '@/lib/reinsurance/claimFormat';
import { useToastStore } from '@/store/toast.store';
import { PlacementClaim } from '@/types/reinsurance';

interface ClaimCedantSettlementPanelProps {
  placementId: string;
  claim: PlacementClaim;
}

/** Broker → Cedant settlement status + the two actions that drive it: approving the payable
 * amount (locked to the sum of what each reinsurer is allocated to pay — the target the broker is
 * working toward, known as soon as allocations exist; this is a one-shot, irreversible action on
 * the backend), then recording settlement payments against it, as many times as needed, as
 * recoveries or broker funding allow. The settlement audit trail itself lives in the "History"
 * tab (`ClaimFinancialHistoryTable`). */
export function ClaimCedantSettlementPanel({
  placementId,
  claim,
}: ClaimCedantSettlementPanelProps) {
  const addToast = useToastStore((s) => s.addToast);
  const { data: position } = useClaimRecoveryPosition(placementId, claim.id);
  const { data: allocations = [] } = useClaimAllocations(placementId, claim.id);
  const approvePayable = useApproveClaimPayable(placementId, claim.id);
  const createSettlement = useCreateClaimCedantSettlement(placementId, claim.id);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementDate, setSettlementDate] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const finalLossAmount = position?.claim.finalLossAmount ?? claim.finalLossAmount;
  const approvedPayableAmount =
    position?.cedantSettlement.approvedPayableAmount ?? claim.approvedPayableAmount;
  const outstandingAmount = position?.cedantSettlement.outstandingAmount ?? '0.00';
  const canRecordSettlement = !!approvedPayableAmount && parseFloat(outstandingAmount) > 0;

  // What's actually owed to the cedant: the sum of each reinsurer's allocated share — what
  // they're each on the hook to pay — not what's been recovered from them so far. Recovery
  // timing is tracked separately via Broker Exposure below.
  const nonVoidAllocations = useMemo(
    () => allocations.filter((a) => a.status !== 'VOID'),
    [allocations],
  );
  const totalAllocated = useMemo(
    () =>
      nonVoidAllocations.reduce(
        (sum, allocation) =>
          sum +
          parseFloat(
            allocation.allocatedFinalLossAmount ?? allocation.allocatedEstimatedLossAmount,
          ),
        0,
      ),
    [nonVoidAllocations],
  );
  const payableAmount =
    nonVoidAllocations.length > 0 ? totalAllocated : parseFloat(finalLossAmount ?? '0');
  const canApprovePayable =
    !!finalLossAmount && !approvedPayableAmount && nonVoidAllocations.length > 0;

  const handleApprove = async () => {
    try {
      await approvePayable.mutateAsync({
        approvedPayableAmount: Math.round(payableAmount * 100) / 100,
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

  return (
    <div className="flex flex-col gap-2">
      {finalLossAmount && !approvedPayableAmount && (
        <div className={cardClass('flex flex-col gap-2 rounded-lg bg-gray-50 p-3')}>
          <div className="flex items-end justify-between gap-3">
            <DetailField
              horizontal
              label="Payable Amount"
              value={
                <span className="font-semibold text-gray-900">
                  {fmt(payableAmount, claim.currency)}
                </span>
              }
            />
            <Button
              type="button"
              onClick={handleApprove}
              disabled={!canApprovePayable || approvePayable.isPending}
              isLoading={approvePayable.isPending}
            >
              Approve Payable
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            {nonVoidAllocations.length === 0
              ? 'No reinsurer allocations to work from yet.'
              : `Sum of what all ${nonVoidAllocations.length} reinsurer${nonVoidAllocations.length === 1 ? '' : 's'} are allocated to pay. `}
            {canApprovePayable &&
              `Approving locks in ${fmt(payableAmount, claim.currency)} as the payable amount and can't be changed afterward.`}
          </p>
        </div>
      )}
      <div className={cardClass('p-6 w-full')}>
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
          label="Awaiting Bank Confirmation"
          value={fmt(position?.cedantSettlement.recordedAmount, claim.currency)}
        />
        <DetailField
          horizontal
          label="Bank Confirmed"
          value={fmt(position?.cedantSettlement.bankConfirmedAmount, claim.currency)}
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
          <DatePicker label="Settlement Date" value={settlementDate} onChange={setSettlementDate} />
          <NumberField
            label="Amount"
            value={settlementAmount ? Number(settlementAmount) : 0}
            onChange={(n) => setSettlementAmount(n ? String(n) : '')}
            placeholder={outstandingAmount}
          />
          <Input
            label="Reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Payment reference"
          />
          <Input
            label="Notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional notes"
          />
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
    </div>
  );
}
