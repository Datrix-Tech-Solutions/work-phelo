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
        render: (row) => (
          <span className="text-gray-700 block text-right">
            {fmt(row.netSettled, financialPosition?.currency ?? placement.currency)}
          </span>
        ),
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
        render: (row) => (
          <TableButton disabled={row.outstanding <= 0.0001} onClick={() => setPaymentTarget(row)}>
            Disburse Payment
          </TableButton>
        ),
      },
    ],
    [financialPosition?.currency, placement.currency],
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
