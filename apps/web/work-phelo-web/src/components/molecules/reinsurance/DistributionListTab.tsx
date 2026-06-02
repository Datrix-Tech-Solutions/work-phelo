'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/atoms/Button';
import { CreateDistributionPanel } from '@/components/organisms/reinsurance/panels/CreateDistributionPanel';
import {
  DistributionTable,
  DistributionEntry,
} from '@/components/molecules/reinsurance/tables/DistributionTable';
import {
  Facultative,
  PlacementParticipant,
  PlacementParticipantPayload,
} from '@/types/reinsurance';
import { ReinsurerEntry } from '@/components/molecules/reinsurance/ReinsurerDistributionSelect';
import { useReinsurers, useUpdateFacultative } from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

const SEGMENT_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#84cc16',
  '#f59e0b',
  '#f97316',
  '#ec4899',
  '#06b6d4',
  '#10b981',
];

interface DistributionListTabProps {
  placement: Facultative;
}

function participantToEntry(
  p: PlacementParticipant,
  reinsurerEmails: Record<string, string[]>,
): DistributionEntry {
  let emails: string[] = reinsurerEmails[p.counterpartyId] ?? [];
  let status: DistributionEntry['status'] = 'Pending';

  try {
    const parsed = JSON.parse(p.notes ?? '{}') as { status?: string; emails?: string[] };
    if (Array.isArray(parsed.emails) && parsed.emails.length > 0) emails = parsed.emails;
    if (parsed.status === 'Accepted') status = 'Accepted';
    else if (parsed.status === 'Declined') status = 'Declined';
  } catch {
    // notes is plain text or empty
  }

  return {
    id: p.counterpartyId,
    reinsurerCompany: p.counterparty.name,
    emails,
    shareLine: parseFloat(p.sharePercent ?? '0'),
    brokerageFee: parseFloat(p.brokerageFee ?? '0'),
    status,
  };
}

function entryToParticipant(e: DistributionEntry): PlacementParticipantPayload {
  return {
    counterpartyId: e.id,
    role: 'REINSURER',
    sharePercent: e.shareLine,
    signedLinePercent: e.status === 'Accepted' ? e.shareLine : undefined,
    brokerageFee: e.brokerageFee,
    notes: JSON.stringify({ status: e.status, emails: e.emails }),
  };
}

export function DistributionListTab({ placement }: DistributionListTabProps) {
  const facOffer = placement.facultativeOffer ?? 0;
  const premium = placement.premium ?? 0;

  const { data: reinsurers = [] } = useReinsurers();
  const { mutateAsync: updateFacultative, isPending: isSaving } = useUpdateFacultative();

  const reinsurerEmails: Record<string, string[]> = Object.fromEntries(
    reinsurers.map((r) => {
      const emails: string[] = [];
      if (r.email) emails.push(r.email);
      r.contacts.forEach((c) => {
        if (c.email) emails.push(c.email);
      });
      return [r.id, emails];
    }),
  );

  const [entries, setEntries] = useState<DistributionEntry[]>(() =>
    placement.participants
      .filter(
        (p) => p.role === 'REINSURER' || p.role === 'LEAD_REINSURER' || p.role === 'CO_REINSURER',
      )
      .map((p) => participantToEntry(p, reinsurerEmails)),
  );
  const [panelOpen, setPanelOpen] = useState(false);

  const saveEntries = useCallback(
    async (next: DistributionEntry[]) => {
      setEntries(next);
      try {
        await updateFacultative({
          id: placement.id,
          participants: next.map(entryToParticipant),
        });
      } catch (error) {
        useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
      }
    },
    [placement.id, updateFacultative],
  );

  const handleAdd = useCallback(
    async (newEntries: ReinsurerEntry[]) => {
      const existingIds = new Set(entries.map((e) => e.id));
      const reinsurersById = Object.fromEntries(reinsurers.map((r) => [r.id, r]));
      const toAdd: DistributionEntry[] = newEntries
        .filter((e) => !existingIds.has(e.id))
        .map((e) => ({
          id: e.id,
          reinsurerCompany: e.name,
          emails: e.emails,
          shareLine: facOffer,
          brokerageFee: reinsurersById[e.id]?.brokerageFee ?? 0,
          status: 'Pending' as const,
        }));
      if (toAdd.length === 0) return;
      await saveEntries([...entries, ...toAdd]);
    },
    [entries, reinsurers, saveEntries, facOffer],
  );

  const facPremium = premium * (facOffer / 100);

  const acceptedEntries = entries.filter((e) => e.status === 'Accepted');
  const placedPct = acceptedEntries.reduce((sum, e) => sum + e.shareLine, 0);
  const availablePct = Math.max(0, facOffer - placedPct);

  const colorMap = Object.fromEntries(
    entries.map((e, i) => [e.id, SEGMENT_COLORS[i % SEGMENT_COLORS.length]]),
  );

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-semibold text-gray-900">Placement Share Breakdown</h3>
            <p className="text-xs text-gray-400">
              Distributed offers of the Fac. Offer{' '}
              <span className="font-semibold text-gray-600">{facOffer}%</span>
            </p>
          </div>
          <Button size="sm" onClick={() => setPanelOpen(true)} isLoading={isSaving}>
            Add Reinsurers
          </Button>
        </div>

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

          <p className="text-xs text-gray-400">
            Available: <span className="font-semibold text-gray-600">{availablePct}%</span>
          </p>

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
          onEntriesChange={saveEntries}
          facPremium={facPremium}
          placement={placement}
        />
      </div>

      <CreateDistributionPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onAdd={handleAdd}
        existingIds={entries.map((e) => e.id)}
      />
    </>
  );
}
