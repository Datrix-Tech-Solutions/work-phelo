'use client';

import { PlacementEndorsementSummary } from '@/types/reinsurance';
import { ParameterCards } from './ParameterCards';
import { CapacityBar } from './CapacityBar';
import { cardClass } from '@/lib/utils';

interface CapacityRow {
  counterpartyId: string;
  reinsurerName: string;
  share: number;
}

interface EndorsementCapacitySectionProps {
  isDraft: boolean;
  original: Record<string, unknown>;
  proposed: Record<string, unknown> | null;
  endorsementSummary: PlacementEndorsementSummary | undefined;
  summaryTargetPercent: number;
  acceptedCapacityRows: CapacityRow[];
  capacityColorMap: Record<string, string>;
}

export function EndorsementCapacitySection({
  isDraft,
  original,
  proposed,
  endorsementSummary,
  summaryTargetPercent,
  acceptedCapacityRows,
  capacityColorMap,
}: EndorsementCapacitySectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Endorsement Summary
      </p>
      {proposed && <ParameterCards original={original} proposed={proposed} />}
      {!isDraft && endorsementSummary && (
        <div className={cardClass('p-3 flex flex-col gap-3')}>
          <CapacityBar
            acceptedPercent={endorsementSummary.acceptedPercent}
            targetPercent={endorsementSummary.targetPercent ?? summaryTargetPercent}
            rows={acceptedCapacityRows}
            colorMap={capacityColorMap}
          />
        </div>
      )}
    </section>
  );
}
