'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Icons } from '@/components/atoms/icons';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import {
  EffectivePlacementView,
  Facultative,
  PlacementEndorsement,
  ENDORSEMENT_TYPE_LABELS,
  ENDORSEMENT_STATUS_LABELS,
  ENDORSEMENT_STATUS_VARIANT,
} from '@/types/reinsurance';
import {
  useCedants,
  usePlacementEndorsements,
  usePlacementEndorsementParticipants,
  useCreateEndorsementParticipant,
  useUpdateEndorsementParticipant,
  useUpdateEndorsementParticipantStatus,
  useEndorsementClosings,
  useValidateAndConfirmEndorsementParticipant,
  usePlacementEndorsementSummary,
  usePlacementEffectiveView,
  useReinsurers,
  useUpdateEndorsementStatus,
  endorsementParticipantKey,
  endorsementClosingsKey,
  endorsementSummaryKey,
  placementEffectiveViewKey,
  facultativePlacementKey,
} from '@/hooks';
import { EditEndorsementPanel } from '@/components/organisms/reinsurance/panels/EditEndorsementPanel';
import { TableButton } from '@/components/atoms/TableButton';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { EndorsementCertificateModal } from '@/components/organisms/reinsurance/documents/EndorsementCertificateModal';
import { EndorsementReinsurerCertificateModal } from '@/components/organisms/reinsurance/documents/EndorsementReinsurerCertificateModal';
import { MailPreviewModal } from '@/components/organisms/reinsurance/MailPreviewModal';
import { CreateDistributionPanel } from '@/components/organisms/reinsurance/panels/CreateDistributionPanel';
import { ReinsurerEntry } from '@/components/molecules/reinsurance/ReinsurerDistributionSelect';
import { SlipPreviewModal } from '@/components/organisms/reinsurance/documents/SlipPreviewModal';
import { cardClass } from '@/lib/utils';

interface EndorsementTabProps {
  placement: Facultative;
}

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

function fmtMoney(value: unknown, currency?: string | null): string {
  const amount = typeof value === 'number' ? value : value == null ? NaN : Number(value);
  if (!Number.isFinite(amount)) return '—';
  return `${currency ? `${currency} ` : ''}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function EffectivePlacementSection({
  view,
  isLoading,
  isError,
}: {
  view: EffectivePlacementView | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return <p className="text-sm text-gray-400">Loading latest confirmed placement position...</p>;
  }
  if (isError || !view) {
    return (
      <p className="text-sm text-red-500">
        Latest confirmed placement position could not be loaded.
      </p>
    );
  }

  const totals = view.effectiveTotals;
  const capacity = view.capacityBreakdown;
  const participationLabels: Record<string, string> = {
    ORIGINAL: 'Original',
    REVISED: 'Revised',
    ADDED: 'New',
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">
            Latest Confirmed Placement Position
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            Read-only view from confirmed placement and endorsement closings. The original placement
            remains unchanged.
          </p>
        </div>
        <Badge label="Read only" variant="neutral" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Original Capacity', `${capacity.originalCapacityPercent ?? '—'}%`],
          ['Effective Capacity', `${capacity.effectiveTotalCapacityPercent}%`],
          ['Confirmed Endorsement Capacity', `${capacity.confirmedEndorsementCapacityPercent}%`],
          ['Remaining Capacity', `${capacity.remainingCapacityPercent}%`],
          ['Sum Insured', fmtMoney(totals.sumInsured, totals.currency)],
          ['Effective Premium', fmtMoney(totals.premium, totals.currency)],
          ['Closing Gross Premium', fmtMoney(totals.grossPremium, totals.currency)],
          ['Closing Net Premium', fmtMoney(totals.netPremium, totals.currency)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Effective Reinsurer Lines ({totals.participantCount})
        </p>
        {view.effectiveParticipants.length === 0 ? (
          <p className="text-xs text-gray-400">No confirmed participant lines yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {view.effectiveParticipants.map((participant) => (
              <div
                key={participant.counterpartyId}
                className="py-2 flex items-center justify-between gap-3"
              >
                <div>
                  <span className="text-sm text-gray-700">{participant.counterparty.name}</span>
                  <p className="text-[11px] text-gray-400">
                    {participationLabels[participant.participationType] ??
                      participant.participationType}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {participant.signedLinePercent}%
                  </p>
                  <p className="text-xs text-gray-500">
                    Net {fmtMoney(participant.netPremium, totals.currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {view.pendingEndorsements.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-800">Pending endorsements</p>
          <p className="text-xs text-amber-700 mt-1">
            {view.pendingEndorsements
              .map(
                (item) => `${item.endorsementNumber} (${ENDORSEMENT_STATUS_LABELS[item.status]})`,
              )
              .join(', ')}
          </p>
          {capacity.acceptedEndorsementCapacityPercent > 0 && (
            <p className="text-xs text-amber-700 mt-1">
              Accepted but not yet effective capacity: {capacity.acceptedEndorsementCapacityPercent}
              %
            </p>
          )}
        </div>
      )}

      {view.warnings.length > 0 && (
        <div className="flex flex-col gap-1">
          {view.warnings.map((warning) => (
            <p key={warning} className="text-xs text-amber-700">
              {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  );
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

function getSnapshotParticipants(snapshot: Record<string, unknown>): Record<string, unknown>[] {
  const ps = snapshot.participants;
  return Array.isArray(ps) ? (ps as Record<string, unknown>[]) : [];
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

interface EndorsementParticipantRow {
  id: string;
  participantId?: string;
  counterpartyId: string;
  reinsurerName: string;
  originalShare: number;
  offeredShare: number;
  brokerageFee: number;
  isNew: boolean;
}

function EndorsementCard({
  endorsement,
  placement,
}: {
  endorsement: PlacementEndorsement;
  placement: Facultative;
}) {
  const [cedantDocOpen, setCedantDocOpen] = useState(false);
  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const [participantsExpanded, setParticipantsExpanded] = useState(false);
  const participantsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!participantsExpanded) return;
    const id = setTimeout(() => {
      participantsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 650);
    return () => clearTimeout(id);
  }, [participantsExpanded]);
  const [revisedShares, setRevisedShares] = useState<Record<string, string>>({});
  const [busyEPIds, setBusyEPIds] = useState<Set<string>>(new Set());
  const [tableDocCounterpartyId, setTableDocCounterpartyId] = useState<string | null>(null);
  const [slipPreviewCounterpartyId, setSlipPreviewCounterpartyId] = useState<string | null>(null);
  const [mailedIds, setMailedIds] = useState<Set<string>>(new Set());
  const [mailPreviewCounterpartyId, setMailPreviewCounterpartyId] = useState<string | null>(null);
  const [addPanelOpen, setAddPanelOpen] = useState(false);

  const { data: reinsurers = [] } = useReinsurers();

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
  const { data: cedants = [] } = useCedants();
  const fullCedant = cedants.find((c) => c.id === placement.cedant.id);
  const { mutate: updateStatus, isPending: isUpdatingStatus } = useUpdateEndorsementStatus(
    placement.id,
  );
  const { data: endorsementParticipants = [] } = usePlacementEndorsementParticipants(
    placement.id,
    endorsement.id,
  );
  const { data: endorsementSummary } = usePlacementEndorsementSummary(placement.id, endorsement.id);
  const { data: endorsementClosings = [] } = useEndorsementClosings(placement.id, endorsement.id);
  const { mutateAsync: createEndorsementParticipant } = useCreateEndorsementParticipant(
    placement.id,
    endorsement.id,
  );
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
  const queryClient = useQueryClient();

  const original = getSnapshotPlacement(endorsement.originalSnapshot);
  const proposed = endorsement.proposedSnapshot
    ? getSnapshotPlacement(endorsement.proposedSnapshot)
    : null;

  const snapshotParticipants = getSnapshotParticipants(endorsement.originalSnapshot).filter(
    (p) => p.role === 'REINSURER' || p.role === 'LEAD_REINSURER' || p.role === 'CO_REINSURER',
  );

  const snapshotFacOffer = parseFloat(String(original.facultativeOffer ?? 0));
  const proposedFacOffer = proposed
    ? parseFloat(String(proposed.facultativeOffer ?? snapshotFacOffer))
    : snapshotFacOffer;
  const addedCapacity = Math.max(0, +(proposedFacOffer - snapshotFacOffer).toFixed(4));

  const snapshotCounterpartyIds = new Set(
    snapshotParticipants.map((p) => String(p.counterpartyId)),
  );

  const exhaustedSnapshotParticipants = snapshotParticipants.filter((p) => {
    const s = String(p.status ?? '');
    return s === 'ACCEPTED' || s === 'CLOSED';
  });

  const snapshotPlacedPct = +exhaustedSnapshotParticipants
    .reduce((sum, p) => sum + parseFloat(String(p.signedLinePercent ?? p.sharePercent ?? '0')), 0)
    .toFixed(4);

  const endorsementBarTotal = +(snapshotPlacedPct + addedCapacity).toFixed(4);

  const acceptedEndorsementParticipants = endorsementParticipants.filter(
    (p) => p.status === 'ACCEPTED' || p.status === 'CLOSED',
  );

  // What's left to offer a new reinsurer once the reinsurers already on the
  // placement before this endorsement have accepted their (possibly revised) line.
  const acceptedOldEndorsementPct = +acceptedEndorsementParticipants
    .filter((p) => snapshotCounterpartyIds.has(p.counterpartyId))
    .reduce((sum, p) => sum + parseFloat(String(p.signedLinePercent ?? p.sharePercent ?? '0')), 0)
    .toFixed(4);

  const leftoverFacOffer = Math.max(0, +(proposedFacOffer - acceptedOldEndorsementPct).toFixed(4));

  const acceptedCounterpartyIds = new Set(
    endorsementParticipants
      .filter((p) => p.status === 'ACCEPTED' || p.status === 'CLOSED')
      .map((p) => p.counterpartyId),
  );

  const snapshotRows: EndorsementParticipantRow[] = snapshotParticipants.map((p) => {
    const r = reinsurers.find((r) => r.id === p.counterpartyId);
    const cid = String(p.counterpartyId);
    const endorsementParticipant = endorsementParticipants.find(
      (item) => item.counterpartyId === cid,
    );
    const originalShare = parseFloat(String(p.signedLinePercent ?? p.sharePercent ?? '0'));
    return {
      id: endorsementParticipant?.id ?? cid,
      participantId: endorsementParticipant?.id,
      counterpartyId: cid,
      reinsurerName: endorsementParticipant?.counterparty?.name ?? r?.name ?? cid,
      originalShare,
      offeredShare: parseFloat(endorsementParticipant?.sharePercent ?? String(originalShare)),
      brokerageFee: parseFloat(String(p.brokerageFee ?? '0')),
      isNew: false,
    };
  });

  const extraRows: EndorsementParticipantRow[] = endorsementParticipants
    .filter((p) => !snapshotCounterpartyIds.has(p.counterpartyId))
    .map((p) => {
      const r = reinsurers.find((r) => r.id === p.counterpartyId);
      const cid = String(p.counterpartyId);
      return {
        id: p.id,
        participantId: p.id,
        counterpartyId: cid,
        reinsurerName: p.counterparty?.name ?? r?.name ?? cid,
        originalShare: 0,
        offeredShare: parseFloat(p.sharePercent ?? '0'),
        brokerageFee: parseFloat(String(r?.brokerageFee ?? '0')),
        isNew: true,
      };
    });

  const endorsementRows: EndorsementParticipantRow[] = [...snapshotRows, ...extraRows];

  const acceptedEndorsementRowsCount = endorsementRows.filter((r) =>
    acceptedCounterpartyIds.has(r.counterpartyId),
  ).length;

  // Built from the combined row list (old + newly-added) so newly-accepted reinsurers
  // get a bar segment color instead of rendering invisibly.
  const snapColorMap = Object.fromEntries(
    endorsementRows.map((r, i) => [r.counterpartyId, SEGMENT_COLORS[i % SEGMENT_COLORS.length]]),
  );

  const invalidateEndorsementView = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: endorsementParticipantKey(placement.id, endorsement.id),
      }),
      queryClient.invalidateQueries({
        queryKey: endorsementClosingsKey(placement.id, endorsement.id),
      }),
      queryClient.invalidateQueries({
        queryKey: endorsementSummaryKey(placement.id, endorsement.id),
      }),
      queryClient.invalidateQueries({
        queryKey: placementEffectiveViewKey(placement.id),
      }),
      queryClient.invalidateQueries({
        queryKey: facultativePlacementKey(placement.id),
        exact: true,
      }),
    ]);
  };

  const handleAddReinsurers = async (entries: ReinsurerEntry[]) => {
    try {
      const existingIds = new Set(endorsementRows.map((row) => row.counterpartyId));
      const newEntries = entries.filter((entry) => !existingIds.has(entry.id));
      await Promise.all(
        newEntries.map((entry) =>
          createEndorsementParticipant({
            counterpartyId: entry.id,
            sharePercent: leftoverFacOffer > 0 ? leftoverFacOffer : undefined,
            status: 'OFFER_SENT',
          }),
        ),
      );
      if (newEntries.length > 0) {
        useToastStore.getState().addToast({
          message: 'Endorsement participant added',
          type: 'success',
        });
      }
      setAddPanelOpen(false);
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    }
  };

  const handleRejectEndorsementParticipant = async (row: EndorsementParticipantRow) => {
    if (!row.participantId || busyEPIds.has(row.counterpartyId)) return;
    setBusyEPIds((prev) => new Set([...prev, row.counterpartyId]));
    try {
      await updateEndorsementParticipantStatus.mutateAsync({
        participantId: row.participantId,
        status: 'DECLINED',
      });
      useToastStore.getState().addToast({
        message: `${row.reinsurerName} declined for this endorsement`,
        type: 'success',
      });
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    } finally {
      setBusyEPIds((prev) => {
        const n = new Set(prev);
        n.delete(row.counterpartyId);
        return n;
      });
    }
  };

  const handleValidateEndorsementParticipant = async (row: EndorsementParticipantRow) => {
    const participant = row.participantId
      ? endorsementParticipants.find((item) => item.id === row.participantId)
      : endorsementParticipants.find((item) => item.counterpartyId === row.counterpartyId);
    if (!participant || participant.status !== 'ACCEPTED' || busyEPIds.has(row.counterpartyId)) {
      return;
    }
    setBusyEPIds((prev) => new Set([...prev, row.counterpartyId]));

    try {
      await validateAndConfirmEndorsementParticipant.mutateAsync({
        participantId: participant.id,
      });

      useToastStore.getState().addToast({
        message: 'Endorsement participant validated and closing confirmed successfully.',
        type: 'success',
      });
    } catch (error) {
      useToastStore.getState().addToast({
        message: extractError(error),
        type: 'error',
      });
    } finally {
      await invalidateEndorsementView();
      setBusyEPIds((prev) => {
        const n = new Set(prev);
        n.delete(row.counterpartyId);
        return n;
      });
    }
  };

  const handleAcceptEndorsement = async (row: EndorsementParticipantRow) => {
    setBusyEPIds((prev) => new Set([...prev, row.counterpartyId]));
    try {
      const revised = parseFloat(revisedShares[row.counterpartyId] ?? String(row.offeredShare));
      const share = isNaN(revised) ? row.offeredShare : revised;

      const originalParticipant = placement.participants.find(
        (p) => p.counterpartyId === row.counterpartyId,
      );

      if (row.participantId) {
        await updateEndorsementParticipant.mutateAsync({
          participantId: row.participantId,
          sharePercent: row.offeredShare,
          signedLinePercent: share,
          status: 'ACCEPTED',
        });
      } else {
        await createEndorsementParticipant({
          counterpartyId: row.counterpartyId,
          originalParticipantId: originalParticipant?.id,
          sharePercent: share,
          signedLinePercent: share,
          status: 'ACCEPTED',
        });
      }

      await invalidateEndorsementView();
      useToastStore.getState().addToast({
        message: `${row.reinsurerName} accepted for this endorsement`,
        type: 'success',
      });
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    } finally {
      setBusyEPIds((prev) => {
        const n = new Set(prev);
        n.delete(row.counterpartyId);
        return n;
      });
    }
  };

  const confirmedClosingByEndorsementParticipantId = Object.fromEntries(
    endorsementClosings
      .filter((closing) => closing.status === 'CONFIRMED')
      .map((closing) => [closing.endorsementParticipantId, closing]),
  );

  const epColumns: Column<EndorsementParticipantRow>[] = [
    {
      key: 'reinsurerName',
      label: 'Reinsurer',
      width: '2fr',
      render: (row) => <span className="font-medium text-gray-900">{row.reinsurerName}</span>,
    },
    {
      key: 'originalShare',
      label: 'Original Share (%)',
      width: '1fr',
      render: (row) => <span className="text-gray-700">{row.originalShare}%</span>,
    },
    {
      key: 'brokerageFee',
      label: 'Brokerage (%)',
      width: '1fr',
      render: (row) => <span className="text-gray-700">{row.brokerageFee}%</span>,
    },
    {
      key: 'counterpartyId',
      label: 'Revised (%)',
      width: '1fr',
      render: (row) => {
        const isAccepted = acceptedCounterpartyIds.has(row.counterpartyId);
        if (isAccepted) {
          const ep = endorsementParticipants.find((p) => p.counterpartyId === row.counterpartyId);
          return (
            <span className="text-gray-700">
              {parseFloat(ep?.signedLinePercent ?? ep?.sharePercent ?? String(row.originalShare))}%
            </span>
          );
        }
        return (
          <input
            type="number"
            min={0}
            max={100}
            value={revisedShares[row.counterpartyId] ?? String(row.offeredShare)}
            onChange={(e) =>
              setRevisedShares((prev) => ({
                ...prev,
                [row.counterpartyId]: e.target.value,
              }))
            }
            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:border-brand"
          />
        );
      },
    },
    {
      key: 'netPremium' as unknown as keyof EndorsementParticipantRow,
      label: 'Net Premium',
      width: '1.2fr',
      render: (row) => {
        const confirmedClosing = row.participantId
          ? confirmedClosingByEndorsementParticipantId[row.participantId]
          : undefined;
        if (!confirmedClosing) {
          return <span className="text-xs text-gray-400">Pending Validation</span>;
        }
        const netPremium =
          confirmedClosing.netPremium === null ? null : Number(confirmedClosing.netPremium);
        return (
          <span className="text-gray-700">
            {confirmedClosing.currency ? `${confirmedClosing.currency} ` : ''}
            {netPremium !== null && Number.isFinite(netPremium)
              ? netPremium.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : '—'}
          </span>
        );
      },
    },
    {
      key: 'id' as keyof EndorsementParticipantRow,
      label: 'Actions',
      width: '150px',
      render: (row) => {
        const endorsementParticipant = endorsementParticipants.find(
          (item) => item.id === row.participantId || item.counterpartyId === row.counterpartyId,
        );
        const isAccepted =
          endorsementParticipant?.status === 'ACCEPTED' ||
          endorsementParticipant?.status === 'CLOSED';
        const isDeclined = endorsementParticipant?.status === 'DECLINED';
        const isValidated = row.participantId
          ? Boolean(confirmedClosingByEndorsementParticipantId[row.participantId])
          : false;
        const isBusy = busyEPIds.has(row.counterpartyId);
        const mailed = mailedIds.has(row.counterpartyId);

        if (row.isNew) {
          const responded = isAccepted || isDeclined;
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                title="View"
                onClick={() => setSlipPreviewCounterpartyId(row.counterpartyId)}
                className="text-blue-500 hover:text-blue-600 transition-colors"
              >
                <Icons.Eye className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Share"
                onClick={() => setMailPreviewCounterpartyId(row.counterpartyId)}
                className="text-green-500 hover:text-green-700 transition-colors"
              >
                <Icons.Mail className="w-4 h-4" />
              </button>
              {mailed && !responded && (
                <button
                  type="button"
                  title={isBusy ? 'Accepting...' : 'Accept'}
                  onClick={() => {
                    if (!isBusy) handleAcceptEndorsement(row);
                  }}
                  disabled={isBusy}
                  className={`text-green-500 hover:text-green-600 transition-colors ${isBusy ? 'opacity-50 cursor-wait' : ''}`}
                >
                  <Icons.Check className="w-4 h-4" />
                </button>
              )}
              {mailed && !responded && (
                <button
                  type="button"
                  title="Reject"
                  onClick={() => handleRejectEndorsementParticipant(row)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <Icons.X className="w-4 h-4" />
                </button>
              )}
              {isDeclined && <Badge label="Declined" variant="danger" />}
              {isAccepted &&
                (isValidated ? (
                  <Badge label="Validated" variant="success" />
                ) : (
                  <TableButton
                    isLoading={isBusy}
                    tooltip="Validate endorsement closing"
                    onClick={() => {
                      if (!isBusy) handleValidateEndorsementParticipant(row);
                    }}
                  >
                    Validate
                  </TableButton>
                ))}
            </div>
          );
        }

        if (isAccepted) {
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                title="Preview Endorsement"
                onClick={() => setTableDocCounterpartyId(row.counterpartyId)}
                className="text-blue-500 hover:text-blue-600 transition-colors"
              >
                <Icons.Eye className="w-4 h-4" />
              </button>
              {isValidated ? (
                <Badge label="Validated" variant="success" />
              ) : (
                <TableButton
                  isLoading={isBusy}
                  tooltip="Validate endorsement closing"
                  onClick={() => {
                    if (!isBusy) handleValidateEndorsementParticipant(row);
                  }}
                >
                  Validate
                </TableButton>
              )}
            </div>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="View Endorsement"
              onClick={() => setTableDocCounterpartyId(row.counterpartyId)}
              className="text-blue-500 hover:text-blue-600 transition-colors"
            >
              <Icons.Eye className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Send Endorsement Email"
              onClick={() => setMailPreviewCounterpartyId(row.counterpartyId)}
              className="text-green-500 hover:text-green-700 transition-colors"
            >
              <Icons.Mail className="w-4 h-4" />
            </button>
            {isDeclined && <Badge label="Declined" variant="danger" />}
            {mailed && (
              <button
                type="button"
                title={isBusy ? 'Accepting...' : 'Accept'}
                onClick={() => {
                  if (!isBusy) handleAcceptEndorsement(row);
                }}
                disabled={isBusy}
                className={`text-green-500 hover:text-green-600 transition-colors ${isBusy ? 'opacity-50 cursor-wait' : ''}`}
              >
                <Icons.Check className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const tableDocEP = endorsementParticipants.find(
    (p) => p.counterpartyId === tableDocCounterpartyId,
  );
  const tableDocReinsurer = reinsurers.find((r) => r.id === tableDocCounterpartyId);
  const tableDocRow = endorsementRows.find((r) => r.counterpartyId === tableDocCounterpartyId);
  const slipPreviewRow = endorsementRows.find(
    (r) => r.counterpartyId === slipPreviewCounterpartyId,
  );

  return (
    <>
      <div className={cardClass('p-5 flex flex-col gap-5')}>
        {/* Header row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-900">
              {endorsement.endorsementNumber}
            </span>
            <Badge label={ENDORSEMENT_TYPE_LABELS[endorsement.type]} variant="neutral" />
            <Badge
              label={ENDORSEMENT_STATUS_LABELS[endorsement.status]}
              variant={ENDORSEMENT_STATUS_VARIANT[endorsement.status]}
            />
            <span className="text-xs text-gray-400">{fmtDate(endorsement.effectiveDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            {endorsement.status === 'DRAFT' && (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditPanelOpen(true)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  isLoading={isUpdatingStatus}
                  onClick={() => {
                    updateStatus({ endorsementId: endorsement.id, status: 'MARKETING' });
                    setParticipantsExpanded(true);
                  }}
                >
                  Send to Market
                </Button>
              </>
            )}
            {endorsement.status !== 'DRAFT' && (
              <Button size="sm" variant="secondary" onClick={() => setCedantDocOpen(true)}>
                Cedant Document
              </Button>
            )}
          </div>
        </div>

        {/* Reason */}
        {endorsement.reason && (
          <p className="text-sm text-gray-600 border-l-2 border-orange-300 pl-3">
            {endorsement.reason}
          </p>
        )}

        {/* Side-by-side parameter cards (changed fields only) */}
        {proposed && <ParameterCards original={original} proposed={proposed} />}

        {/* Participants toggle */}
        {endorsement.status !== 'DRAFT' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setParticipantsExpanded((v) => !v)}
                className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 transition-colors w-fit"
              >
                <Icons.ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-600 ${!participantsExpanded ? '-rotate-90' : ''}`}
                />
                Participants at Endorsement ({acceptedEndorsementRowsCount})
              </button>
              <Button size="sm" onClick={() => setAddPanelOpen(true)}>
                Add Endorsement Participant
              </Button>
            </div>

            <div
              ref={participantsRef}
              className="grid transition-[grid-template-rows] duration-600 ease-in-out"
              style={{ gridTemplateRows: participantsExpanded ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden flex flex-col gap-3">
                {/* Capacity bar — only what has been accepted within this endorsement */}
                {endorsementBarTotal > 0 && (
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="flex items-center justify-between text-xs font-medium text-gray-500">
                      <span>Accepted Capacity at Endorsement</span>
                      <span>
                        <span className="text-gray-700">{snapshotPlacedPct}%</span>
                        {addedCapacity > 0 && (
                          <>
                            <span className="text-gray-400"> + {addedCapacity}% new</span>
                            <span className="text-gray-400"> / {endorsementBarTotal}%</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
                      {exhaustedSnapshotParticipants.map((p, i) => {
                        const cid = String(p.counterpartyId);
                        const share = parseFloat(
                          String(p.signedLinePercent ?? p.sharePercent ?? '0'),
                        );
                        return (
                          <div
                            key={i}
                            style={{
                              width: `${(share / endorsementBarTotal) * 100}%`,
                              backgroundColor: snapColorMap[cid],
                            }}
                            className="h-full transition-all duration-500"
                          />
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {exhaustedSnapshotParticipants.map((p) => {
                        const cid = String(p.counterpartyId);
                        const r = reinsurers.find((r) => r.id === cid);
                        const share = parseFloat(
                          String(p.signedLinePercent ?? p.sharePercent ?? '0'),
                        );
                        return (
                          <div key={cid} className="flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: snapColorMap[cid] }}
                            />
                            <span
                              className="text-xs font-medium"
                              style={{ color: snapColorMap[cid] }}
                            >
                              {r?.name ?? cid}
                              <span className="text-gray-400 font-normal"> · {share}%</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <DataTable
                  columns={epColumns}
                  data={endorsementRows}
                  emptyMessage="No participants recorded"
                  currentPage={1}
                  totalPages={1}
                  onPageChange={() => {}}
                  noInternalScroll
                />
              </div>
            </div>
          </div>
        )}

        {endorsement.status !== 'DRAFT' && endorsementSummary && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 lg:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">Target Capacity</p>
              <p className="text-sm font-semibold text-gray-900">
                {endorsementSummary.targetPercent ?? '—'}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Accepted Capacity</p>
              <p className="text-sm font-semibold text-gray-900">
                {endorsementSummary.acceptedPercent}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Confirmed Capacity</p>
              <p className="text-sm font-semibold text-gray-900">
                {endorsementSummary.placedPercent}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Confirmed Closings</p>
              <p className="text-sm font-semibold text-gray-900">
                {endorsementSummary.closings.confirmed}/{acceptedEndorsementRowsCount}
              </p>
            </div>
          </div>
        )}

        {endorsementClosings.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Endorsement Closings
              </p>
              <p className="text-xs text-gray-400">
                Backend closing snapshots. Original placement closings are not changed here.
              </p>
            </div>
            <div className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-100">
              {endorsementClosings.map((closing) => (
                <div
                  key={closing.id}
                  className="grid grid-cols-2 gap-3 p-3 lg:grid-cols-6 lg:items-center"
                >
                  <div>
                    <p className="text-xs text-gray-400">Closing</p>
                    <p className="text-sm font-medium text-gray-900">{closing.closingNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Reinsurer</p>
                    <p className="text-sm text-gray-700">
                      {closing.endorsementParticipant?.counterparty?.name ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Accepted Share</p>
                    <p className="text-sm text-gray-700">{closing.signedLinePercent}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Gross Premium</p>
                    <p className="text-sm text-gray-700">
                      Gross {fmtMoney(closing.premiumSnapshot, closing.currency)}
                    </p>
                    <p className="text-xs text-gray-400">
                      Commission {fmtMoney(closing.commissionAmount, closing.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Net Premium</p>
                    <p className="text-sm text-gray-700">
                      Net {fmtMoney(closing.netPremium, closing.currency)}
                    </p>
                  </div>
                  <div className="lg:text-right">
                    <Badge
                      label={
                        closing.status === 'CONFIRMED'
                          ? 'Confirmed'
                          : closing.status === 'ISSUED'
                            ? 'Issued'
                            : closing.status === 'VOID'
                              ? 'Void'
                              : 'Draft'
                      }
                      variant={
                        closing.status === 'CONFIRMED'
                          ? 'success'
                          : closing.status === 'VOID'
                            ? 'danger'
                            : 'warning'
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <EditEndorsementPanel
        isOpen={editPanelOpen}
        placement={placement}
        endorsement={endorsement}
        onClose={() => setEditPanelOpen(false)}
      />

      {/* Cedant document */}
      <EndorsementCertificateModal
        isOpen={cedantDocOpen}
        placement={placement}
        endorsement={endorsement}
        cedant={fullCedant}
        onPrint={() => setCedantDocOpen(false)}
        onClose={() => setCedantDocOpen(false)}
      />

      {/* Reinsurer document (via table View Document) */}
      {tableDocCounterpartyId && tableDocReinsurer && tableDocRow && (
        <EndorsementReinsurerCertificateModal
          isOpen={!!tableDocCounterpartyId}
          placement={placement}
          endorsement={endorsement}
          counterpartyId={tableDocCounterpartyId}
          reinsurerName={tableDocReinsurer.name}
          sharePercent={parseFloat(
            tableDocEP?.signedLinePercent ??
              tableDocEP?.sharePercent ??
              revisedShares[tableDocCounterpartyId] ??
              String(tableDocRow.originalShare),
          )}
          brokerageFee={tableDocRow.brokerageFee}
          isAccepted={acceptedCounterpartyIds.has(tableDocCounterpartyId)}
          onPrint={() => setTableDocCounterpartyId(null)}
          onClose={() => setTableDocCounterpartyId(null)}
        />
      )}

      {/* Fac. Offer Slip for newly-added reinsurers */}
      {slipPreviewCounterpartyId && slipPreviewRow && (
        <SlipPreviewModal
          isOpen={!!slipPreviewCounterpartyId}
          placement={placement}
          brokerageFee={slipPreviewRow.brokerageFee}
          counterpartyId={slipPreviewCounterpartyId}
          facultativeOfferOverride={leftoverFacOffer}
          onPrint={() => setSlipPreviewCounterpartyId(null)}
          onClose={() => setSlipPreviewCounterpartyId(null)}
        />
      )}

      {/* Share document with reinsurer */}
      <MailPreviewModal
        key={mailPreviewCounterpartyId ?? ''}
        isOpen={!!mailPreviewCounterpartyId}
        placement={placement}
        brokerageFee={
          endorsementRows.find((r) => r.counterpartyId === mailPreviewCounterpartyId)
            ?.brokerageFee ?? 0
        }
        recipients={reinsurerEmails[mailPreviewCounterpartyId ?? ''] ?? []}
        onSend={() => {
          if (mailPreviewCounterpartyId) {
            setMailedIds((prev) => new Set([...prev, mailPreviewCounterpartyId]));
          }
          setMailPreviewCounterpartyId(null);
        }}
        onClose={() => setMailPreviewCounterpartyId(null)}
      />

      <CreateDistributionPanel
        isOpen={addPanelOpen}
        onClose={() => setAddPanelOpen(false)}
        onAdd={handleAddReinsurers}
        existingIds={endorsementRows.map((r) => r.counterpartyId)}
        title="Add Endorsement Participant"
      />
    </>
  );
}

export function EndorsementTab({ placement }: EndorsementTabProps) {
  const { data: endorsements = [], isLoading } = usePlacementEndorsements(placement.id);
  const {
    data: effectiveView,
    isLoading: effectiveViewLoading,
    isError: effectiveViewError,
  } = usePlacementEffectiveView(placement.id, endorsements.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-base font-semibold text-gray-900">Policy Endorsement</h3>

      {endorsements.length > 0 && (
        <EffectivePlacementSection
          view={effectiveView}
          isLoading={effectiveViewLoading}
          isError={effectiveViewError}
        />
      )}

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
