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
import { Facultative, PlacementParticipant, PlacementParticipantStatus } from '@/types/reinsurance';
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
  facultativePlacementKey,
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
  if (s === 'CLOSED') return 'Closed';
  if (s === 'ACCEPTED') return 'Accepted';
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
  const queryClient = useQueryClient();
  const facOffer = placement.facultativeOffer ?? 0;
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

  const patch = (id: string, update: Partial<DistributionEntry>) =>
    setPatches((prev) => ({ ...prev, [id]: { ...prev[id], ...update } }));

  const refreshPlacementAfterAccept = useCallback(
    () => queryClient.invalidateQueries({ queryKey: facultativePlacementKey(placement.id) }),
    [placement.id, queryClient],
  );

  const handleAdd = async (newEntries: ReinsurerEntry[]) => {
    const existingIds = new Set(placement.participants.map((p) => p.counterpartyId));
    const reinsurersById = Object.fromEntries(reinsurers.map((r) => [r.id, r]));
    const newOnes = newEntries.filter((e) => !existingIds.has(e.id));

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
    patch(row.id, { brokerageFee: brokerage });
    updateParticipant({ participantId: row.id, brokerageFee: brokerage }).catch((error) =>
      toast().addToast({ message: extractError(error), type: 'error' }),
    );
  };

  const handleMailSent = (row: DistributionEntry) => {
    // Skip status update when already accepted — ACCEPTED → OFFER_SENT is not a valid transition
    if (row.status === 'Accepted') return;
    updateParticipantStatus({ participantId: row.id, status: 'OFFER_SENT' }).catch((error) =>
      toast().addToast({ message: extractError(error), type: 'error' }),
    );
  };

  const handleAccept = async (row: DistributionEntry) => {
    if (acceptingIds.has(row.id)) return;
    setAcceptingIds((prev) => new Set([...prev, row.id]));
    patch(row.id, { status: 'Accepted' });

    try {
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
  };

  const handleClose = async (row: DistributionEntry) => {
    if (acceptingIds.has(row.id)) return;
    setAcceptingIds((prev) => new Set([...prev, row.id]));
    patch(row.id, { status: 'Closed' });

    try {
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
        await updateClosingStatus({ closingId, status: 'ISSUED', suppressInvalidation: true });
        await updateClosingStatus({ closingId, status: 'CONFIRMED', suppressInvalidation: true });
      } else if (closingStatus === 'ISSUED') {
        await updateClosingStatus({ closingId, status: 'CONFIRMED', suppressInvalidation: true });
      }

      if (['DRAFT', 'MARKETING', 'PARTIALLY_PLACED'].includes(placement.status)) {
        await updatePlacementStatus({ status: 'PLACED' });
      }
      await updatePlacementStatus({ status: 'CLOSING' });
      await updateParticipantStatus({
        participantId: row.id,
        status: 'CLOSED',
        suppressInvalidation: true,
      });
      toast().addToast({
        message: `A closing for ${row.reinsurerCompany} with ${row.shareLine}% has been created`,
        type: 'success',
      });
    } catch (error) {
      patch(row.id, { status: 'Accepted' });
      toast().addToast({ message: extractError(error), type: 'error' });
    } finally {
      await refreshPlacementAfterAccept();
      setAcceptingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  };

  const handleRevert = (row: DistributionEntry) => {
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
    deleteParticipant(row.id).catch((error) => {
      setDeletedIds((prev) => {
        const s = new Set(prev);
        s.delete(row.id);
        return s;
      });
      toast().addToast({ message: extractError(error), type: 'error' });
    });
  };

  const acceptedEntries = entries.filter((e) => e.status === 'Accepted' || e.status === 'Closed');
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
                      color:
                        entry.status === 'Accepted' || entry.status === 'Closed'
                          ? colorMap[entry.id]
                          : undefined,
                    }}
                  >
                    <span
                      className={
                        entry.status !== 'Accepted' && entry.status !== 'Closed'
                          ? 'text-gray-400'
                          : 'font-medium'
                      }
                    >
                      {entry.reinsurerCompany}
                    </span>
                    {(entry.status === 'Accepted' || entry.status === 'Closed') && (
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
          isPlacementLocked={isPlacementLocked}
          busyIds={acceptingIds}
          onShareCommit={handleShareCommit}
          onBrokerageCommit={handleBrokerageCommit}
          onMailSent={handleMailSent}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onClose={handleClose}
          onDelete={handleDelete}
          onRevert={handleRevert}
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
