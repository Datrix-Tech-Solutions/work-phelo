'use client';

import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { MakeSourceLedgerPaymentPanel } from '@/components/organisms/accounting/panels/MakeSourceLedgerPaymentPanel';
import {
  SOURCE_LEDGER_STATUS_LABEL,
  SOURCE_LEDGER_STATUS_VARIANT,
  fmtSourceLedgerAmount,
} from '@/lib/accounting/sourceLedgerDisplay';
import type { SourceLedgerEntry } from '@/types/accounting';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

/** One source ledger entry's full story — what it is, its journal, and every payment ever
 *  allocated against it — plus the ability to record a new payment if it isn't fully paid. */
export function SourceLedgerEntryDetailPanel({
  entry,
  onClose,
}: {
  entry: SourceLedgerEntry | null;
  onClose: () => void;
}) {
  const [payTarget, setPayTarget] = useState<SourceLedgerEntry | null>(null);

  return (
    <>
      <SidePanel
        isOpen={!!entry}
        onClose={onClose}
        title={entry?.description ?? 'Entry'}
        description={entry ? `Journal ${entry.journalEntry.journalNumber}` : undefined}
        footer={
          entry &&
          entry.paymentState !== 'PAID' && (
            <Button className="w-full" onClick={() => setPayTarget(entry)}>
              Make Payment
            </Button>
          )
        }
      >
        {entry && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Account</span>
                <span className="font-medium text-gray-900">
                  {entry.glAccount.code} — {entry.glAccount.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Event Date</span>
                <span className="font-medium text-gray-900">{fmtDate(entry.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Status</span>
                <Badge
                  label={SOURCE_LEDGER_STATUS_LABEL[entry.paymentState]}
                  variant={SOURCE_LEDGER_STATUS_VARIANT[entry.paymentState]}
                />
              </div>
              <div className="border-t border-gray-100 pt-2 flex items-center justify-between text-sm">
                <span className="text-gray-600">Total</span>
                <span className="font-medium text-gray-900">
                  {fmtSourceLedgerAmount(entry.amount, entry.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Outstanding</span>
                <span className="font-medium text-gray-900">
                  {fmtSourceLedgerAmount(entry.outstandingAmount, entry.currency)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Payment History
              </p>
              {entry.allocations.length === 0 ? (
                <p className="text-sm text-gray-500">No payments recorded yet.</p>
              ) : (
                <div className="flex flex-col divide-y divide-gray-100">
                  {entry.allocations.map((allocation) => (
                    <div key={allocation.id} className="flex items-center justify-between py-2">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm font-medium text-gray-900">
                          {fmtSourceLedgerAmount(allocation.amount, entry.currency)}
                        </span>
                        <span className="text-xs text-gray-500 truncate">
                          {allocation.cashbookTransaction.reference ??
                            allocation.cashbookTransaction.description}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">
                        {fmtDate(allocation.allocatedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SidePanel>

      <MakeSourceLedgerPaymentPanel entry={payTarget} onClose={() => setPayTarget(null)} />
    </>
  );
}
