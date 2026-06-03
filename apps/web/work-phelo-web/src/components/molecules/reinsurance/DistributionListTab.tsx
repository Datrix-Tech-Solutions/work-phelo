'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/atoms/Button';
import { CreateDistributionPanel } from '@/components/organisms/reinsurance/panels/CreateDistributionPanel';
import {
  DistributionTable,
  DistributionEntry,
  DistributionStatus,
} from '@/components/molecules/reinsurance/tables/DistributionTable';
import { Facultative, PlacementParticipant, PlacementParticipantStatus } from '@/types/reinsurance';
import { ReinsurerEntry } from '@/components/molecules/reinsurance/ReinsurerDistributionSelect';
import {
  useReinsurers,
  useAddParticipant,
  useUpdateParticipant,
  useUpdateParticipantStatus,
  useDeleteParticipant,
} from '@/hooks';
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

function participantStatus(s: PlacementParticipantStatus): DistributionStatus {
  if (s === 'ACCEPTED' || s === 'CLOSED') return 'Accepted';
  if (s === 'DECLINED') return 'Declined';
  return 'Pending';
}

function participantToEntry(
  p: PlacementParticipant,
  reinsurerEmails: Record<string, string[]>,
): DistributionEntry {
  return {
    id: p.id,
    counterpartyId: p.counterpartyId,
    reinsurerCompany: p.counterparty.name,
    emails: reinsurerEmails[p.counterpartyId] ?? [],
    shareLine: parseFloat(p.sharePercent ?? '0'),
    brokerageFee: parseFloat(p.brokerageFee ?? '0'),
    status: participantStatus(p.status),
  };
}

export function DistributionListTab({ placement }: DistributionListTabProps) {
  const facOffer = placement.facultativeOffer ?? 0;
  const premium = placement.premium ?? 0;
  const facPremium = premium * (facOffer / 100);

  const { data: reinsurers = [] } = useReinsurers();
  const { mutateAsync: addParticipant, isPending: isAdding } = useAddParticipant(placement.id);
  const { mutateAsync: updateParticipant } = useUpdateParticipant(placement.id);
  const { mutateAsync: updateParticipantStatus } = useUpdateParticipantStatus(placement.id);
  const { mutateAsync: deleteParticipant } = useDeleteParticipant(placement.id);

  const [panelOpen, setPanelOpen] = useState(false);

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

  const toEntries = (participants: typeof placement.participants) =>
    participants
      .filter(
        (p) => p.role === 'REINSURER' || p.role === 'LEAD_REINSURER' || p.role === 'CO_REINSURER',
      )
      .map((p) => participantToEntry(p, reinsurerEmails));

  const [entries, setEntries] = useState<DistributionEntry[]>(() =>
    toEntries(placement.participants),
  );

  // Sync from server after refetch (background reconciliation)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setEntries(toEntries(placement.participants));
  }, [placement.participants]);

  const toast = useToastStore.getState;

  const patch = (id: string, update: Partial<DistributionEntry>) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...update } : e)));

  const handleAdd = async (newEntries: ReinsurerEntry[]) => {
    const existingIds = new Set(placement.participants.map((p) => p.counterpartyId));
    const reinsurersById = Object.fromEntries(reinsurers.map((r) => [r.id, r]));
    for (const e of newEntries.filter((e) => !existingIds.has(e.id))) {
      addParticipant({
        counterpartyId: e.id,
        role: 'REINSURER',
        sharePercent: facOffer,
        brokerageFee: parseFloat(String(reinsurersById[e.id]?.brokerageFee ?? 0)) || 0,
      }).catch((error) => toast().addToast({ message: extractError(error), type: 'error' }));
    }
  };

  const handleShareCommit = (row: DistributionEntry, share: number) => {
    patch(row.id, { shareLine: share });
    updateParticipant({ participantId: row.id, sharePercent: share }).catch((error) =>
      toast().addToast({ message: extractError(error), type: 'error' }),
    );
  };

  const handleBrokerageCommit = (row: DistributionEntry, brokerage: number) => {
    patch(row.id, { brokerageFee: brokerage });
    updateParticipant({ participantId: row.id, brokerageFee: brokerage }).catch((error) =>
      toast().addToast({ message: extractError(error), type: 'error' }),
    );
  };

  const handleMailSent = (row: DistributionEntry) => {
    updateParticipantStatus({ participantId: row.id, status: 'OFFER_SENT' }).catch((error) =>
      toast().addToast({ message: extractError(error), type: 'error' }),
    );
  };

  const handleAccept = (row: DistributionEntry) => {
    patch(row.id, { status: 'Accepted' });
    updateParticipant({ participantId: row.id, signedLinePercent: row.shareLine })
      .then(() => updateParticipantStatus({ participantId: row.id, status: 'ACCEPTED' }))
      .catch((error) => {
        patch(row.id, { status: 'Pending' });
        toast().addToast({ message: extractError(error), type: 'error' });
      });
  };

  const handleDecline = (row: DistributionEntry) => {
    patch(row.id, { status: 'Declined', shareLine: 0 });
    updateParticipant({ participantId: row.id, sharePercent: 0 })
      .then(() => updateParticipantStatus({ participantId: row.id, status: 'DECLINED' }))
      .catch((error) => {
        patch(row.id, { status: 'Pending', shareLine: row.shareLine });
        toast().addToast({ message: extractError(error), type: 'error' });
      });
  };

  const handleDelete = (row: DistributionEntry) => {
    setEntries((prev) => prev.filter((e) => e.id !== row.id));
    deleteParticipant(row.id).catch((error) => {
      toast().addToast({ message: extractError(error), type: 'error' });
    });
  };

  const acceptedEntries = entries.filter((e) => e.status === 'Accepted');
  const placedPct = +acceptedEntries.reduce((sum, e) => sum + e.shareLine, 0).toFixed(4);
  const availablePct = Math.max(0, +(facOffer - placedPct).toFixed(4));

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
          <Button size="sm" onClick={() => setPanelOpen(true)} isLoading={isAdding}>
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
          facPremium={facPremium}
          placement={placement}
          onShareCommit={handleShareCommit}
          onBrokerageCommit={handleBrokerageCommit}
          onMailSent={handleMailSent}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onDelete={handleDelete}
        />
      </div>

      <CreateDistributionPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onAdd={handleAdd}
        existingIds={placement.participants.map((p) => p.counterpartyId)}
      />
    </>
  );
}
