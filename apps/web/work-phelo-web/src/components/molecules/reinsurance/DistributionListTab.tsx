'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/atoms/Button';
import { CreateDistributionPanel } from '@/components/organisms/reinsurance/panels/CreateDistributionPanel';
import {
  DistributionTable,
  DistributionEntry,
  DistributionStatus,
} from '@/components/molecules/reinsurance/tables/DistributionTable';
import {
  Facultative,
  PlacementLockStatus,
  PlacementParticipant,
  PlacementParticipantStatus,
} from '@/types/reinsurance';
import { ReinsurerEntry } from '@/components/molecules/reinsurance/ReinsurerDistributionSelect';
import {
  useReinsurers,
  useAddParticipant,
  useUpdateParticipant,
  useUpdateParticipantStatus,
  useDeleteParticipant,
  useCreateClosing,
  usePlacementEndorsements,
  usePlacementEndorsementParticipants,
  useCreateEndorsementParticipant,
} from '@/hooks';
import { TERMINAL_ENDORSEMENT_STATUSES } from '@/types/reinsurance';
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
  lockStatus?: PlacementLockStatus;
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

export function DistributionListTab({ placement, lockStatus }: DistributionListTabProps) {
  const facOffer = placement.facultativeOffer ?? 0;
  const premium = placement.premium ?? 0;
  const isLocked = lockStatus?.locked ?? placement.lockStatus?.locked ?? false;

  const { data: reinsurers = [] } = useReinsurers();
  const { mutateAsync: addParticipant, isPending: isAdding } = useAddParticipant(placement.id);
  const { mutateAsync: updateParticipant } = useUpdateParticipant(placement.id);
  const { mutateAsync: updateParticipantStatus } = useUpdateParticipantStatus(placement.id);
  const { mutateAsync: deleteParticipant } = useDeleteParticipant(placement.id);
  const { mutateAsync: createClosing } = useCreateClosing(placement.id);
  const { data: endorsements = [] } = usePlacementEndorsements(placement.id);

  const activeEndorsement = endorsements.find(
    (e) => !TERMINAL_ENDORSEMENT_STATUSES.includes(e.status),
  );
  const hasActiveEndorsement = !!activeEndorsement;

  const { data: endorsementParticipants = [] } = usePlacementEndorsementParticipants(
    placement.id,
    activeEndorsement?.id,
  );
  const { mutateAsync: createEndorsementParticipant } = useCreateEndorsementParticipant(
    placement.id,
    activeEndorsement?.id,
  );

  const confirmedCounterpartyIds = new Set(
    endorsementParticipants
      .filter((p) => p.status === 'ACCEPTED' || p.status === 'CLOSED')
      .map((p) => p.counterpartyId),
  );

  const [panelOpen, setPanelOpen] = useState(false);

  const reinsurerEmails = useMemo<Record<string, string[]>>(
    () =>
      Object.fromEntries(
        reinsurers.map((r) => {
          const emails: string[] = [];
          if (r.email) emails.push(r.email);
          r.contacts.forEach((c) => {
            if (c.email) emails.push(c.email);
          });
          return [r.id, emails];
        }),
      ),
    [reinsurers],
  );

  const toEntries = useCallback(
    (participants: PlacementParticipant[]) =>
      participants
        .filter(
          (p) => p.role === 'REINSURER' || p.role === 'LEAD_REINSURER' || p.role === 'CO_REINSURER',
        )
        .map((p) => participantToEntry(p, reinsurerEmails)),
    [reinsurerEmails],
  );

  const serverEntries = useMemo(
    () => toEntries(placement.participants),
    [placement.participants, toEntries],
  );

  const [patches, setPatches] = useState<Record<string, Partial<DistributionEntry>>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const entries = useMemo(
    () =>
      serverEntries
        .filter((e) => !deletedIds.has(e.id))
        .map((e) => ({ ...e, ...(patches[e.id] ?? {}) })),
    [serverEntries, patches, deletedIds],
  );

  const toast = useToastStore.getState;

  const showLockedToast = () =>
    toast().addToast({
      message: 'Placement is financially locked. Changes require endorsement.',
      type: 'error',
    });

  const patch = (id: string, update: Partial<DistributionEntry>) =>
    setPatches((prev) => ({ ...prev, [id]: { ...prev[id], ...update } }));

  const handleAdd = async (newEntries: ReinsurerEntry[]) => {
    if (isLocked) {
      showLockedToast();
      return;
    }

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
    if (isLocked) {
      showLockedToast();
      return;
    }

    patch(row.id, { shareLine: share });
    updateParticipant({ participantId: row.id, sharePercent: share }).catch((error) =>
      toast().addToast({ message: extractError(error), type: 'error' }),
    );
  };

  const handleBrokerageCommit = (row: DistributionEntry, brokerage: number) => {
    if (isLocked) {
      showLockedToast();
      return;
    }

    patch(row.id, { brokerageFee: brokerage });
    updateParticipant({ participantId: row.id, brokerageFee: brokerage }).catch((error) =>
      toast().addToast({ message: extractError(error), type: 'error' }),
    );
  };

  const handleMailSent = (row: DistributionEntry) => {
    if (isLocked) {
      showLockedToast();
      return;
    }

    // Skip status update when already accepted — ACCEPTED → OFFER_SENT is not a valid transition
    if (row.status === 'Accepted') return;
    updateParticipantStatus({ participantId: row.id, status: 'OFFER_SENT' }).catch((error) =>
      toast().addToast({ message: extractError(error), type: 'error' }),
    );
  };

  const handleAccept = (row: DistributionEntry) => {
    if (isLocked) {
      showLockedToast();
      return;
    }

    const isReconfirm = row.status === 'Accepted';
    patch(row.id, { status: 'Accepted' });
    if (isReconfirm) {
      updateParticipant({
        participantId: row.id,
        sharePercent: row.shareLine,
        signedLinePercent: row.shareLine,
      })
        .then(() =>
          createEndorsementParticipant({
            counterpartyId: row.counterpartyId,
            originalParticipantId: row.id,
            sharePercent: row.shareLine,
            signedLinePercent: row.shareLine,
            status: 'ACCEPTED',
          }),
        )
        .catch((error) => toast().addToast({ message: extractError(error), type: 'error' }));
    } else {
      updateParticipant({
        participantId: row.id,
        sharePercent: row.shareLine,
        signedLinePercent: row.shareLine,
      })
        .then(() => updateParticipantStatus({ participantId: row.id, status: 'ACCEPTED' }))
        .then(() => createClosing(row.id))
        .catch((error) => {
          patch(row.id, { status: 'Pending' });
          toast().addToast({ message: extractError(error), type: 'error' });
        });
    }
  };

  const handleDecline = (row: DistributionEntry) => {
    if (isLocked) {
      showLockedToast();
      return;
    }

    patch(row.id, { status: 'Declined', shareLine: 0 });
    updateParticipant({ participantId: row.id, sharePercent: 0 })
      .then(() => updateParticipantStatus({ participantId: row.id, status: 'DECLINED' }))
      .catch((error) => {
        patch(row.id, { status: 'Pending', shareLine: row.shareLine });
        toast().addToast({ message: extractError(error), type: 'error' });
      });
  };

  const handleDelete = (row: DistributionEntry) => {
    if (isLocked) {
      showLockedToast();
      return;
    }

    setDeletedIds((prev) => new Set([...prev, row.id]));
    deleteParticipant(row.id).catch((error) => {
      setDeletedIds((prev) => {
        const s = new Set(prev);
        s.delete(row.id);
        return s;
      });
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
        {isLocked && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Participant edits are locked</p>
            <p>
              {lockStatus?.reason ??
                'This placement has payment activity. Participant changes require endorsement.'}
            </p>
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-semibold text-gray-900">Placement Share Breakdown</h3>
            <p className="text-xs text-gray-400">
              Distributed offers of the Fac. Offer{' '}
              <span className="font-semibold text-gray-600">{facOffer}%</span>
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setPanelOpen(true)}
            isLoading={isAdding}
            disabled={isLocked}
            title={
              isLocked
                ? 'Placement is financially locked. Add participants through endorsement.'
                : undefined
            }
          >
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
          premium={premium}
          placement={placement}
          hasActiveEndorsement={hasActiveEndorsement}
          confirmedCounterpartyIds={confirmedCounterpartyIds}
          mutationDisabled={isLocked}
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
