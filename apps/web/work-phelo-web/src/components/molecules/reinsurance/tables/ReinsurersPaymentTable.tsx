'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Facultative,
  PlacementFinancialPosition,
  PlacementReinsurerFinancialPosition,
} from '@/types/reinsurance';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { TableButton } from '@/components/atoms/TableButton';
import { RecordDisbursementPanel } from '@/components/organisms/reinsurance/panels/RecordDisbursementPanel';
import { usePlacementPayments } from '@/hooks';

interface ReinsurersPaymentTableProps {
  placement: Facultative;
  financialPosition?: PlacementFinancialPosition | null;
  paidAmount?: number;
  onTotalChange?: (total: number) => void;
}

type ReinsurerPositionRow = PlacementReinsurerFinancialPosition & {
  id: string;
};

function fmt(val: number, currency: string | null) {
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function positionBadge(position: PlacementReinsurerFinancialPosition['position']) {
  if (position === 'SETTLED') return <Badge label="Settled" variant="success" />;
  if (position === 'CREDIT_BALANCE') return <Badge label="Credit" variant="warning" />;
  return <Badge label="Payable" variant="warning" />;
}

export function ReinsurersPaymentTable({
  placement,
  financialPosition,
  onTotalChange,
}: ReinsurersPaymentTableProps) {
  const [paymentTarget, setPaymentTarget] = useState<PlacementReinsurerFinancialPosition | null>(
    null,
  );

  const { data: payments = [] } = usePlacementPayments(placement.id);

  const pendingByCounterparty = useMemo(() => {
    const map = new Map<string, number>();
    for (const payment of payments) {
      if (payment.type !== 'REINSURER_DISBURSEMENT') continue;
      if (payment.status !== 'RECORDED') continue;
      if (payment.reversalOfPaymentId) continue;
      const amount = parseFloat(payment.amount) || 0;
      map.set(payment.counterpartyId, (map.get(payment.counterpartyId) ?? 0) + amount);
    }
    return map;
  }, [payments]);

  const rows = useMemo<ReinsurerPositionRow[]>(
    () =>
      financialPosition?.reinsurers.map((row) => ({
        ...row,
        id: row.counterpartyId,
      })) ?? [],
    [financialPosition?.reinsurers],
  );

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + row.currentEffectivePayable, 0),
    [rows],
  );

  useEffect(() => {
    onTotalChange?.(total);
  }, [total, onTotalChange]);

  const columns: Column<ReinsurerPositionRow>[] = useMemo(
    () => [
      {
        key: 'counterpartyName',
        label: 'Reinsurer',
        width: 'minmax(150px, 1fr)',
        render: (row) => <span className="font-medium text-gray-900">{row.counterpartyName}</span>,
      },
      {
        key: 'currentEffectivePayable',
        label: 'Current Payable',
        width: '130px',
        className: 'text-right',
        render: (row) => (
          <span className="text-gray-900 block text-right">
            {fmt(row.currentEffectivePayable, financialPosition?.currency ?? placement.currency)}
          </span>
        ),
      },
      {
        key: 'paid',
        label: 'Paid',
        width: '130px',
        className: 'text-right',
        render: (row) => {
          const currency = financialPosition?.currency ?? placement.currency;
          if (row.netSettled > 0.0001) {
            return (
              <span className="block text-right font-bold text-green-600">
                {fmt(row.netSettled, currency)}
              </span>
            );
          }
          const pending = pendingByCounterparty.get(row.counterpartyId) ?? 0;
          if (pending > 0.0001) {
            return (
              <span className="block text-right font-medium text-amber-600">
                {fmt(pending, currency)}
                {/* <span className="block text-xs font-normal text-amber-500">Pending approval</span> */}
              </span>
            );
          }
          return <span className="block text-right text-gray-700">{fmt(0, currency)}</span>;
        },
      },
      {
        key: 'outstanding',
        label: 'Outstanding',
        width: '140px',
        className: 'text-right',
        render: (row) => (
          <span
            className={`block text-right font-medium ${
              row.outstanding > 0 ? 'text-orange-600' : 'text-gray-900'
            }`}
          >
            {fmt(Math.abs(row.outstanding), financialPosition?.currency ?? placement.currency)}
          </span>
        ),
      },
      {
        key: 'position',
        label: 'Status',
        width: '100px',
        render: (row) => positionBadge(row.position),
      },
      {
        key: 'counterpartyId',
        label: 'Actions',
        width: '150px',
        className: 'pr-6',
        render: (row) => {
          const pending = pendingByCounterparty.get(row.counterpartyId) ?? 0;
          const fullyPending = pending >= row.outstanding - 0.0001;
          return (
            <TableButton
              disabled={row.outstanding <= 0.0001 || fullyPending}
              onClick={() => setPaymentTarget(row)}
            >
              Disburse Payment
            </TableButton>
          );
        },
      },
    ],
    [financialPosition?.currency, placement.currency, pendingByCounterparty],
  );

  return (
    <div className="flex flex-col gap-0">
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="No current reinsurer obligations"
        currentPage={1}
        totalPages={0}
        onPageChange={() => {}}
        noInternalScroll
      />

      <RecordDisbursementPanel
        placement={placement}
        financialPosition={financialPosition}
        target={paymentTarget}
        onClose={() => setPaymentTarget(null)}
      />
    </div>
  );
}
