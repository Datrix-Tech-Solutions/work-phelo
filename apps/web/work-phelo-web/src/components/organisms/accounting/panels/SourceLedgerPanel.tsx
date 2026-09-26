'use client';

import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { TableButton } from '@/components/atoms/TableButton';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { MakeSourceLedgerPaymentPanel } from '@/components/organisms/accounting/panels/MakeSourceLedgerPaymentPanel';
import { useSourceLedger } from '@/hooks';
import type {
  SourceLedgerEntry,
  SourceLedgerPaymentState,
  SourceTypeDefinition,
} from '@/types/accounting';

const STATUS_LABEL: Record<SourceLedgerPaymentState, string> = {
  OPEN: 'Unpaid',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
};

const STATUS_VARIANT: Record<SourceLedgerPaymentState, 'neutral' | 'warning' | 'success'> = {
  OPEN: 'neutral',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
};

function fmtAmount(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function SourceLedgerPanel({
  sourceType,
  onClose,
}: {
  sourceType: SourceTypeDefinition | null;
  onClose: () => void;
}) {
  const { data: entries = [], isLoading } = useSourceLedger(sourceType?.id);
  const [payTarget, setPayTarget] = useState<SourceLedgerEntry | null>(null);

  return (
    <>
      <SidePanel
        isOpen={!!sourceType}
        onClose={onClose}
        title={sourceType ? `${sourceType.name} Ledger` : 'Source Ledger'}
        description={
          sourceType ? `Open items posted by ${sourceType.name}, awaiting settlement.` : undefined
        }
      >
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-500">
            No items yet — entries show up here once this source posts a journal entry.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {entry.description}
                  </span>
                  <span className="text-xs text-gray-500">
                    {entry.glAccount.code} — {entry.glAccount.name}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      label={STATUS_LABEL[entry.paymentState]}
                      variant={STATUS_VARIANT[entry.paymentState]}
                    />
                    <span className="text-xs text-gray-500">
                      {fmtAmount(entry.outstandingAmount, entry.currency)} of{' '}
                      {fmtAmount(entry.amount, entry.currency)} outstanding
                    </span>
                  </div>
                </div>
                {entry.paymentState !== 'PAID' && (
                  <TableButton variant="blue" onClick={() => setPayTarget(entry)}>
                    Pay
                  </TableButton>
                )}
              </div>
            ))}
          </div>
        )}
      </SidePanel>

      <MakeSourceLedgerPaymentPanel entry={payTarget} onClose={() => setPayTarget(null)} />
    </>
  );
}
