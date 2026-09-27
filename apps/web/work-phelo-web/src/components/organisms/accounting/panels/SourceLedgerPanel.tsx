'use client';

import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { useSourceLedger } from '@/hooks';
import {
  SOURCE_LEDGER_STATUS_LABEL,
  SOURCE_LEDGER_STATUS_VARIANT,
  fmtSourceLedgerAmount,
} from '@/lib/accounting/sourceLedgerDisplay';
import type { SourceTypeDefinition } from '@/types/accounting';

const RECENT_LIMIT = 6;

/** A quick glance only — the last few events, most-recent-first. Full history (filtering,
 *  sorting, per-entry payment drill-down) lives on the source type's own details page. */
export function SourceLedgerPanel({
  sourceType,
  onClose,
}: {
  sourceType: SourceTypeDefinition | null;
  onClose: () => void;
}) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const { data: entries = [], isLoading } = useSourceLedger({
    sourceTypeId: sourceType?.id,
    limit: RECENT_LIMIT,
  });

  return (
    <SidePanel
      isOpen={!!sourceType}
      onClose={onClose}
      title={sourceType ? `${sourceType.name} Ledger` : 'Source Ledger'}
      description={sourceType ? `Most recent ${RECENT_LIMIT} events.` : undefined}
      footer={
        sourceType && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              router.push(`/${tenantSlug}/accounting/settings/source-types/${sourceType.id}`)
            }
          >
            View Full History
          </Button>
        )
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
                    label={SOURCE_LEDGER_STATUS_LABEL[entry.paymentState]}
                    variant={SOURCE_LEDGER_STATUS_VARIANT[entry.paymentState]}
                  />
                  <span className="text-xs text-gray-500">
                    {fmtSourceLedgerAmount(entry.outstandingAmount, entry.currency)} of{' '}
                    {fmtSourceLedgerAmount(entry.amount, entry.currency)} outstanding
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SidePanel>
  );
}
