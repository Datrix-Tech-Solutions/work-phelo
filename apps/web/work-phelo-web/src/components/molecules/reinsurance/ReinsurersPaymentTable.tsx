'use client';

import { useMemo, useState } from 'react';
import { PlacementParticipant } from '@/types/reinsurance';
import { MultiSelect } from '@/components/atoms/MultiSelect';

interface ReinsurersPaymentTableProps {
  participants: PlacementParticipant[];
  grossPremium: number;
  currency: string | null;
}

function fmt(val: number, currency: string | null) {
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ReinsurersPaymentTable({
  participants,
  grossPremium,
  currency,
}: ReinsurersPaymentTableProps) {
  const reinsurers = useMemo(() => participants.filter((p) => p.role !== 'BROKER'), [participants]);

  const [selectedIds, setSelectedIds] = useState<string[]>(() => reinsurers.map((p) => p.id));

  const options = useMemo(
    () =>
      reinsurers.map((p) => ({
        value: p.id,
        label: p.counterparty.name,
        sublabel: p.sharePercent ? `${p.sharePercent}% share` : undefined,
      })),
    [reinsurers],
  );

  const selected = reinsurers.filter((p) => selectedIds.includes(p.id));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <MultiSelect
          label="Reinsurers"
          placeholder="Select reinsurers…"
          options={options}
          value={selectedIds}
          onChange={setSelectedIds}
        />
      </div>

      {selected.length > 0 && (
        <>
          {/* Table header */}
          <div className="grid grid-cols-[1fr_80px_120px] px-4 py-2.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
            <span>Reinsurer</span>
            <span className="text-center">Share %</span>
            <span className="text-right">Premium Share</span>
          </div>

          {/* Rows */}
          {selected.map((p) => {
            const share = parseFloat(p.sharePercent ?? '0');
            const amount = grossPremium * (share / 100);
            return (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_80px_120px] px-4 py-3 border-b border-gray-100 text-sm items-center"
              >
                <span className="text-gray-900 font-medium">{p.counterparty.name}</span>
                <span className="text-center text-gray-600">{p.sharePercent ?? '—'}</span>
                <span className="text-right text-gray-900">{fmt(amount, currency)}</span>
              </div>
            );
          })}

          {/* Total row */}
          {(() => {
            const total = selected.reduce(
              (sum, p) => sum + grossPremium * (parseFloat(p.sharePercent ?? '0') / 100),
              0,
            );
            return (
              <div className="grid grid-cols-[1fr_80px_120px] px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm items-center">
                <span className="font-semibold text-gray-900">Total</span>
                <span />
                <span className="text-right font-semibold text-gray-900">
                  {fmt(total, currency)}
                </span>
              </div>
            );
          })()}
        </>
      )}

      {selected.length === 0 && (
        <p className="px-4 py-6 text-sm text-gray-400 text-center">No reinsurers selected.</p>
      )}
    </div>
  );
}
