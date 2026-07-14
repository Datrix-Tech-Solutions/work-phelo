'use client';

import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Icons } from '@/components/atoms/icons';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { ReinsuranceNotesTable } from '@/components/molecules/reinsurance/ReinsuranceNotesTable';
import {
  Facultative,
  EffectivePlacementView,
  PlacementEndorsement,
  PlacementNote,
  ENDORSEMENT_TYPE_LABELS,
  ENDORSEMENT_STATUS_LABELS,
  ENDORSEMENT_STATUS_VARIANT,
} from '@/types/reinsurance';
import {
  findActivePlacementNoteDocument,
  endorsementClosingsKey,
  endorsementKey,
  endorsementNotesKey,
  endorsementParticipantKey,
  endorsementSummaryKey,
  facultativePlacementKey,
  placementEffectiveViewKey,
  useCedants,
  useCreateEndorsementClosing,
  useEndorsementClosings,
  useEndorsementNotes,
  useGenerateEndorsementCreditNote,
  useGenerateEndorsementDebitNote,
  useGeneratePlacementNoteDocument,
  useIssueEndorsementNote,
  usePlacementDocuments,
  usePlacementEndorsements,
  usePlacementEndorsementSummary,
  usePlacementEffectiveView,
  usePlacementEndorsementParticipants,
  useCreateEndorsementParticipant,
  useUpdateEndorsementParticipant,
  useUpdateEndorsementParticipantStatus,
  useReinsurers,
  useRenderPlacementDocumentPdf,
  useUpdateEndorsementStatus,
  useUpdateEndorsementClosingStatus,
  useVoidEndorsementNote,
} from '@/hooks';
import { EditEndorsementPanel } from '@/components/organisms/reinsurance/panels/EditEndorsementPanel';
import { TableButton } from '@/components/atoms/TableButton';
import { extractError } from '@/lib/extractError';
import { openPdfBlob } from '@/lib/openPdfBlob';
import { useToastStore } from '@/store/toast.store';
import { EndorsementCertificateModal } from '@/components/organisms/reinsurance/documents/EndorsementCertificateModal';
import { EndorsementReinsurerCertificateModal } from '@/components/organisms/reinsurance/documents/EndorsementReinsurerCertificateModal';
import { AddEndorsementReinsurerPanel } from '@/components/organisms/reinsurance/panels/AddEndorsementReinsurerPanel';

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

function fmtMoney(value: number | null, currency: string | null): string {
  if (value === null) return '—';
  return `${currency ? `${currency} ` : ''}${value.toLocaleString(undefined, {
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
    return <p className="text-sm text-gray-400">Loading latest confirmed placement position…</p>;
  }
  if (isError || !view) {
    return (
      <p className="text-sm text-red-500">
        Latest confirmed placement position could not be loaded.
      </p>
    );
  }

  const totals = view.effectiveTotals;
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
          ['Facultative Offer', `${totals.facultativeOfferPercent}%`],
          ['Sum Insured', fmtMoney(totals.sumInsured, totals.currency)],
          ['Effective Premium', fmtMoney(totals.premium, totals.currency)],
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
                <span className="text-sm text-gray-700">{participant.counterparty.name}</span>
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
  isNewReinsurer: boolean;
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
  const [addReinsurerOpen, setAddReinsurerOpen] = useState(false);
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
  const [isOpeningDebitNote, setIsOpeningDebitNote] = useState(false);
  const [openingCreditNoteId, setOpeningCreditNoteId] = useState<string | null>(null);
  const debitNoteInFlightRef = useRef(false);
  const creditNoteInFlightRef = useRef<Set<string>>(new Set());

  const { data: reinsurers = [] } = useReinsurers();
  const { data: cedants = [] } = useCedants();
  const fullCedant = cedants.find((c) => c.id === placement.cedant.id);
  const {
    mutate: updateStatus,
    mutateAsync: updateStatusAsync,
    isPending: isUpdatingStatus,
  } = useUpdateEndorsementStatus(placement.id);
  const { data: endorsementSummary } = usePlacementEndorsementSummary(placement.id, endorsement.id);
  const { data: endorsementParticipants = [] } = usePlacementEndorsementParticipants(
    placement.id,
    endorsement.id,
  );
  const { data: endorsementClosings = [], isLoading: endorsementClosingsLoading } =
    useEndorsementClosings(placement.id, endorsement.id);
  const {
    data: endorsementNotes = [],
    isLoading: endorsementNotesLoading,
    isError: endorsementNotesError,
    refetch: refetchEndorsementNotes,
  } = useEndorsementNotes(placement.id, endorsement.id);
  const { data: documents = [], refetch: refetchDocuments } = usePlacementDocuments(placement.id);
  const createEndorsementParticipantMutation = useCreateEndorsementParticipant(
    placement.id,
    endorsement.id,
  );
  const createEndorsementParticipant = createEndorsementParticipantMutation.mutateAsync;
  const updateEndorsementParticipant = useUpdateEndorsementParticipant(
    placement.id,
    endorsement.id,
  );
  const updateEndorsementParticipantStatus = useUpdateEndorsementParticipantStatus(
    placement.id,
    endorsement.id,
  );
  const generateEndorsementDebitNote = useGenerateEndorsementDebitNote(
    placement.id,
    endorsement.id,
  );
  const generateEndorsementCreditNote = useGenerateEndorsementCreditNote(
    placement.id,
    endorsement.id,
  );
  const generateNoteDocument = useGeneratePlacementNoteDocument(placement.id);
  const renderDocumentPdf = useRenderPlacementDocumentPdf(placement.id);
  const createEndorsementClosing = useCreateEndorsementClosing(placement.id, endorsement.id);
  const updateEndorsementClosingStatus = useUpdateEndorsementClosingStatus(
    placement.id,
    endorsement.id,
  );
  const issueEndorsementNote = useIssueEndorsementNote(placement.id, endorsement.id);
  const voidEndorsementNote = useVoidEndorsementNote(placement.id, endorsement.id);
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

  const exhaustedSnapshotParticipants = snapshotParticipants.filter((p) => {
    const s = String(p.status ?? '');
    return s === 'ACCEPTED' || s === 'CLOSED';
  });

  const snapshotPlacedPct = +exhaustedSnapshotParticipants
    .reduce((sum, p) => sum + parseFloat(String(p.signedLinePercent ?? p.sharePercent ?? '0')), 0)
    .toFixed(4);

  const endorsementBarTotal = +(snapshotPlacedPct + addedCapacity).toFixed(4);

  const snapColorMap = Object.fromEntries(
    snapshotParticipants.map((p, i) => [
      String(p.counterpartyId),
      SEGMENT_COLORS[i % SEGMENT_COLORS.length],
    ]),
  );

  const acceptedCounterpartyIds = new Set(
    endorsementParticipants
      .filter((p) => p.status === 'ACCEPTED' || p.status === 'CLOSED')
      .map((p) => p.counterpartyId),
  );

  const snapshotShareByParticipantId = new Map(
    snapshotParticipants.map((participant) => [
      String(participant.id),
      parseFloat(String(participant.signedLinePercent ?? participant.sharePercent ?? '0')),
    ]),
  );
  const snapshotShareByCounterpartyId = new Map(
    snapshotParticipants.map((participant) => [
      String(participant.counterpartyId),
      parseFloat(String(participant.signedLinePercent ?? participant.sharePercent ?? '0')),
    ]),
  );
  const additionalCapacityFor = (
    participant: (typeof endorsementParticipants)[number],
    value: number,
  ) => {
    if (!participant.originalParticipantId) return value;
    const originalShare =
      snapshotShareByParticipantId.get(participant.originalParticipantId) ??
      snapshotShareByCounterpartyId.get(participant.counterpartyId) ??
      0;
    return Math.max(0, value - originalShare);
  };
  const acceptedAdditionalCapacity = endorsementParticipants
    .filter((participant) => participant.status === 'ACCEPTED' || participant.status === 'CLOSED')
    .reduce(
      (sum, participant) =>
        sum +
        additionalCapacityFor(
          participant,
          parseFloat(participant.signedLinePercent ?? participant.sharePercent ?? '0'),
        ),
      0,
    );
  const reservedAdditionalCapacity = endorsementParticipants
    .filter(
      (participant) =>
        participant.status === 'INVITED' ||
        participant.status === 'OFFER_SENT' ||
        participant.status === 'QUOTED',
    )
    .reduce(
      (sum, participant) =>
        sum + additionalCapacityFor(participant, parseFloat(participant.sharePercent ?? '0')),
      0,
    );
  const remainingCapacity = Math.max(
    0,
    +(addedCapacity - acceptedAdditionalCapacity - reservedAdditionalCapacity).toFixed(4),
  );
  const impactType =
    endorsementSummary?.impactType ??
    endorsement.impactType ??
    (addedCapacity > 0 ? 'CAPACITY_INCREASE' : undefined);
  const marketActivityStatuses = new Set(['MARKETING', 'PARTIALLY_ACCEPTED', 'ACCEPTED']);
  const canAddReinsurer =
    impactType === 'CAPACITY_INCREASE' &&
    remainingCapacity > 0 &&
    marketActivityStatuses.has(endorsement.status);
  const unavailableReinsurerIds = new Set([
    ...snapshotParticipants.map((participant) => String(participant.counterpartyId)),
    ...endorsementParticipants.map((participant) => participant.counterpartyId),
  ]);
  const availableReinsurerOptions = reinsurers
    .filter((reinsurer) => !unavailableReinsurerIds.has(reinsurer.id))
    .map((reinsurer) => ({ value: reinsurer.id, label: reinsurer.name }));

  const handleValidateEndorsementParticipant = async (counterpartyId: string) => {
    const participant = endorsementParticipants.find(
      (item) => item.counterpartyId === counterpartyId,
    );
    if (!participant || participant.status !== 'ACCEPTED') return;

    setBusyEPIds((previous) => new Set([...previous, counterpartyId]));
    try {
      let closing = endorsementClosings.find(
        (item) => item.endorsementParticipantId === participant.id && item.status !== 'VOID',
      );
      if (!closing) {
        closing = await createEndorsementClosing.mutateAsync({
          endorsementParticipantId: participant.id,
          suppressInvalidation: true,
        });
      }
      if (closing.status === 'DRAFT') {
        closing = await updateEndorsementClosingStatus.mutateAsync({
          closingId: closing.id,
          status: 'ISSUED',
          suppressInvalidation: true,
        });
      }
      if (closing.status === 'ISSUED') {
        await updateEndorsementClosingStatus.mutateAsync({
          closingId: closing.id,
          status: 'CONFIRMED',
          suppressInvalidation: true,
        });
      }
      await updateEndorsementParticipantStatus.mutateAsync({
        participantId: participant.id,
        status: 'CLOSED',
        suppressInvalidation: true,
      });
      useToastStore.getState().addToast({
        message: 'Endorsement participant validated and closing confirmed',
        type: 'success',
      });
    } catch (error) {
      useToastStore.getState().addToast({
        message: extractError(error),
        type: 'error',
      });
    } finally {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: endorsementParticipantKey(placement.id, endorsement.id),
        }),
        queryClient.invalidateQueries({
          queryKey: endorsementClosingsKey(placement.id, endorsement.id),
        }),
        queryClient.invalidateQueries({
          queryKey: endorsementNotesKey(placement.id, endorsement.id),
        }),
        queryClient.invalidateQueries({
          queryKey: endorsementKey(placement.id),
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
        queryClient.invalidateQueries({
          queryKey: ['reinsurance', 'dashboard'],
        }),
      ]);
      setBusyEPIds((previous) => {
        const next = new Set(previous);
        next.delete(counterpartyId);
        return next;
      });
    }
  };

  const snapshotRows: EndorsementParticipantRow[] = snapshotParticipants.map((participant) => {
    const counterpartyId = String(participant.counterpartyId);
    const endorsementParticipant = endorsementParticipants.find(
      (item) => item.counterpartyId === counterpartyId,
    );
    const originalShare = parseFloat(
      String(participant.signedLinePercent ?? participant.sharePercent ?? '0'),
    );
    return {
      id: endorsementParticipant?.id ?? counterpartyId,
      participantId: endorsementParticipant?.id,
      counterpartyId,
      reinsurerName:
        endorsementParticipant?.counterparty?.name ??
        reinsurers.find((reinsurer) => reinsurer.id === counterpartyId)?.name ??
        counterpartyId,
      originalShare,
      offeredShare: parseFloat(endorsementParticipant?.sharePercent ?? String(originalShare)),
      brokerageFee: parseFloat(String(participant.brokerageFee ?? '0')),
      isNewReinsurer: false,
    };
  });
  const newReinsurerRows: EndorsementParticipantRow[] = endorsementParticipants
    .filter(
      (participant) =>
        !participant.originalParticipantId &&
        !snapshotShareByCounterpartyId.has(participant.counterpartyId),
    )
    .map((participant) => ({
      id: participant.id,
      participantId: participant.id,
      counterpartyId: participant.counterpartyId,
      reinsurerName:
        participant.counterparty?.name ??
        reinsurers.find((reinsurer) => reinsurer.id === participant.counterpartyId)?.name ??
        participant.counterpartyId,
      originalShare: 0,
      offeredShare: parseFloat(participant.sharePercent ?? '0'),
      brokerageFee: 0,
      isNewReinsurer: true,
    }));
  const endorsementRows = [...snapshotRows, ...newReinsurerRows];

  const handleAcceptEndorsement = async (row: EndorsementParticipantRow) => {
    setBusyEPIds((prev) => new Set([...prev, row.counterpartyId]));
    try {
      const revised = parseFloat(revisedShares[row.counterpartyId] ?? String(row.offeredShare));
      const share = isNaN(revised) ? row.offeredShare : revised;
      if (share <= 0 || (row.isNewReinsurer && share > row.offeredShare)) {
        useToastStore.getState().addToast({
          message: row.isNewReinsurer
            ? `Accepted line must be greater than 0% and cannot exceed the offered ${row.offeredShare}%.`
            : 'Accepted line must be greater than 0%.',
          type: 'error',
        });
        return;
      }

      if (row.participantId) {
        await updateEndorsementParticipant.mutateAsync({
          participantId: row.participantId,
          sharePercent: row.offeredShare,
          signedLinePercent: share,
          status: 'ACCEPTED',
        });
      } else {
        const originalParticipant = placement.participants.find(
          (participant) => participant.counterpartyId === row.counterpartyId,
        );
        await createEndorsementParticipant({
          counterpartyId: row.counterpartyId,
          originalParticipantId: originalParticipant?.id,
          sharePercent: share,
          signedLinePercent: share,
          status: 'ACCEPTED',
        });
      }
      await queryClient.invalidateQueries({
        queryKey: ['reinsurance', 'placements', placement.id, 'endorsements'],
      });
      useToastStore.getState().addToast({
        message: `${row.reinsurerName} line accepted`,
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

  const handleAddReinsurer = async (counterpartyId: string, offeredPercent: number) => {
    try {
      await createEndorsementParticipant({
        counterpartyId,
        sharePercent: offeredPercent,
        status: 'OFFER_SENT',
      });
      setAddReinsurerOpen(false);
      setParticipantsExpanded(true);
      useToastStore.getState().addToast({
        message: 'Reinsurer added to the endorsement capacity offer',
        type: 'success',
      });
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    }
  };

  const epColumns: Column<EndorsementParticipantRow>[] = [
    {
      key: 'reinsurerName',
      label: 'Reinsurer',
      width: '2fr',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{row.reinsurerName}</span>
          {row.isNewReinsurer && <Badge label="New" variant="neutral" />}
        </div>
      ),
    },
    {
      key: 'originalShare',
      label: 'Original Share (%)',
      width: '1fr',
      render: (row) => (
        <span className="text-gray-700">
          {row.isNewReinsurer ? 'New reinsurer' : `${row.originalShare}%`}
        </span>
      ),
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
            max={row.isNewReinsurer ? row.offeredShare : 100}
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
        const ep = endorsementParticipants.find((p) => p.counterpartyId === row.counterpartyId);
        const effectiveShare = acceptedCounterpartyIds.has(row.counterpartyId)
          ? parseFloat(ep?.signedLinePercent ?? ep?.sharePercent ?? String(row.originalShare))
          : parseFloat(revisedShares[row.counterpartyId] ?? String(row.offeredShare));
        const premium = placement.premium ?? 0;
        const netPremium = (effectiveShare / 100) * premium;
        return (
          <span className="text-gray-700">
            {placement.currency ? `${placement.currency} ` : ''}
            {netPremium.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        );
      },
    },
    {
      key: 'id' as keyof EndorsementParticipantRow,
      label: 'Actions',
      width: '130px',
      render: (row) => {
        const isAccepted = acceptedCounterpartyIds.has(row.counterpartyId);
        const isBusy = busyEPIds.has(row.counterpartyId);
        if (endorsement.status === 'CLOSED') {
          return (
            <div className="flex items-center gap-2">
              <TableButton
                variant="blue"
                onClick={() => setTableDocCounterpartyId(row.counterpartyId)}
              >
                Preview Only
              </TableButton>
              <Badge label="Closed" variant="success" />
            </div>
          );
        }
        if (isAccepted) {
          const participant = endorsementParticipants.find(
            (item) => item.counterpartyId === row.counterpartyId,
          );
          const isValidated = endorsementClosings.some(
            (closing) =>
              closing.endorsementParticipantId === participant?.id &&
              closing.status === 'CONFIRMED',
          );
          return (
            <div className="flex items-center gap-2">
              <TableButton
                variant="blue"
                onClick={() => setTableDocCounterpartyId(row.counterpartyId)}
              >
                Preview Only
              </TableButton>
              {isValidated ? (
                <Badge label="Validated" variant="success" />
              ) : (
                <TableButton
                  isLoading={isBusy}
                  onClick={() => handleValidateEndorsementParticipant(row.counterpartyId)}
                >
                  Validate
                </TableButton>
              )}
            </div>
          );
        }
        return (
          <TableButton isLoading={isBusy} onClick={() => handleAcceptEndorsement(row)}>
            Accept Line
          </TableButton>
        );
      },
    },
  ];

  const tableDocEP = endorsementParticipants.find(
    (p) => p.counterpartyId === tableDocCounterpartyId,
  );
  const tableDocReinsurer = reinsurers.find((r) => r.id === tableDocCounterpartyId);
  const tableDocRow = endorsementRows.find((r) => r.counterpartyId === tableDocCounterpartyId);
  const confirmedEndorsementClosings = endorsementClosings.filter(
    (closing) => closing.status === 'CONFIRMED',
  );
  const hasEndorsementNoteWorkflow = endorsement.status !== 'DRAFT';
  const pendingActions = endorsementSummary?.pendingActions ?? [];
  const isReadyToClose = pendingActions.includes('CLOSE_ENDORSEMENT');
  const isInClosingPhase =
    !isReadyToClose &&
    endorsement.status !== 'CLOSED' &&
    (endorsementSummary?.closings.confirmed ?? 0) > 0;
  const displayedStatusLabel = isReadyToClose
    ? 'Ready to Close'
    : isInClosingPhase
      ? 'Closing'
      : ENDORSEMENT_STATUS_LABELS[endorsement.status];
  const displayedStatusVariant = isReadyToClose
    ? 'success'
    : isInClosingPhase
      ? 'warning'
      : ENDORSEMENT_STATUS_VARIANT[endorsement.status];
  const pendingWorkflowMessage = pendingActions.includes('ISSUE_NOTES')
    ? 'Issue the draft endorsement notes before closing.'
    : pendingActions.includes('GENERATE_NOTES')
      ? 'Generate the required endorsement notes before closing.'
      : isReadyToClose
        ? 'All required endorsement work is complete. Ready for manual close.'
        : null;

  const handleCloseEndorsement = async () => {
    if (!isReadyToClose) return;
    try {
      await updateStatusAsync({ endorsementId: endorsement.id, status: 'CLOSED' });
      useToastStore.getState().addToast({
        message: 'Endorsement closed',
        type: 'success',
      });
    } catch (error) {
      useToastStore.getState().addToast({
        message: extractError(error),
        type: 'error',
      });
    }
  };

  const activeEndorsementNotes = endorsementNotes.filter(
    (note) => note.type === 'ENDORSEMENT_DEBIT_NOTE' || note.type === 'ENDORSEMENT_CREDIT_NOTE',
  );

  const findActiveDebitNote = (source = activeEndorsementNotes) =>
    source.find(
      (note) =>
        note.type === 'ENDORSEMENT_DEBIT_NOTE' &&
        note.endorsementId === endorsement.id &&
        note.status !== 'VOID',
    );

  const findActiveCreditNote = (closingId: string, source = activeEndorsementNotes) =>
    source.find(
      (note) =>
        note.type === 'ENDORSEMENT_CREDIT_NOTE' &&
        note.endorsementClosingId === closingId &&
        note.status !== 'VOID',
    );

  const getLatestEndorsementNotes = async () => {
    const latest = await refetchEndorsementNotes();
    return (
      latest.data?.filter(
        (note) => note.type === 'ENDORSEMENT_DEBIT_NOTE' || note.type === 'ENDORSEMENT_CREDIT_NOTE',
      ) ?? []
    );
  };

  const getLatestPlacementDocuments = async () => {
    const latest = await refetchDocuments();
    return latest.data ?? [];
  };

  const ensureNoteDocument = async (note: PlacementNote) => {
    let document = findActivePlacementNoteDocument(documents, note);
    if (!document) {
      document = findActivePlacementNoteDocument(await getLatestPlacementDocuments(), note);
    }
    if (!document) {
      try {
        document = await generateNoteDocument.mutateAsync(note.id);
      } catch (error) {
        document = findActivePlacementNoteDocument(await getLatestPlacementDocuments(), note);
        if (!document) throw error;
      }
    }
    return document;
  };

  const openOfficialNotePdf = async (note: PlacementNote) => {
    const document = await ensureNoteDocument(note);
    const pdf = await renderDocumentPdf.mutateAsync(document.id);
    openPdfBlob(pdf, `${document.documentNumber}.pdf`);
  };

  const handleViewEndorsementDebitNote = async () => {
    if (debitNoteInFlightRef.current) return;
    debitNoteInFlightRef.current = true;
    setIsOpeningDebitNote(true);
    try {
      let note = findActiveDebitNote();
      if (!note) {
        note = findActiveDebitNote(await getLatestEndorsementNotes());
      }
      if (!note) {
        try {
          note = await generateEndorsementDebitNote.mutateAsync();
        } catch (error) {
          note = findActiveDebitNote(await getLatestEndorsementNotes());
          if (!note) throw error;
        }
      }
      await openOfficialNotePdf(note);
      useToastStore
        .getState()
        .addToast({ message: 'Official endorsement debit note PDF opened', type: 'success' });
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    } finally {
      debitNoteInFlightRef.current = false;
      setIsOpeningDebitNote(false);
    }
  };

  const handleViewEndorsementCreditNote = async (closingId: string) => {
    if (creditNoteInFlightRef.current.has(closingId)) return;
    creditNoteInFlightRef.current.add(closingId);
    setOpeningCreditNoteId(closingId);
    try {
      let note = findActiveCreditNote(closingId);
      if (!note) {
        note = findActiveCreditNote(closingId, await getLatestEndorsementNotes());
      }
      if (!note) {
        try {
          note = await generateEndorsementCreditNote.mutateAsync(closingId);
        } catch (error) {
          note = findActiveCreditNote(closingId, await getLatestEndorsementNotes());
          if (!note) throw error;
        }
      }
      await openOfficialNotePdf(note);
      useToastStore
        .getState()
        .addToast({ message: 'Official endorsement credit note PDF opened', type: 'success' });
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    } finally {
      creditNoteInFlightRef.current.delete(closingId);
      setOpeningCreditNoteId((current) => (current === closingId ? null : current));
    }
  };

  const handleIssueEndorsementNote = async (noteId: string) => {
    try {
      await issueEndorsementNote.mutateAsync(noteId);
      useToastStore.getState().addToast({ message: 'Endorsement note issued', type: 'success' });
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    }
  };

  const handleVoidEndorsementNote = async ({
    noteId,
    voidReason,
  }: {
    noteId: string;
    voidReason: string;
  }) => {
    try {
      await voidEndorsementNote.mutateAsync({ noteId, voidReason });
      useToastStore.getState().addToast({ message: 'Endorsement note voided', type: 'success' });
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
                Preview Only Certificate
              </Button>
            )}
            {isReadyToClose && endorsement.status !== 'CLOSED' && (
              <Button size="sm" isLoading={isUpdatingStatus} onClick={handleCloseEndorsement}>
                Close Endorsement
              </Button>
            )}
          </div>
        </div>

        {pendingWorkflowMessage && (
          <p className="text-xs text-gray-500">{pendingWorkflowMessage}</p>
        )}

        {/* Reason */}
        {endorsement.reason && (
          <p className="text-sm text-gray-600 border-l-2 border-orange-300 pl-3">
            {endorsement.reason}
          </p>
        )}

        {/* Side-by-side parameter cards (changed fields only) */}
        {proposed && <ParameterCards original={original} proposed={proposed} />}

        {/* Participants toggle */}
        {endorsement.status !== 'DRAFT' && (endorsementRows.length > 0 || canAddReinsurer) && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setParticipantsExpanded((v) => !v)}
                className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 transition-colors w-fit"
              >
                <Icons.ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-600 ${!participantsExpanded ? '-rotate-90' : ''}`}
                />
                Participants at Endorsement ({endorsementRows.length})
              </button>
              {canAddReinsurer && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setAddReinsurerOpen(true);
                    setParticipantsExpanded(true);
                  }}
                >
                  Add Reinsurer
                </Button>
              )}
            </div>

            <div
              ref={participantsRef}
              className="grid transition-[grid-template-rows] duration-600 ease-in-out"
              style={{ gridTemplateRows: participantsExpanded ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden flex flex-col gap-4">
                {impactType === 'CAPACITY_INCREASE' && addedCapacity > 0 && (
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    {[
                      ['Endorsement Capacity', addedCapacity],
                      ['Already Accepted', acceptedAdditionalCapacity],
                      ['Remaining Capacity', remainingCapacity],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">{value}%</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Snapshot capacity bar — accepted + added capacity */}
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

        {(endorsementClosingsLoading || endorsementClosings.length > 0) && (
          <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Endorsement Closings
              </p>
              <p className="text-xs text-gray-400">
                Confirmed contract records created from validated endorsement lines.
              </p>
            </div>
            {endorsementClosingsLoading ? (
              <p className="text-xs text-gray-400">Loading endorsement closings…</p>
            ) : (
              <div className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-100">
                {endorsementClosings.map((closing) => {
                  const premium = Number(closing.premiumSnapshot);
                  const netPremium =
                    closing.netPremium === null ? null : Number(closing.netPremium);
                  return (
                    <div
                      key={closing.id}
                      className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-5 sm:items-center"
                    >
                      <div>
                        <p className="text-xs text-gray-400">Closing</p>
                        <p className="text-sm font-medium text-gray-900">{closing.closingNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Reinsurer</p>
                        <p className="text-sm text-gray-700">
                          {closing.endorsementParticipant.counterparty.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Signed Line</p>
                        <p className="text-sm text-gray-700">{closing.signedLinePercent}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Premium / Net</p>
                        <p className="text-sm text-gray-700">
                          {fmtMoney(Number.isFinite(premium) ? premium : null, closing.currency)}
                        </p>
                        <p className="text-xs text-gray-400">
                          Net{' '}
                          {fmtMoney(
                            netPremium !== null && Number.isFinite(netPremium) ? netPremium : null,
                            closing.currency,
                          )}
                        </p>
                      </div>
                      <div className="sm:text-right">
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
                  );
                })}
              </div>
            )}
          </div>
        )}

        {hasEndorsementNoteWorkflow && (
          <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Endorsement Notes
                </p>
                <p className="text-xs text-gray-400">
                  Backend-backed debit/credit notes generated from confirmed endorsement closings.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="secondary"
                  isLoading={isOpeningDebitNote}
                  disabled={confirmedEndorsementClosings.length === 0}
                  onClick={handleViewEndorsementDebitNote}
                >
                  View Endorsement Debit Note
                </Button>
                {confirmedEndorsementClosings.map((closing) => (
                  <Button
                    key={closing.id}
                    size="sm"
                    variant="secondary"
                    isLoading={openingCreditNoteId === closing.id}
                    disabled={!!openingCreditNoteId && openingCreditNoteId !== closing.id}
                    onClick={() => handleViewEndorsementCreditNote(closing.id)}
                  >
                    View Endorsement Credit Note {closing.closingNumber}
                  </Button>
                ))}
              </div>
            </div>

            {endorsementClosingsLoading ? (
              <p className="text-xs text-gray-400">Loading endorsement closings…</p>
            ) : confirmedEndorsementClosings.length === 0 ? (
              <p className="text-xs text-gray-400">
                Confirm an endorsement closing before generating endorsement notes.
              </p>
            ) : null}

            <ReinsuranceNotesTable
              notes={activeEndorsementNotes}
              isLoading={endorsementNotesLoading}
              isError={endorsementNotesError}
              emptyMessage="No endorsement notes yet"
              onViewPdf={(note) => {
                void openOfficialNotePdf(note).catch((error) => {
                  useToastStore.getState().addToast({
                    message: extractError(error, 'Failed to open endorsement note PDF'),
                    type: 'error',
                  });
                });
              }}
              onIssue={handleIssueEndorsementNote}
              onVoid={handleVoidEndorsementNote}
              isVoidPending={voidEndorsementNote.isPending}
            />
          </div>
        )}
      </div>

      <EditEndorsementPanel
        isOpen={editPanelOpen}
        placement={placement}
        endorsement={endorsement}
        onClose={() => setEditPanelOpen(false)}
      />

      {addReinsurerOpen && (
        <AddEndorsementReinsurerPanel
          isOpen
          isSaving={createEndorsementParticipantMutation.isPending}
          remainingPercent={remainingCapacity}
          reinsurerOptions={availableReinsurerOptions}
          onClose={() => setAddReinsurerOpen(false)}
          onAdd={handleAddReinsurer}
        />
      )}

      {/* Cedant document */}
      <EndorsementCertificateModal
        isOpen={cedantDocOpen}
        placement={placement}
        endorsement={endorsement}
        cedant={fullCedant}
        onPrint={() => setCedantDocOpen(false)}
        onClose={() => setCedantDocOpen(false)}
      />

      {/* Reinsurer certificate preview, opened from the endorsement participant table. */}
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
              String(tableDocRow.originalShare),
          )}
          brokerageFee={tableDocRow.brokerageFee}
          onPrint={() => setTableDocCounterpartyId(null)}
          onClose={() => setTableDocCounterpartyId(null)}
        />
      )}
    </>
  );
}

export function EndorsementTab({ placement }: EndorsementTabProps) {
  const { data: endorsements = [], isLoading } = usePlacementEndorsements(placement.id);
  const {
    data: effectiveView,
    isLoading: effectiveViewLoading,
    isError: effectiveViewError,
  } = usePlacementEffectiveView(placement.id);

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
