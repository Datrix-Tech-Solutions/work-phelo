'use client';

import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import {
  useClaimAllocations,
  useClaimCashCalls,
  useCreateClaimCashCall,
  useGenerateClaimAllocations,
  useUpdateClaimCashCallStatus,
  useVoidClaimCashCall,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { PlacementClaim } from '@/types/reinsurance';

function formatAmount(value: string, currency: string) {
  return `${currency} ${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ClaimAllocationsSection({
  placementId,
  claim,
}: {
  placementId: string;
  claim: PlacementClaim;
}) {
  const allocationsQuery = useClaimAllocations(placementId, claim.id);
  const cashCallsQuery = useClaimCashCalls(placementId, claim.id);
  const generateAllocations = useGenerateClaimAllocations(placementId, claim.id);
  const createCashCall = useCreateClaimCashCall(placementId, claim.id);
  const updateCashCallStatus = useUpdateClaimCashCallStatus(placementId, claim.id);
  const voidCashCall = useVoidClaimCashCall(placementId, claim.id);
  const addToast = useToastStore((state) => state.addToast);

  const allocations = allocationsQuery.data ?? [];
  const cashCalls = cashCallsQuery.data ?? [];
  const isTerminal = claim.status === 'CLOSED' || claim.status === 'VOID';

  const handleGenerate = async () => {
    try {
      await generateAllocations.mutateAsync();
      addToast({ message: 'Claim allocations generated successfully', type: 'success' });
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  const handleCreateCashCall = async (allocationId: string) => {
    try {
      await createCashCall.mutateAsync(allocationId);
      addToast({ message: 'Cash call created successfully', type: 'success' });
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  const handleIssueCashCall = async (cashCallId: string) => {
    try {
      await updateCashCallStatus.mutateAsync({ cashCallId, status: 'ISSUED' });
      addToast({ message: 'Cash call issued successfully', type: 'success' });
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  const handleVoidCashCall = async (cashCallId: string) => {
    const voidReason = window.prompt('Why is this cash call being voided?')?.trim();
    if (!voidReason) return;

    try {
      await voidCashCall.mutateAsync({ cashCallId, voidReason });
      addToast({ message: 'Cash call voided successfully', type: 'success' });
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  if (allocationsQuery.isLoading || cashCallsQuery.isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Loading claim allocations…
      </div>
    );
  }

  if (allocationsQuery.isError || cashCallsQuery.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Claim allocations or cash calls could not be loaded. Please refresh and try again.
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Claim Allocations & Cash Calls</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Liabilities come from confirmed closing snapshots, not live participant shares.
          </p>
        </div>
        {allocations.length === 0 && (
          <Button
            size="sm"
            onClick={handleGenerate}
            isLoading={generateAllocations.isPending}
            loadingText="Generating…"
            disabled={isTerminal}
          >
            Generate Allocations
          </Button>
        )}
      </div>

      {allocations.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-500">
          {isTerminal
            ? 'No allocations were generated before this claim became terminal.'
            : 'Generate allocations after the placement has at least one confirmed closing.'}
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {allocations.map((allocation) => {
            const allocationCashCalls = cashCalls.filter(
              (cashCall) => cashCall.allocationId === allocation.id,
            );
            const activeCashCall = allocationCashCalls.find(
              (cashCall) => cashCall.status !== 'VOID',
            );
            const allocatedAmount =
              allocation.allocatedFinalLossAmount ?? allocation.allocatedEstimatedLossAmount;

            return (
              <div
                key={allocation.id}
                className="grid gap-4 px-5 py-4 md:grid-cols-[1.4fr_0.7fr_1fr_1.4fr] md:items-center"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {allocation.counterparty.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {allocation.placementClosing?.closingNumber ??
                      allocation.endorsementClosing?.closingNumber ??
                      'Closing snapshot'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Signed line</p>
                  <p className="text-sm font-medium text-gray-900">
                    {Number(allocation.signedLinePercent).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Allocated loss</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatAmount(allocatedAmount, claim.currency)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                  {activeCashCall ? (
                    <>
                      <Badge
                        label={`${activeCashCall.cashCallNumber} · ${activeCashCall.status}`}
                        variant={activeCashCall.status === 'ISSUED' ? 'info' : 'neutral'}
                      />
                      {activeCashCall.status === 'DRAFT' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleIssueCashCall(activeCashCall.id)}
                          disabled={updateCashCallStatus.isPending}
                        >
                          Issue
                        </Button>
                      )}
                      {(activeCashCall.status === 'DRAFT' ||
                        activeCashCall.status === 'ISSUED') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVoidCashCall(activeCashCall.id)}
                          disabled={voidCashCall.isPending}
                        >
                          Void
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleCreateCashCall(allocation.id)}
                      disabled={createCashCall.isPending}
                    >
                      Create Cash Call
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
