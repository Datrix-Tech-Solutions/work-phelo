'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { useClaimCedantSettlements, useClaimRecoveryPosition } from '@/hooks';
import {
  fmtDate,
  fmt,
  OFFSET_CLAIM_RECEIPT_NOTE,
  DIRECT_TO_CEDANT_RECEIPT_NOTE,
} from '@/lib/reinsurance/claimFormat';
import {
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
  reference: string | null;
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

function modeOfPaymentLabel(row: HistoryRow): string {
  if (row.type === 'PAYABLE') {
    return row.settlement?.settlementMethod?.replaceAll('_', ' ') ?? '—';
  }
  const notes = row.receipt?.notes;
  if (notes === OFFSET_CLAIM_RECEIPT_NOTE) return 'Offset Claim';
  if (notes === DIRECT_TO_CEDANT_RECEIPT_NOTE) return 'Direct to Cedant';
  return 'Through Broker';
}

export function ClaimFinancialHistoryTable({ placement, claim }: ClaimFinancialHistoryTableProps) {
  const { data: settlements = [] } = useClaimCedantSettlements(placement.id, claim.id);
  const { data: position } = useClaimRecoveryPosition(placement.id, claim.id);

  const rows = useMemo<HistoryRow[]>(() => {
    const payableRows: HistoryRow[] = settlements.map((settlement) => ({
      id: `settlement-${settlement.id}`,
      type: 'PAYABLE',
      date: settlement.settlementDate,
      counterpartyName: placement.cedant.name,
      cashCallNumber: null,
      amount: settlement.amount,
      currency: settlement.currency,
      reference: settlement.reference,
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
        reference: receipt.reference,
        receipt,
      })),
    );

    return [...payableRows, ...receivableRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [settlements, position, placement.cedant.name]);

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
      key: 'modeOfPayment',
      label: 'Mode of Payment',
      width: '150px',
      render: (row) => (
        <span className="text-xs font-bold text-blue-900">{modeOfPaymentLabel(row)}</span>
      ),
    },
    // {
    //   key: 'reference',
    //   label: 'Reference',
    //   width: 'minmax(120px, 1fr)',
    //   render: (row) => <span className="text-gray-600">{row.reference ?? '—'}</span>,
    // },
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
    </div>
  );
}
