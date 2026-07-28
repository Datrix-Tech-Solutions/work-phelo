'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  Facultative,
  PlacementEndorsement,
  ENDORSEMENT_TYPE_LABELS,
  ENDORSEMENT_STATUS_LABELS,
  ENDORSEMENT_STATUS_VARIANT,
} from '@/types/reinsurance';
import {
  useEndorsementClosings,
  usePlacementEndorsementParticipants,
  usePlacementEndorsementSummary,
  usePlacementEndorsements,
  useReinsurers,
  useUpdateEndorsementParticipant,
  useUpdateEndorsementParticipantStatus,
  useUpdateEndorsementStatus,
  useValidateAndConfirmEndorsementParticipant,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { EndorsementCertificateModal } from '@/components/organisms/reinsurance/documents/EndorsementCertificateModal';
import { EndorsementReinsurerCertificateModal } from '@/components/organisms/reinsurance/documents/EndorsementReinsurerCertificateModal';

interface EndorsementTabProps {
  placement: Facultative;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtVal(val: unknown): string {
  if (val == null || val === '') return '—';
  if (typeof val === 'number') return val.toLocaleString();
  return String(val);
}

function fmtPercent(val: number | null | undefined): string {
  if (val == null) return '—';
  return `${Number(val.toFixed(4)).toLocaleString()}%`;
}

function parsePercent(val: string | number | null | undefined): number | undefined {
  if (val == null || val === '') return undefined;
  const parsed = typeof val === 'number' ? val : Number.parseFloat(val);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const PARAM_FIELDS: { key: string; label: string }[] = [
  { key: 'reference', label: 'Policy Number' },
  { key: 'title', label: 'Insured' },
  { key: 'sumInsured', label: 'Sum Insured' },
  { key: 'rate', label: 'Rate (%)' },
  { key: 'premium', label: 'Premium' },
  { key: 'facultativeOffer', label: 'Fac. Offer (%)' },
  { key: 'commission', label: 'Commission (%)' },
  { key: 'currency', label: 'Currency' },
  { key: 'inceptionDate', label: 'Inception Date' },
  { key: 'expiryDate', label: 'Expiry Date' },
];

const DATE_KEYS = new Set(['inceptionDate', 'expiryDate']);

function getSnapshotPlacement(snapshot: Record<string, unknown>): Record<string, unknown> {
  if (snapshot.placement && typeof snapshot.placement === 'object') {
    return snapshot.placement as Record<string, unknown>;
  }
  return snapshot;
}

function ParameterCards({
  original,
  proposed,
}: {
  original: Record<string, unknown>;
  proposed: Record<string, unknown>;
}) {
  const changedFields = PARAM_FIELDS.filter(({ key }) => {
    const b = proposed[key];
    return b !== undefined && String(original[key] ?? '') !== String(b ?? '');
  });

  if (changedFields.length === 0) {
    return <p className="text-xs text-gray-400 italic">No parameter changes recorded.</p>;
  }

  return (
    <div className="flex gap-4">
      <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50 p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Previous Parameters
        </p>
        <div className="flex flex-col gap-2">
          {changedFields.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500 shrink-0">{label}</span>
              <span className="text-xs font-medium text-gray-700 text-right">
                {DATE_KEYS.has(key) ? fmtDate(original[key] as string) : fmtVal(original[key])}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-green-200 bg-green-50/40 p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
          Revised Parameters
        </p>
        <div className="flex flex-col gap-2">
          {changedFields.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500 shrink-0">{label}</span>
              <span className="text-xs font-medium text-green-700 text-right">
                {DATE_KEYS.has(key) ? fmtDate(proposed[key] as string) : fmtVal(proposed[key])}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EndorsementCard({
  endorsement,
  placement,
}: {
  endorsement: PlacementEndorsement;
  placement: Facultative;
}) {
  const [cedantDocOpen, setCedantDocOpen] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('');
  const [reinsurerDocOpen, setReinsurerDocOpen] = useState(false);
  const [busyParticipantIds, setBusyParticipantIds] = useState<Set<string>>(new Set());

  const { data: reinsurers = [] } = useReinsurers();
  const {
    mutate: updateStatus,
    mutateAsync: updateStatusAsync,
    isPending: isUpdatingStatus,
  } = useUpdateEndorsementStatus(placement.id);
  const { data: endorsementParticipants = [] } = usePlacementEndorsementParticipants(
    placement.id,
    endorsement.id,
  );
  const { data: endorsementSummary } = usePlacementEndorsementSummary(placement.id, endorsement.id);
  const { data: endorsementClosings = [] } = useEndorsementClosings(placement.id, endorsement.id);
  const updateEndorsementParticipant = useUpdateEndorsementParticipant(
    placement.id,
    endorsement.id,
  );
  const updateEndorsementParticipantStatus = useUpdateEndorsementParticipantStatus(
    placement.id,
    endorsement.id,
  );
  const validateAndConfirmEndorsementParticipant = useValidateAndConfirmEndorsementParticipant(
    placement.id,
    endorsement.id,
  );

  const original = getSnapshotPlacement(endorsement.originalSnapshot);
  const proposed = endorsement.proposedSnapshot
    ? getSnapshotPlacement(endorsement.proposedSnapshot)
    : null;

  // Participants who have accepted / closed — these have a closing on the business
  const closingParticipants = placement.participants.filter(
    (p) => p.status === 'ACCEPTED' || p.status === 'CLOSED',
  );

  const reinsurerOptions = closingParticipants.map((p) => {
    const r = reinsurers.find((r) => r.id === p.counterpartyId);
    return { value: p.id, label: r?.name ?? p.counterpartyId };
  });

  const selectedParticipant = closingParticipants.find((p) => p.id === selectedParticipantId);
  const selectedReinsurer = reinsurers.find((r) => r.id === selectedParticipant?.counterpartyId);
  const confirmedEndorsementParticipantIds = useMemo(
    () =>
      new Set(
        endorsementClosings
          .filter((closing) => closing.status === 'CONFIRMED')
          .map((closing) => closing.endorsementParticipantId),
      ),
    [endorsementClosings],
  );
  const closeBlockingReasons = endorsementSummary?.closeBlockingReasons ?? [];
  const isReadyToClose = endorsementSummary?.canClose ?? false;
  const displayedStatusLabel =
    endorsement.status === 'CLOSED'
      ? ENDORSEMENT_STATUS_LABELS[endorsement.status]
      : isReadyToClose
        ? 'Ready to Close'
        : ENDORSEMENT_STATUS_LABELS[endorsement.status];
  const displayedStatusVariant =
    endorsement.status === 'CLOSED'
      ? ENDORSEMENT_STATUS_VARIANT[endorsement.status]
      : isReadyToClose
        ? 'success'
        : ENDORSEMENT_STATUS_VARIANT[endorsement.status];

  const handleSelectReinsurer = (id: string) => {
    setSelectedParticipantId(id);
    if (id) setReinsurerDocOpen(true);
  };

  const setParticipantBusy = (participantId: string, busy: boolean) => {
    setBusyParticipantIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(participantId);
      else next.delete(participantId);
      return next;
    });
  };

  const handleAcceptEndorsementParticipant = async (
    participantId: string,
    signedLinePercent?: number,
  ) => {
    if (busyParticipantIds.has(participantId)) return;
    setParticipantBusy(participantId, true);
    try {
      if (signedLinePercent !== undefined) {
        await updateEndorsementParticipant.mutateAsync({
          participantId,
          signedLinePercent,
        });
      }
      await updateEndorsementParticipantStatus.mutateAsync({
        participantId,
        status: 'ACCEPTED',
      });
      useToastStore.getState().addToast({
        message: 'Endorsement participant accepted.',
        type: 'success',
      });
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    } finally {
      setParticipantBusy(participantId, false);
    }
  };

  const handleValidateEndorsementParticipant = async (participantId: string) => {
    if (busyParticipantIds.has(participantId)) return;
    setParticipantBusy(participantId, true);
    try {
      await validateAndConfirmEndorsementParticipant.mutateAsync({ participantId });
      useToastStore.getState().addToast({
        message: 'Endorsement participant validated and closing confirmed successfully.',
        type: 'success',
      });
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    } finally {
      setParticipantBusy(participantId, false);
    }
  };

  const handleCloseEndorsement = async () => {
    if (!isReadyToClose || isUpdatingStatus) return;
    try {
      await updateStatusAsync({ endorsementId: endorsement.id, status: 'CLOSED' });
      useToastStore.getState().addToast({
        message: 'Endorsement closed.',
        type: 'success',
      });
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-5">
        {/* Header row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-900">
              {endorsement.endorsementNumber}
            </span>
            <Badge label={ENDORSEMENT_TYPE_LABELS[endorsement.type]} variant="neutral" />
            <Badge label={displayedStatusLabel} variant={displayedStatusVariant} />
            <span className="text-xs text-gray-400">{fmtDate(endorsement.effectiveDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            {endorsement.status === 'DRAFT' && (
              <Button
                size="sm"
                isLoading={isUpdatingStatus}
                onClick={() => updateStatus({ endorsementId: endorsement.id, status: 'MARKETING' })}
              >
                Send to Market
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => setCedantDocOpen(true)}>
              Preview Cedant Document
            </Button>
            <SearchSelect
              label=""
              placeholder="Preview Reinsurer Document…"
              options={reinsurerOptions}
              value={selectedParticipantId}
              onChange={handleSelectReinsurer}
              size="sm"
            />
            {endorsement.status !== 'DRAFT' && endorsement.status !== 'CLOSED' && (
              <Button
                size="sm"
                isLoading={isUpdatingStatus}
                disabled={!isReadyToClose}
                onClick={handleCloseEndorsement}
              >
                Close Endorsement
              </Button>
            )}
          </div>
        </div>

        {endorsementSummary && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Target Capacity</p>
              <p className="text-sm font-semibold text-gray-900">
                {fmtPercent(endorsementSummary.targetPercent)}
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs text-blue-600">Accepted Capacity</p>
              <p className="text-sm font-semibold text-blue-800">
                {fmtPercent(endorsementSummary.acceptedPercent)}
              </p>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-xs text-green-600">Confirmed Capacity</p>
              <p className="text-sm font-semibold text-green-800">
                {fmtPercent(endorsementSummary.placedPercent)}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-600">Remaining Capacity</p>
              <p className="text-sm font-semibold text-amber-800">
                {fmtPercent(endorsementSummary.remainingPercent)}
              </p>
            </div>
          </div>
        )}

        {closeBlockingReasons.length > 0 && endorsement.status !== 'CLOSED' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-800">Close readiness blockers</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-amber-700">
              {closeBlockingReasons.map((reason) => (
                <li key={reason.code}>{reason.message}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Reason */}
        {endorsement.reason && (
          <p className="text-sm text-gray-600 border-l-2 border-orange-300 pl-3">
            {endorsement.reason}
          </p>
        )}

        {/* Side-by-side parameter cards (changed fields only) */}
        {proposed && <ParameterCards original={original} proposed={proposed} />}

        <div className="rounded-xl border border-gray-200">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">Endorsement Participants</p>
            <p className="text-xs text-gray-400">
              Participant workflow is endorsement-scoped and does not modify original placement
              lines.
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {endorsementParticipants.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-400">
                No endorsement participants have been added.
              </p>
            ) : (
              endorsementParticipants.map((participant) => {
                const signedLinePercent =
                  parsePercent(participant.signedLinePercent) ??
                  parsePercent(participant.sharePercent);
                const hasConfirmedClosing = confirmedEndorsementParticipantIds.has(participant.id);
                const isBusy = busyParticipantIds.has(participant.id);
                const canAccept =
                  participant.status !== 'ACCEPTED' &&
                  participant.status !== 'CLOSED' &&
                  participant.status !== 'DECLINED';
                const canValidate = participant.status === 'ACCEPTED' && !hasConfirmedClosing;

                return (
                  <div
                    key={participant.id}
                    className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {participant.counterparty?.name ?? participant.counterpartyId}
                      </p>
                      <p className="text-xs text-gray-500">
                        Offered {fmtVal(participant.sharePercent)}% · Signed{' '}
                        {fmtVal(participant.signedLinePercent)}%
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        label={participant.status.replace(/_/g, ' ')}
                        variant={
                          participant.status === 'DECLINED'
                            ? 'danger'
                            : participant.status === 'ACCEPTED' || participant.status === 'CLOSED'
                              ? 'success'
                              : 'warning'
                        }
                      />
                      {hasConfirmedClosing && <Badge label="Closing confirmed" variant="success" />}
                      {canAccept && (
                        <Button
                          size="sm"
                          variant="secondary"
                          isLoading={isBusy}
                          onClick={() =>
                            handleAcceptEndorsementParticipant(participant.id, signedLinePercent)
                          }
                        >
                          Accept Revised Terms
                        </Button>
                      )}
                      {canValidate && (
                        <Button
                          size="sm"
                          isLoading={isBusy}
                          onClick={() => handleValidateEndorsementParticipant(participant.id)}
                        >
                          Validate and Confirm
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">Endorsement Closings</p>
            <p className="text-xs text-gray-400">
              Confirmed endorsement closing snapshots are the placed-capacity source of truth.
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {endorsementClosings.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-400">
                No endorsement closings have been created.
              </p>
            ) : (
              endorsementClosings.map((closing) => {
                const participant = endorsementParticipants.find(
                  (item) => item.id === closing.endorsementParticipantId,
                );
                return (
                  <div
                    key={closing.id}
                    className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{closing.closingNumber}</p>
                      <p className="text-xs text-gray-500">
                        {participant?.counterparty?.name ?? closing.endorsementParticipantId} ·{' '}
                        Signed {fmtVal(closing.signedLinePercent)}%
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {closing.currency ?? placement.currency ?? ''}
                      </span>
                      <Badge
                        label={closing.status.replace(/_/g, ' ')}
                        variant={closing.status === 'CONFIRMED' ? 'success' : 'warning'}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Cedant document */}
      <EndorsementCertificateModal
        isOpen={cedantDocOpen}
        placement={placement}
        endorsement={endorsement}
        onPrint={() => setCedantDocOpen(false)}
        onClose={() => setCedantDocOpen(false)}
      />

      {/* Reinsurer document */}
      {selectedParticipant && selectedReinsurer && (
        <EndorsementReinsurerCertificateModal
          isOpen={reinsurerDocOpen}
          placement={placement}
          endorsement={endorsement}
          counterpartyId={selectedParticipant.counterpartyId}
          reinsurerName={selectedReinsurer.name}
          sharePercent={parseFloat(
            selectedParticipant.signedLinePercent ?? selectedParticipant.sharePercent ?? '0',
          )}
          brokerageFee={parseFloat(selectedParticipant.brokerageFee ?? '0')}
          onPrint={() => setReinsurerDocOpen(false)}
          onClose={() => setReinsurerDocOpen(false)}
        />
      )}
    </>
  );
}

export function EndorsementTab({ placement }: EndorsementTabProps) {
  const { data: endorsements = [], isLoading } = usePlacementEndorsements(placement.id);

  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-base font-semibold text-gray-900">Policy Endorsement</h3>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading endorsements…</p>
      ) : endorsements.length === 0 ? (
        <p className="text-sm text-gray-400">No endorsements have been made on this policy.</p>
      ) : (
        endorsements.map((e) => (
          <EndorsementCard key={e.id} endorsement={e} placement={placement} />
        ))
      )}
    </div>
  );
}
