'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { CreateDistributionPanel } from '@/components/organisms/reinsurance/panels/CreateDistributionPanel';
import {
  DistributionTable,
  DistributionEntry,
  INITIAL_DISTRIBUTION_ENTRIES,
} from '@/components/molecules/reinsurance/tables/DistributionTable';
import { Facultative } from '@/types/reinsurance';

const SEGMENT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#84cc16', // lime
  '#f59e0b', // amber
  '#f97316', // orange (brand)
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#10b981', // emerald
];

interface DistributionListTabProps {
  placement: Facultative;
}

export function DistributionListTab({ placement }: DistributionListTabProps) {
  const { facultativeOffer: facOffer, premium } = placement;
  const [panelOpen, setPanelOpen] = useState(false);
  const [entries, setEntries] = useState<DistributionEntry[]>(
    INITIAL_DISTRIBUTION_ENTRIES.map((e) => ({ ...e, shareLine: facOffer })),
  );

  const facPremium = premium * (facOffer / 100);

  const acceptedEntries = entries.filter((e) => e.status === 'Accepted');
  const placedPct = acceptedEntries.reduce((sum, e) => sum + e.shareLine, 0);
  const availablePct = Math.max(0, facOffer - placedPct);

  // Map entry id → consistent color (by original index in all entries)
  const colorMap = Object.fromEntries(
    entries.map((e, i) => [e.id, SEGMENT_COLORS[i % SEGMENT_COLORS.length]]),
  );

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-semibold text-gray-900">Placement Share Breakdown</h3>
            <p className="text-xs text-gray-400">
              Distributed offers of the Fac. Offer{' '}
              <span className="font-semibold text-gray-600">{facOffer}%</span>
            </p>
          </div>
          <Button size="sm" onClick={() => setPanelOpen(true)}>
            Create Distribution List
          </Button>
        </div>

        {/* Segmented progress bar */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500">
            <span>Placed Capacity</span>
            <span>
              <span className="text-gray-700">{placedPct}%</span>
              <span className="text-gray-400"> / {facOffer}%</span>
            </span>
          </div>

          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
            {acceptedEntries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  width: `${(entry.shareLine / facOffer) * 100}%`,
                  backgroundColor: colorMap[entry.id],
                }}
                className="h-full transition-all duration-500"
              />
            ))}
          </div>

          {/* Available */}
          <p className="text-xs text-gray-400">
            Available: <span className="font-semibold text-gray-600">{availablePct}%</span>
          </p>

          {/* Legend */}
          {entries.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: colorMap[entry.id] }}
                  />
                  <span
                    className="text-xs"
                    style={{
                      color: entry.status === 'Accepted' ? colorMap[entry.id] : undefined,
                    }}
                  >
                    <span className={entry.status !== 'Accepted' ? 'text-gray-400' : 'font-medium'}>
                      {entry.reinsurerCompany}
                    </span>
                    {entry.status === 'Accepted' && (
                      <span className="text-gray-400 font-normal"> · {entry.shareLine}%</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <DistributionTable
          entries={entries}
          onEntriesChange={setEntries}
          facPremium={facPremium}
          placement={placement}
        />
      </div>

      <CreateDistributionPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
