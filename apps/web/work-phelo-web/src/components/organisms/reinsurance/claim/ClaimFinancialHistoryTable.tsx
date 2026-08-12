'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { TableButton } from '@/components/atoms/TableButton';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { ClaimBankConfirmModal } from '@/components/organisms/reinsurance/ClaimBankConfirmModal';
import {
  useClaimCedantSettlements,
  useClaimRecoveryPosition,
  useConfirmClaimCedantSettlementBank,
  useConfirmClaimRecoveryReceiptBank,
  useReverseClaimCedantSettlement,
  useReverseClaimRecoveryReceipt,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { fmtDate, fmt } from '@/lib/reinsurance/claimFormat';
import { SETTLEMENT_STATUS_LABEL, SETTLEMENT_STATUS_VARIANT } from '@/lib/reinsurance/claimStatus';
import { useToastStore } from '@/store/toast.store';
import {
  ConfirmPlacementClaimFinancialBankPayload,
  Facultative,
  PlacementClaim,
  PlacementClaimCedantSettlement,
  PlacementClaimRecoveryReceipt,
} from '@/types/reinsurance';

interface ClaimFinancialHistoryTableProps {
  placement: Facultative;
  claim: PlacementClaim;
}

type HistoryRowType = 'PAYABLE' | 'RECEIVABLE';

interface HistoryRow {
  id: string;
  type: HistoryRowType;
  date: string;
  counterpartyName: string;
  cashCallNumber: string | null;
  amount: string;
  currency: string;
  status: PlacementClaimCedantSettlement['status'];
  reference: string | null;
  isReversible: boolean;
  settlement?: PlacementClaimCedantSettlement;
  receipt?: PlacementClaimRecoveryReceipt;
}

const TYPE_LABEL: Record<HistoryRowType, string> = {
  PAYABLE: 'Claim Payable',
  RECEIVABLE: 'Claim Receivable',
};

const TYPE_VARIANT: Record<HistoryRowType, 'info' | 'success'> = {
  PAYABLE: 'info',
  RECEIVABLE: 'success',
};

/** Unified financial history for this claim, one timeline sorted by date: "Claim Payable" rows
 * are Broker → Cedant settlements, "Claim Receivable" rows are Reinsurer → Broker recovery
 * receipts — same underlying data as before, just merged with a Type tag instead of split across
 * two tables. */
export function ClaimFinancialHistoryTable({ placement, claim }: ClaimFinancialHistoryTableProps) {
  const addToast = useToastStore((s) => s.addToast);
  const { data: settlements = [] } = useClaimCedantSettlements(placement.id, claim.id);
  const { data: position } = useClaimRecoveryPosition(placement.id, claim.id);
  const reverseSettlement = useReverseClaimCedantSettlement(placement.id, claim.id);
  const confirmSettlementBank = useConfirmClaimCedantSettlementBank(placement.id, claim.id);
  const reverseReceipt = useReverseClaimRecoveryReceipt();
  const confirmReceiptBank = useConfirmClaimRecoveryReceiptBank();
  const [confirmTarget, setConfirmTarget] = useState<HistoryRow | null>(null);

  const rows = useMemo<HistoryRow[]>(() => {
    const payableRows: HistoryRow[] = settlements.map((settlement) => ({
      id: `settlement-${settlement.id}`,
      type: 'PAYABLE',
      date: settlement.settlementDate,
      counterpartyName: placement.cedant.name,
      cashCallNumber: null,
      amount: settlement.amount,
      currency: settlement.currency,
      status: settlement.status,
      reference: settlement.reference,
      isReversible: settlement.status === 'RECORDED' && !settlement.reversalOfSettlementId,
      settlement,
    }));

    const receivableRows: HistoryRow[] = (position?.perCashCall ?? []).flatMap((cashCall) =>
      cashCall.receipts.map((receipt) => ({
        id: `receipt-${receipt.id}`,
        type: 'RECEIVABLE' as const,
        date: receipt.paymentDate,
        counterpartyName: cashCall.counterparty.name,
        cashCallNumber: cashCall.cashCallNumber,
        amount: receipt.amount,
        currency: receipt.currency,
        status: receipt.status,
        reference: receipt.reference,
        isReversible: receipt.status === 'RECORDED' && !receipt.reversalOfReceiptId,
        receipt,
      })),
    );

    return [...payableRows, ...receivableRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [settlements, position, placement.cedant.name]);

  const handleReverse = async (row: HistoryRow) => {
    const notes =
      window.prompt(
        `Reason for reversing this ${row.type === 'PAYABLE' ? 'cedant settlement' : 'recovery receipt'}?`,
      ) ?? undefined;
    try {
      if (row.type === 'PAYABLE' && row.settlement) {
        await reverseSettlement.mutateAsync({ settlementId: row.settlement.id, notes });
        addToast({ message: 'Cedant settlement reversed', type: 'success' });
      } else if (row.receipt) {
        await reverseReceipt.mutateAsync({
          placementId: placement.id,
          claimId: claim.id,
          receiptId: row.receipt.id,
          notes,
        });
        addToast({ message: 'Recovery receipt reversed', type: 'success' });
      }
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  const handleConfirmBank = async (payload: ConfirmPlacementClaimFinancialBankPayload) => {
    if (!confirmTarget) return;
    try {
      if (confirmTarget.type === 'PAYABLE' && confirmTarget.settlement) {
        await confirmSettlementBank.mutateAsync({
          settlementId: confirmTarget.settlement.id,
          ...payload,
        });
        addToast({ message: 'Cedant settlement financially confirmed', type: 'success' });
      } else if (confirmTarget.receipt) {
        await confirmReceiptBank.mutateAsync({
          placementId: placement.id,
          claimId: claim.id,
          receiptId: confirmTarget.receipt.id,
          ...payload,
        });
        addToast({ message: 'Recovery receipt financially confirmed', type: 'success' });
      }
      setConfirmTarget(null);
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  const isConfirming = confirmSettlementBank.isPending || confirmReceiptBank.isPending;

  const columns: Column<HistoryRow>[] = [
    {
      key: 'type',
      label: 'Type',
      width: '130px',
      render: (row) => <Badge label={TYPE_LABEL[row.type]} variant={TYPE_VARIANT[row.type]} />,
    },
    {
      key: 'date',
      label: 'Date',
      width: '90px',
      render: (row) => <span className="text-gray-600">{fmtDate(row.date)}</span>,
    },
    {
      key: 'counterparty',
      label: 'Counterparty',
      width: 'minmax(120px, 1fr)',
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-gray-700">{row.counterpartyName}</span>
          {row.cashCallNumber && (
            <span className="text-xs text-gray-400">{row.cashCallNumber}</span>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      width: '150px',
      className: 'text-right pr-8',
      render: (row) => (
        <span className="block text-right font-medium text-gray-900">
          {fmt(row.amount, row.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '130px',
      render: (row) => (
        <Badge
          label={SETTLEMENT_STATUS_LABEL[row.status]}
          variant={SETTLEMENT_STATUS_VARIANT[row.status]}
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
      width: '160px',
      render: (row) =>
        row.isReversible ? (
          <div className="flex items-center gap-2">
            <TableButton
              variant="green"
              isLoading={isConfirming}
              onClick={(event) => {
                event.stopPropagation();
                setConfirmTarget(row);
              }}
            >
              Confirm Bank
            </TableButton>
            <TableButton
              variant="gray"
              isLoading={reverseSettlement.isPending || reverseReceipt.isPending}
              onClick={(event) => {
                event.stopPropagation();
                handleReverse(row);
              }}
            >
              Reverse
            </TableButton>
          </div>
        ) : (
          <span className="text-xs text-gray-400">Historical</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="No settlements or recoveries recorded"
        currentPage={1}
        totalPages={0}
        onPageChange={() => {}}
        noInternalScroll
      />

      {confirmTarget && (
        <ClaimBankConfirmModal
          isOpen
          title={
            confirmTarget.type === 'PAYABLE'
              ? 'Confirm Cedant Settlement Bank Clearance'
              : 'Confirm Recovery Receipt Bank Clearance'
          }
          amount={confirmTarget.amount}
          currency={confirmTarget.currency}
          counterpartyName={confirmTarget.counterpartyName}
          sourceSettlementMethod={
            confirmTarget.settlement?.settlementMethod ??
            confirmTarget.receipt?.settlementMethod ??
            null
          }
          sourceSettlementCurrency={
            confirmTarget.settlement?.settlementCurrency ??
            confirmTarget.receipt?.settlementCurrency ??
            null
          }
          isSubmitting={isConfirming}
          onClose={() => setConfirmTarget(null)}
          onConfirm={handleConfirmBank}
        />
      )}
    </div>
  );
}
