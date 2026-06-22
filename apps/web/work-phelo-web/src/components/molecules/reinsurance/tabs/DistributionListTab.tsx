'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/atoms/Button';
import { CreateDistributionPanel } from '@/components/organisms/reinsurance/panels/CreateDistributionPanel';
import {
  DistributionTable,
  DistributionEntry,
  DistributionStatus,
} from '@/components/molecules/reinsurance/tables/DistributionTable';
import {
  Facultative,
  PlacementEndorsement,
  PlacementEndorsementParticipant,
  PlacementEndorsementParticipantStatus,
  PlacementParticipant,
  PlacementParticipantStatus,
} from '@/types/reinsurance';
import { ReinsurerEntry } from '@/components/molecules/reinsurance/ReinsurerDistributionSelect';
import {
  useReinsurers,
  useAddParticipant,
  useUpdateParticipant,
  useUpdateParticipantStatus,
  useUpdateFacultativeStatus,
  useDeleteParticipant,
  useCreateClosing,
  useUpdateClosingStatus,
  usePlacementClosings,
  usePlacementPayments,
  usePlacementEndorsements,
  usePlacementEndorsementParticipants,
  useCreateEndorsementParticipant,
  useUpdateEndorsementParticipant,
  useUpdateEndorsementParticipantStatus,
  useDeleteEndorsementParticipant,
  facultativePlacementKey,
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
  mode?: 'placement' | 'endorsement';
  endorsement?: PlacementEndorsement;
}

function participantStatus(s: PlacementParticipantStatus): DistributionStatus {
  if (s === 'ACCEPTED' || s === 'CLOSED') return 'Accepted';
  if (s === 'DECLINED') return 'Declined';
  return 'Pending';
}

function endorsementParticipantStatus(
  s: PlacementEndorsementParticipantStatus,
): DistributionStatus {
  if (s === 'ACCEPTED' || s === 'CLOSED') return 'Accepted';
  if (s === 'DECLINED') return 'Declined';
  return 'Pending';
}

function canEndorsementParticipantRespond(s: PlacementEndorsementParticipantStatus): boolean {
  return s === 'OFFER_SENT' || s === 'QUOTED';
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function snapshotPlacement(snapshot: Record<string, unknown> | null | undefined) {
  if (!snapshot) return {};
  if (snapshot.placement && typeof snapshot.placement === 'object') {
    return snapshot.placement as Record<string, unknown>;
  }
  return snapshot;
}

function endorsementCapacityPercent(
  endorsement: PlacementEndorsement | undefined,
  placement: Facultative,
) {
  if (!endorsement) return 0;

  const explicitTarget = numericValue(endorsement.targetPercent);
  if (explicitTarget != null && explicitTarget > 0) return explicitTarget;

  const proposed = snapshotPlacement(endorsement.proposedSnapshot);
  const original = snapshotPlacement(endorsement.originalSnapshot);
  const proposedOffer = numericValue(proposed.facultativeOffer);
  const originalOffer = numericValue(original.facultativeOffer) ?? placement.facultativeOffer ?? 0;

  if (proposedOffer == null) return 0;
  return Math.max(0, +(proposedOffer - originalOffer).toFixed(4));
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

function endorsementParticipantToEntry(
  p: PlacementEndorsementParticipant,
  reinsurerEmails: Record<string, string[]>,
  reinsurerNames: Record<string, string>,
): DistributionEntry {
  const share = parseFloat(p.sharePercent ?? p.signedLinePercent ?? '0');
  return {
    id: p.id,
    counterpartyId: p.counterpartyId,
    reinsurerCompany: p.counterparty?.name ?? reinsurerNames[p.counterpartyId] ?? p.counterpartyId,
    emails: reinsurerEmails[p.counterpartyId] ?? [],
    shareLine: Number.isFinite(share) ? share : 0,
    brokerageFee: 0,
    status: endorsementParticipantStatus(p.status),
    canRespond: canEndorsementParticipantRespond(p.status),
  };
}

export function DistributionListTab({
  placement,
  mode = 'placement',
  endorsement,
}: DistributionListTabProps) {
  const queryClient = useQueryClient();
  const isEndorsementMode = mode === 'endorsement';
  const endorsementCapacity = endorsementCapacityPercent(endorsement, placement);
  const facOffer = isEndorsementMode ? endorsementCapacity : (placement.facultativeOffer ?? 0);
  const premium = placement.premium ?? 0;

  const { data: reinsurers = [] } = useReinsurers();
  const { mutateAsync: addParticipant, isPending: isAdding } = useAddParticipant(placement.id);
  const { mutateAsync: updateParticipant } = useUpdateParticipant(placement.id);
  const { mutateAsync: updateParticipantStatus } = useUpdateParticipantStatus(placement.id);
  const { mutateAsync: updatePlacementStatus } = useUpdateFacultativeStatus(placement.id);
  const { mutateAsync: deleteParticipant } = useDeleteParticipant(placement.id);
  const { mutateAsync: createClosing } = useCreateClosing(placement.id);
  const { mutateAsync: updateClosingStatus } = useUpdateClosingStatus(placement.id);
  const { data: closings = [] } = usePlacementClosings(placement.id);
  const { data: payments = [] } = usePlacementPayments(placement.id);
  const { data: endorsements = [] } = usePlacementEndorsements(placement.id);

  const activeEndorsement = endorsements.find(
    (e) => !TERMINAL_ENDORSEMENT_STATUSES.includes(e.status),
  );
  const hasActiveEndorsement = !!activeEndorsement;

  const { data: endorsementParticipants = [] } = usePlacementEndorsementParticipants(
    placement.id,
    isEndorsementMode ? endorsement?.id : activeEndorsement?.id,
  );
  const { mutateAsync: createEndorsementParticipant, isPending: isAddingEndorsementParticipant } =
    useCreateEndorsementParticipant(
      placement.id,
      isEndorsementMode ? endorsement?.id : activeEndorsement?.id,
    );
  const { mutateAsync: updateEndorsementParticipant } = useUpdateEndorsementParticipant(
    placement.id,
    endorsement?.id,
  );
  const { mutateAsync: updateEndorsementParticipantStatus } = useUpdateEndorsementParticipantStatus(
    placement.id,
    endorsement?.id,
  );
  const { mutateAsync: deleteEndorsementParticipant } = useDeleteEndorsementParticipant(
    placement.id,
    endorsement?.id,
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

  const reinsurerNames = useMemo<Record<string, string>>(
    () => Object.fromEntries(reinsurers.map((r) => [r.id, r.name])),
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

  const toEndorsementEntries = useCallback(
    (participants: PlacementEndorsementParticipant[]) =>
      participants.map((p) => endorsementParticipantToEntry(p, reinsurerEmails, reinsurerNames)),
    [reinsurerEmails, reinsurerNames],
  );

  const serverEntries = useMemo(
    () =>
      isEndorsementMode
        ? toEndorsementEntries(endorsementParticipants)
        : toEntries(placement.participants),
    [
      endorsementParticipants,
      isEndorsementMode,
      placement.participants,
      toEndorsementEntries,
      toEntries,
    ],
  );

  const [patches, setPatches] = useState<Record<string, Partial<DistributionEntry>>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [acceptingIds, setAcceptingIds] = useState<Set<string>>(new Set());

  const entries = useMemo(
    () =>
      serverEntries
        .filter((e) => !deletedIds.has(e.id))
        .map((e) => ({ ...e, ...(patches[e.id] ?? {}) })),
    [serverEntries, patches, deletedIds],
  );

  const toast = useToastStore.getState;

  const isPlacementLocked = useMemo(
    () => payments.some((p) => p.status === 'RECORDED'),
    [payments],
  );

  const closingByParticipantId = useMemo(
    () =>
      Object.fromEntries(
        closings.filter((c) => c.status !== 'VOID').map((c) => [c.participantId, c]),
      ),
    [closings],
  );

  const endorsementParticipantById = useMemo(
    () => Object.fromEntries(endorsementParticipants.map((p) => [p.id, p])),
    [endorsementParticipants],
  );

  const activeEndorsementShare = useCallback(
    (excludeId?: string) =>
      entries
        .filter((entry) => entry.id !== excludeId && entry.status !== 'Declined')
        .reduce((sum, entry) => sum + entry.shareLine, 0),
    [entries],
  );

  const patch = (id: string, update: Partial<DistributionEntry>) =>
    setPatches((prev) => ({ ...prev, [id]: { ...prev[id], ...update } }));

  const refreshPlacementAfterAccept = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: isEndorsementMode
          ? ['facultative-placements', placement.id, 'endorsements']
          : facultativePlacementKey(placement.id),
      }),
    [isEndorsementMode, placement.id, queryClient],
  );

  const handleAdd = async (newEntries: ReinsurerEntry[]) => {
    const existingIds = new Set(
      isEndorsementMode
        ? endorsementParticipants.map((p) => p.counterpartyId)
        : placement.participants.map((p) => p.counterpartyId),
    );
    const reinsurersById = Object.fromEntries(reinsurers.map((r) => [r.id, r]));
    const newOnes = newEntries.filter((e) => !existingIds.has(e.id));

    if (isEndorsementMode) {
      const remainingShare = Math.max(0, +(facOffer - activeEndorsementShare()).toFixed(4));
      if (remainingShare <= 0) {
        toast().addToast({
          message: 'No endorsement capacity is available to offer.',
          type: 'error',
        });
        return;
      }

      const sharePerEntry = +(remainingShare / Math.max(newOnes.length, 1)).toFixed(4);
      const results = await Promise.allSettled(
        newOnes.map((e) =>
          createEndorsementParticipant({
            counterpartyId: e.id,
            sharePercent: sharePerEntry,
            status: 'INVITED',
          }),
        ),
      );

      results.forEach((r) => {
        if (r.status === 'rejected')
          toast().addToast({ message: extractError(r.reason), type: 'error' });
      });
      return;
    }

    const results = await Promise.allSettled(
      newOnes.map((e) =>
        addParticipant({
          counterpartyId: e.id,
          role: 'REINSURER',
          sharePercent: facOffer,
          brokerageFee: parseFloat(String(reinsurersById[e.id]?.brokerageFee ?? 0)) || 0,
        }),
      ),
    );

    results.forEach((r) => {
      if (r.status === 'rejected')
        toast().addToast({ message: extractError(r.reason), type: 'error' });
    });

    const anyAdded = results.some((r) => r.status === 'fulfilled');
    if (anyAdded && placement.status === 'DRAFT') {
      updatePlacementStatus({ status: 'MARKETING' }).catch((error) =>
        toast().addToast({ message: extractError(error), type: 'error' }),
      );
    }
  };

  const handleShareCommit = (row: DistributionEntry, share: number) => {
    if (isEndorsementMode) {
      const nextTotal = activeEndorsementShare(row.id) + share;
      if (nextTotal > facOffer) {
        toast().addToast({
          message: `Endorsement participant shares cannot exceed ${facOffer}%.`,
          type: 'error',
        });
        return;
      }

      patch(row.id, { shareLine: share });
      const payload =
        row.status === 'Accepted'
          ? { participantId: row.id, sharePercent: share, signedLinePercent: share }
          : { participantId: row.id, sharePercent: share };
      updateEndorsementParticipant(payload).catch((error) =>
        toast().addToast({ message: extractError(error), type: 'error' }),
      );
      return;
    }

    patch(row.id, { shareLine: share });
    // Also reset signedLinePercent so a previously-accepted (then reverted) participant
    // doesn't leave a stale signed line that exceeds the new sharePercent.
    updateParticipant({
      participantId: row.id,
      sharePercent: share,
      signedLinePercent: share,
    }).catch((error) => toast().addToast({ message: extractError(error), type: 'error' }));
  };

  const handleBrokerageCommit = (row: DistributionEntry, brokerage: number) => {
    if (isEndorsementMode) return;

    patch(row.id, { brokerageFee: brokerage });
    updateParticipant({ participantId: row.id, brokerageFee: brokerage }).catch((error) =>
      toast().addToast({ message: extractError(error), type: 'error' }),
    );
  };

  const handleMailSent = (row: DistributionEntry) => {
    if (isEndorsementMode) {
      const participant = endorsementParticipantById[row.id];
      if (!participant || participant.status !== 'INVITED') return;

      updateEndorsementParticipantStatus({
        participantId: row.id,
        status: 'OFFER_SENT',
      }).catch((error) => toast().addToast({ message: extractError(error), type: 'error' }));
      return;
    }

    // Skip status update when already accepted — ACCEPTED → OFFER_SENT is not a valid transition
    if (row.status === 'Accepted') return;
    updateParticipantStatus({ participantId: row.id, status: 'OFFER_SENT' }).catch((error) =>
      toast().addToast({ message: extractError(error), type: 'error' }),
    );
  };

  const handleAccept = async (row: DistributionEntry) => {
    if (acceptingIds.has(row.id)) return;

    if (isEndorsementMode) {
      const nextTotal = activeEndorsementShare(row.id) + row.shareLine;
      if (nextTotal > facOffer) {
        toast().addToast({
          message: `Endorsement accepted share cannot exceed ${facOffer}%.`,
          type: 'error',
        });
        return;
      }

      setAcceptingIds((prev) => new Set([...prev, row.id]));
      patch(row.id, { status: 'Accepted' });

      try {
        await updateEndorsementParticipant({
          participantId: row.id,
          sharePercent: row.shareLine,
          signedLinePercent: row.shareLine,
          status: 'ACCEPTED',
          suppressInvalidation: true,
        });
      } catch (error) {
        patch(row.id, { status: 'Pending' });
        toast().addToast({ message: extractError(error), type: 'error' });
      } finally {
        await refreshPlacementAfterAccept();
        setAcceptingIds((prev) => {
          const next = new Set(prev);
          next.delete(row.id);
          return next;
        });
      }
      return;
    }

    const isReconfirm = row.status === 'Accepted';
    setAcceptingIds((prev) => new Set([...prev, row.id]));
    patch(row.id, { status: 'Accepted' });

    try {
      if (isReconfirm) {
        await updateParticipant({
          participantId: row.id,
          sharePercent: row.shareLine,
          signedLinePercent: row.shareLine,
          suppressInvalidation: true,
        });
        await createEndorsementParticipant({
          counterpartyId: row.counterpartyId,
          originalParticipantId: row.id,
          sharePercent: row.shareLine,
          signedLinePercent: row.shareLine,
          status: 'ACCEPTED',
        });
      } else {
        await updateParticipant({
          participantId: row.id,
          sharePercent: row.shareLine,
          signedLinePercent: row.shareLine,
          suppressInvalidation: true,
        });
        await updateParticipantStatus({
          participantId: row.id,
          status: 'ACCEPTED',
          suppressInvalidation: true,
        });
        let closingId = closingByParticipantId[row.id]?.id;
        let closingStatus = closingByParticipantId[row.id]?.status;

        if (!closingId) {
          const createdClosing = await createClosing({
            participantId: row.id,
            suppressInvalidation: true,
          });
          closingId = createdClosing.id;
          closingStatus = 'DRAFT';
        }

        if (closingStatus === 'DRAFT') {
          await updateClosingStatus({
            closingId,
            status: 'ISSUED',
            suppressInvalidation: true,
          });
          await updateClosingStatus({
            closingId,
            status: 'CONFIRMED',
            suppressInvalidation: true,
          });
        } else if (closingStatus === 'ISSUED') {
          await updateClosingStatus({
            closingId,
            status: 'CONFIRMED',
            suppressInvalidation: true,
          });
        }
      }
    } catch (error) {
      if (isReconfirm) {
        toast().addToast({ message: extractError(error), type: 'error' });
      } else {
        patch(row.id, { status: 'Pending' });
        toast().addToast({
          message: `Participant acceptance did not fully complete. Refreshing placement state. ${extractError(error)}`,
          type: 'error',
        });
      }
    } finally {
      await refreshPlacementAfterAccept();
      setAcceptingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  };

  const handleClosePlacement = () => {
    if (isEndorsementMode) return;

    updatePlacementStatus({ status: 'CLOSING' })
      .then(() => updatePlacementStatus({ status: 'CLOSED' }))
      .catch((error) => toast().addToast({ message: extractError(error), type: 'error' }));
  };

  const handleRevert = (row: DistributionEntry) => {
    if (isEndorsementMode) return;

    patch(row.id, { status: 'Pending' });
    const closing = closingByParticipantId[row.id];
    // Confirmed closings are immutable backend snapshots; do not void from frontend revert flow.
    const canVoidClosing = closing?.status === 'DRAFT' || closing?.status === 'ISSUED';
    const voidClosing = canVoidClosing
      ? updateClosingStatus({ closingId: closing.id, status: 'VOID' })
      : Promise.resolve();
    voidClosing
      .then(() => updateParticipantStatus({ participantId: row.id, status: 'QUOTED' }))
      .catch((error) => {
        patch(row.id, { status: 'Accepted' });
        toast().addToast({ message: extractError(error), type: 'error' });
      });
  };

  const handleDecline = (row: DistributionEntry) => {
    if (isEndorsementMode) {
      patch(row.id, { status: 'Declined', shareLine: 0 });
      updateEndorsementParticipantStatus({ participantId: row.id, status: 'DECLINED' }).catch(
        (error) => {
          patch(row.id, { status: 'Pending', shareLine: row.shareLine });
          toast().addToast({ message: extractError(error), type: 'error' });
        },
      );
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
    setDeletedIds((prev) => new Set([...prev, row.id]));
    const deleteRequest = isEndorsementMode
      ? deleteEndorsementParticipant(row.id)
      : deleteParticipant(row.id);

    deleteRequest.catch((error) => {
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
  const capacityBase = facOffer > 0 ? facOffer : 100;
  const title = isEndorsementMode ? 'Market Share Breakdown' : 'Placement Share Breakdown';
  const capacityLabel = isEndorsementMode ? 'Endorsement Capacity' : 'Fac. Offer';
  const existingCounterpartyIds = isEndorsementMode
    ? endorsementParticipants.map((p) => p.counterpartyId)
    : placement.participants.map((p) => p.counterpartyId);

  const colorMap = Object.fromEntries(
    entries.map((e, i) => [e.id, SEGMENT_COLORS[i % SEGMENT_COLORS.length]]),
  );

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-400">
              Distributed offers of the {capacityLabel}{' '}
              <span className="font-semibold text-gray-600">{facOffer}%</span>
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setPanelOpen(true)}
            isLoading={isEndorsementMode ? isAddingEndorsementParticipant : isAdding}
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
                  width: `${(entry.shareLine / capacityBase) * 100}%`,
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
          hasActiveEndorsement={!isEndorsementMode && hasActiveEndorsement}
          confirmedCounterpartyIds={isEndorsementMode ? undefined : confirmedCounterpartyIds}
          isPlacementLocked={isEndorsementMode ? false : isPlacementLocked}
          allowRevert={!isEndorsementMode}
          disableBrokerageEdit={isEndorsementMode}
          busyIds={acceptingIds}
          onShareCommit={handleShareCommit}
          onBrokerageCommit={handleBrokerageCommit}
          onMailSent={handleMailSent}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onDelete={handleDelete}
          onRevert={handleRevert}
          onClosePlacement={
            !isEndorsementMode && placement.status === 'PLACED' ? handleClosePlacement : undefined
          }
        />
      </div>

      <CreateDistributionPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onAdd={handleAdd}
        existingIds={existingCounterpartyIds}
      />
    </>
  );
}
