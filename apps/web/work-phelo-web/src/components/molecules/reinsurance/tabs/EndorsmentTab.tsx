'use client';

import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Icons } from '@/components/atoms/icons';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import {
  EffectivePlacementView,
  EndorsementParticipantClosing,
  Facultative,
  PlacementEndorsement,
  PlacementDocument,
  PlacementNote,
  ENDORSEMENT_TYPE_LABELS,
  ENDORSEMENT_STATUS_LABELS,
  ENDORSEMENT_STATUS_VARIANT,
} from '@/types/reinsurance';
import {
  usePlacementEndorsements,
  usePlacementEndorsementParticipants,
  useCreateEndorsementParticipant,
  useUpdateEndorsementParticipant,
  useUpdateEndorsementParticipantStatus,
  useEndorsementClosings,
  usePlacementDocuments,
  usePlacementEndorsementNotes,
  useValidateAndConfirmEndorsementParticipant,
  usePlacementEndorsementSummary,
  usePlacementEffectiveView,
  useReinsurers,
  useUpdateEndorsementStatus,
  useGenerateEndorsementSlipDocument,
  useGenerateEndorsementCertificateDocument,
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
import { MailPreviewModal } from '@/components/organisms/reinsurance/MailPreviewModal';
import { CreateDistributionPanel } from '@/components/organisms/reinsurance/panels/CreateDistributionPanel';
import { ReinsurerEntry } from '@/components/molecules/reinsurance/ReinsurerDistributionSelect';
import { EndorsementDocumentModal } from '@/components/organisms/reinsurance/documents/EndorsementDocumentModal';
import { EndorsementClosingSnapshotModal } from '@/components/organisms/reinsurance/documents/EndorsementClosingSnapshotModal';
import { EndorsementSlipPreviewModal } from '@/components/organisms/reinsurance/documents/EndorsementSlipPreviewModal';
import { NoteDocumentModal } from '@/components/organisms/reinsurance/documents/NoteDocumentModal';
import { cardClass } from '@/lib/utils';

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
  return (
    <details className="rounded-xl border border-gray-200 bg-white p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Current Effective Position</h4>
            <p className="mt-1 text-xs text-gray-500">
              Read-only backend view from confirmed placement and endorsement closings.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-right lg:grid-cols-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Capacity</p>
              <p className="text-sm font-semibold text-gray-900">
                {capacity.effectiveTotalCapacityPercent}%
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Sum Insured</p>
              <p className="text-sm font-semibold text-gray-900">
                {fmtMoney(totals.sumInsured, totals.currency)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Premium</p>
              <p className="text-sm font-semibold text-gray-900">
                {fmtMoney(totals.premium, totals.currency)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Lines</p>
              <p className="text-sm font-semibold text-gray-900">{totals.participantCount}</p>
            </div>
          </div>
        </div>
      </summary>

      <div className="mt-4 flex flex-col gap-4 border-t border-gray-100 pt-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs text-gray-500 mt-1">
              The original placement remains unchanged. Expand this panel only when you need the
              latest effective totals and reinsurer lines.
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
                    <p className="text-[11px] text-gray-400">{participant.participationType}</p>
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
                Accepted but not yet effective capacity:{' '}
                {capacity.acceptedEndorsementCapacityPercent}%
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
    </details>
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

interface EndorsementMarketPreviewState {
  counterpartyId: string;
  documentTitle: string;
  previewNotice: string;
  recipientName: string;
  relationship: string;
  offeredLinePercent: number;
  status: string;
}

function isTenantDocumentProfileUnavailable(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('tenant document profile') &&
    normalized.includes('document was not generated')
  );
}

function EndorsementCard({
  endorsement,
  placement,
}: {
  endorsement: PlacementEndorsement;
  placement: Facultative;
}) {
  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const [revisedShares, setRevisedShares] = useState<Record<string, string>>({});
  const [busyEPIds, setBusyEPIds] = useState<Set<string>>(new Set());
  const [marketPreview, setMarketPreview] = useState<EndorsementMarketPreviewState | null>(null);
  const [endorsementSlipPreviewOpen, setEndorsementSlipPreviewOpen] = useState(false);
  const [endorsementClosingPreview, setEndorsementClosingPreview] =
    useState<EndorsementParticipantClosing | null>(null);
  const [documentPreview, setDocumentPreview] = useState<PlacementDocument | null>(null);
  const [noteDocumentPreview, setNoteDocumentPreview] = useState<PlacementDocument | null>(null);
  const [noteRecordPreview, setNoteRecordPreview] = useState<PlacementNote | null>(null);
  const [officialGenerationUnavailable, setOfficialGenerationUnavailable] = useState(false);
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
  const { data: endorsementNotes = [] } = usePlacementEndorsementNotes(
    placement.id,
    endorsement.id,
  );
  const { data: placementDocuments = [] } = usePlacementDocuments(placement.id);
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
  const generateEndorsementSlip = useGenerateEndorsementSlipDocument(placement.id, endorsement.id);
  const generateEndorsementCertificate = useGenerateEndorsementCertificateDocument(
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

  const snapshotCounterpartyIds = new Set(
    snapshotParticipants.map((p) => String(p.counterpartyId)),
  );

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

  const summaryTargetPercent = endorsementSummary?.targetPercent ?? proposedFacOffer;
  const summaryAcceptedPercent = endorsementSummary?.acceptedPercent ?? 0;
  const summaryConfirmedPercent = endorsementSummary?.placedPercent ?? 0;
  const summaryRemainingPercent =
    endorsementSummary?.remainingPercent ??
    Math.max(0, +(summaryTargetPercent - summaryConfirmedPercent).toFixed(4));
  const acceptedRemainingPercent = Math.max(
    0,
    +(summaryTargetPercent - summaryAcceptedPercent).toFixed(4),
  );
  const leftoverFacOffer = acceptedRemainingPercent;

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

  const activePlacementDocuments = placementDocuments.filter(
    (document) => document.status !== 'VOID',
  );
  const endorsementSlipDocument = activePlacementDocuments.find(
    (document) => document.type === 'ENDORSEMENT_SLIP' && document.endorsementId === endorsement.id,
  );

  const findCertificateDocument = (closingId: string) =>
    activePlacementDocuments.find(
      (document) =>
        document.type === 'ENDORSEMENT_CERTIFICATE' && document.endorsementClosingId === closingId,
    );

  const findNoteDocument = (noteId: string) =>
    activePlacementDocuments.find((document) => document.noteId === noteId);
  const findEndorsementCreditNote = (closingId: string) =>
    endorsementNotes.find(
      (note) =>
        note.type === 'ENDORSEMENT_CREDIT_NOTE' &&
        note.endorsementClosingId === closingId &&
        note.status !== 'VOID',
    );
  const endorsementDebitNotes = endorsementNotes.filter(
    (note) => note.type === 'ENDORSEMENT_DEBIT_NOTE',
  );

  const openGeneratedDocument = async (
    generate: () => Promise<PlacementDocument>,
    successMessage: string,
    fallback?: () => void,
  ) => {
    try {
      const document = await generate();
      setOfficialGenerationUnavailable(false);
      setDocumentPreview(document);
      useToastStore.getState().addToast({
        message: successMessage,
        type: 'success',
      });
    } catch (error) {
      const message = extractError(error);
      if (isTenantDocumentProfileUnavailable(message)) {
        setOfficialGenerationUnavailable(true);
        fallback?.();
        useToastStore.getState().addToast({
          message:
            'Official document generation is unavailable because tenant document profile service is not configured. Showing backend record inspection instead.',
          type: 'error',
        });
        return;
      }
      useToastStore.getState().addToast({
        message,
        type: 'error',
      });
    }
  };

  const handleViewEndorsementSlip = () => {
    if (endorsementSlipDocument) {
      setDocumentPreview(endorsementSlipDocument);
      return;
    }
    setEndorsementSlipPreviewOpen(true);
  };

  const handleGenerateOfficialEndorsementSlip = () =>
    openGeneratedDocument(
      () => generateEndorsementSlip.mutateAsync(),
      'Official endorsement slip snapshot ready',
      () => setEndorsementSlipPreviewOpen(true),
    );

  const handleGenerateOfficialEndorsementCertificate = (closing: EndorsementParticipantClosing) => {
    if (closing.status !== 'CONFIRMED') {
      useToastStore.getState().addToast({
        message: 'Endorsement certificate can only be generated for confirmed closings.',
        type: 'error',
      });
      return;
    }
    const document = findCertificateDocument(closing.id);
    if (document) {
      setDocumentPreview(document);
      return;
    }
    return openGeneratedDocument(
      () => generateEndorsementCertificate.mutateAsync({ closingId: closing.id }),
      'Official endorsement certificate snapshot ready',
      () => setEndorsementClosingPreview(closing),
    );
  };

  const handleViewEndorsementNote = (note: PlacementNote) => {
    const document = findNoteDocument(note.id);
    setNoteDocumentPreview(document ?? null);
    setNoteRecordPreview(document ? null : note);
  };

  const handlePreviewMarketDocument = (row: EndorsementParticipantRow) => {
    const endorsementParticipant = endorsementParticipants.find(
      (item) => item.id === row.participantId || item.counterpartyId === row.counterpartyId,
    );
    const offeredLine = Number(
      endorsementParticipant?.signedLinePercent ??
        endorsementParticipant?.sharePercent ??
        revisedShares[row.counterpartyId] ??
        row.offeredShare,
    );
    const isExistingPlacementParticipant =
      !row.isNew || Boolean(endorsementParticipant?.originalParticipantId);

    setMarketPreview({
      counterpartyId: row.counterpartyId,
      documentTitle: isExistingPlacementParticipant
        ? 'Revised Endorsement Offer Preview'
        : 'Endorsement Offer Slip Preview',
      previewNotice: isExistingPlacementParticipant
        ? 'Backend endorsement preview for revised terms. This is not an ENDORSEMENT_CERTIFICATE and no immutable official revised-offer document has been generated yet.'
        : 'Backend endorsement preview for a new market participant. This is not the original placement Offer Slip and no immutable official endorsement offer document has been generated yet.',
      recipientName: row.reinsurerName,
      relationship: isExistingPlacementParticipant
        ? 'Existing placement participant reviewing revised endorsement terms'
        : 'New endorsement participant reviewing current endorsed risk',
      offeredLinePercent: Number.isFinite(offeredLine) ? offeredLine : row.offeredShare,
      status: endorsementParticipant?.status ?? 'NOT_SENT',
    });
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
      width: '1.8fr',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-gray-900">{row.reinsurerName}</span>
          <Badge label={row.isNew ? 'Added' : 'Revised'} variant="neutral" />
        </div>
      ),
    },
    {
      key: 'originalShare',
      label: 'Original',
      width: '0.8fr',
      render: (row) => (
        <span className="text-gray-700">{row.isNew ? '—' : `${row.originalShare}%`}</span>
      ),
    },
    {
      key: 'counterpartyId',
      label: 'Revised',
      width: '0.9fr',
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
      key: 'response' as unknown as keyof EndorsementParticipantRow,
      label: 'Response',
      width: '0.9fr',
      render: (row) => {
        const endorsementParticipant = endorsementParticipants.find(
          (item) => item.id === row.participantId || item.counterpartyId === row.counterpartyId,
        );
        if (endorsementParticipant?.status === 'DECLINED') {
          return <Badge label="Declined" variant="danger" />;
        }
        if (
          endorsementParticipant?.status === 'ACCEPTED' ||
          endorsementParticipant?.status === 'CLOSED'
        ) {
          return <Badge label="Accepted" variant="success" />;
        }
        if (endorsementParticipant?.status === 'OFFER_SENT') {
          return <Badge label="Sent" variant="warning" />;
        }
        return <span className="text-xs text-gray-400">Pending</span>;
      },
    },
    {
      key: 'closing' as unknown as keyof EndorsementParticipantRow,
      label: 'Closing',
      width: '0.9fr',
      render: (row) => {
        const confirmedClosing = row.participantId
          ? confirmedClosingByEndorsementParticipantId[row.participantId]
          : undefined;
        const endorsementParticipant = endorsementParticipants.find(
          (item) => item.id === row.participantId || item.counterpartyId === row.counterpartyId,
        );
        if (confirmedClosing) {
          return <Badge label="Confirmed" variant="success" />;
        }
        if (endorsementParticipant?.status === 'ACCEPTED') {
          return <Badge label="Awaiting Validation" variant="warning" />;
        }
        return <span className="text-xs text-gray-400">—</span>;
      },
    },
    {
      key: 'netPremium' as unknown as keyof EndorsementParticipantRow,
      label: 'Net Premium',
      width: '1fr',
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
      width: '2.4fr',
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
        const confirmedClosing = row.participantId
          ? confirmedClosingByEndorsementParticipantId[row.participantId]
          : undefined;
        const creditNote = confirmedClosing ? findEndorsementCreditNote(confirmedClosing.id) : null;
        const certificateDocument = confirmedClosing
          ? findCertificateDocument(confirmedClosing.id)
          : null;
        const isBusy = busyEPIds.has(row.counterpartyId);
        const mailed = mailedIds.has(row.counterpartyId);

        if (confirmedClosing) {
          return (
            <div className="flex flex-wrap items-center gap-2">
              <TableButton
                variant="gray"
                onClick={() => setEndorsementClosingPreview(confirmedClosing)}
              >
                View Closing
              </TableButton>
              {creditNote ? (
                <TableButton variant="gray" onClick={() => handleViewEndorsementNote(creditNote)}>
                  Credit Note
                </TableButton>
              ) : (
                <span className="text-xs text-amber-700">Credit note required</span>
              )}
              {certificateDocument ? (
                <TableButton variant="blue" onClick={() => setDocumentPreview(certificateDocument)}>
                  Certificate
                </TableButton>
              ) : officialGenerationUnavailable ? (
                <TableButton
                  variant="gray"
                  tooltip="Official certificate generation requires tenant document profile service. Inspecting the confirmed closing remains available."
                  onClick={() => setEndorsementClosingPreview(confirmedClosing)}
                >
                  Inspect Closing
                </TableButton>
              ) : (
                <TableButton
                  variant="orange"
                  isLoading={generateEndorsementCertificate.isPending}
                  onClick={() => handleGenerateOfficialEndorsementCertificate(confirmedClosing)}
                >
                  Generate Cert.
                </TableButton>
              )}
            </div>
          );
        }

        if (row.isNew) {
          const responded = isAccepted || isDeclined;
          return (
            <div className="flex items-center gap-2">
              <TableButton variant="gray" onClick={() => handlePreviewMarketDocument(row)}>
                Offer Slip
              </TableButton>
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
                  <Badge label="Confirmed" variant="success" />
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
              <TableButton variant="gray" onClick={() => handlePreviewMarketDocument(row)}>
                Revised Offer
              </TableButton>
              {isValidated ? (
                <Badge label="Confirmed" variant="success" />
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
            <TableButton variant="gray" onClick={() => handlePreviewMarketDocument(row)}>
              Revised Offer
            </TableButton>
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

  const closeBlockingReasons = endorsementSummary?.closeBlockingReasons ?? [];
  const isReadyToClose = endorsementSummary?.canClose ?? false;
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
  const pendingWorkflowMessage = endorsementSummary?.pendingActions.includes('ISSUE_NOTES')
    ? 'Issue the draft endorsement notes before closing.'
    : endorsementSummary?.pendingActions.includes('GENERATE_NOTES')
      ? 'Generate the required endorsement notes before closing.'
      : isReadyToClose
        ? 'All required endorsement work is complete. Ready for manual close.'
        : closeBlockingReasons.length > 0
          ? 'Complete the remaining endorsement actions before closing.'
          : null;

  const handleCloseEndorsement = async () => {
    if (!isReadyToClose || isUpdatingStatus) return;
    try {
      await updateStatusAsync({ endorsementId: endorsement.id, status: 'CLOSED' });
      await invalidateEndorsementView();
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

  return (
    <>
      <div className={cardClass('p-5 flex flex-col gap-5')}>
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
                  }}
                >
                  Send to Market
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Reason */}
        {endorsement.reason && (
          <p className="text-sm text-gray-600 border-l-2 border-orange-300 pl-3">
            {endorsement.reason}
          </p>
        )}

        <section className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Endorsement Summary
          </p>
          {proposed && <ParameterCards original={original} proposed={proposed} />}
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
                <p className="text-xs text-gray-500">Remaining Capacity</p>
                <p className="text-sm font-semibold text-gray-900">
                  {endorsementSummary.remainingPercent ?? summaryRemainingPercent}%
                </p>
              </div>
            </div>
          )}
        </section>

        {endorsement.status !== 'DRAFT' && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Market / Reinsurers
                </p>
                <p className="text-xs text-gray-400">
                  One row follows each reinsurer from offer through confirmed endorsement closing.
                </p>
              </div>
              <Button size="sm" onClick={() => setAddPanelOpen(true)}>
                Add Endorsement Participant
              </Button>
            </div>
            <DataTable
              columns={epColumns}
              data={endorsementRows}
              emptyMessage="No endorsement reinsurers recorded"
              currentPage={1}
              totalPages={1}
              onPageChange={() => {}}
              noInternalScroll
            />
          </section>
        )}

        {endorsement.status !== 'DRAFT' && (
          <>
            <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Cedant / Endorsement Documents
                </p>
                <p className="text-xs text-gray-400">
                  Endorsement debit notes are cedant-facing endorsement-level records. Endorsement
                  guarantee notes are not backend-supported yet.
                </p>
              </div>
              <div className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-100">
                {endorsementDebitNotes.length === 0 ? (
                  <div className="p-3 text-xs text-gray-400">
                    No endorsement debit note has been generated for this endorsement.
                  </div>
                ) : (
                  endorsementDebitNotes.map((note) => (
                    <div
                      key={note.id}
                      className="grid grid-cols-2 gap-3 p-3 lg:grid-cols-5 lg:items-center"
                    >
                      <div>
                        <p className="text-xs text-gray-400">Endorsement Debit Note</p>
                        <p className="text-sm font-medium text-gray-900">{note.noteNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Type</p>
                        <p className="text-sm text-gray-700">{note.type}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Net Amount</p>
                        <p className="text-sm text-gray-700">
                          {fmtMoney(note.netAmount, note.currency)}
                        </p>
                      </div>
                      <div>
                        <Badge
                          label={
                            note.status === 'ISSUED'
                              ? 'Issued'
                              : note.status === 'VOID'
                                ? 'VOID'
                                : 'Draft / Not Issued'
                          }
                          variant={
                            note.status === 'ISSUED'
                              ? 'success'
                              : note.status === 'VOID'
                                ? 'danger'
                                : 'warning'
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2 lg:justify-end">
                        <TableButton variant="gray" onClick={() => handleViewEndorsementNote(note)}>
                          View Endorsement Debit Note
                        </TableButton>
                      </div>
                    </div>
                  ))
                )}
                <div className="p-3">
                  <p className="text-xs font-semibold text-gray-500">Endorsement Guarantee Note</p>
                  <p className="mt-1 text-xs text-amber-700">
                    Not yet supported as a backend-truth document. No official preview is shown to
                    avoid fabricating final endorsement guarantee values.
                  </p>
                </div>
              </div>
            </div>

            <section className="flex flex-col gap-3 border-t border-gray-100 pt-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Review & Close
                </p>
                <p className="text-xs text-gray-400">
                  Overall endorsement documents and backend close-readiness checks.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <TableButton variant="gray" onClick={handleViewEndorsementSlip}>
                  {endorsementSlipDocument ? 'View Endorsement Slip' : 'Preview Endorsement Slip'}
                </TableButton>
                <TableButton
                  variant="orange"
                  isLoading={generateEndorsementSlip.isPending}
                  disabled={officialGenerationUnavailable}
                  tooltip={
                    officialGenerationUnavailable
                      ? 'Official generation requires tenant document profile service. Use Preview Endorsement Slip until it is configured.'
                      : undefined
                  }
                  onClick={handleGenerateOfficialEndorsementSlip}
                >
                  Generate Official Slip
                </TableButton>
              </div>

              {officialGenerationUnavailable && (
                <p className="text-xs text-amber-700">
                  Official endorsement document generation is unavailable in this environment.
                  Backend previews and confirmed closing inspection remain available.
                </p>
              )}

              <div
                className={`rounded-xl border p-3 ${
                  isReadyToClose
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-amber-200 bg-amber-50'
                }`}
              >
                <p
                  className={`text-xs font-semibold ${
                    isReadyToClose ? 'text-emerald-800' : 'text-amber-800'
                  }`}
                >
                  {isReadyToClose ? 'Ready to Close' : 'Cannot Close Yet'}
                </p>
                {pendingWorkflowMessage && (
                  <p
                    className={`mt-1 text-xs ${
                      isReadyToClose ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {pendingWorkflowMessage}
                  </p>
                )}
                {closeBlockingReasons.length > 0 && endorsement.status !== 'CLOSED' && (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-700">
                    {closeBlockingReasons.map((reason) => (
                      <li key={reason.code}>{reason.message}</li>
                    ))}
                  </ul>
                )}
              </div>

              {endorsement.status !== 'CLOSED' && (
                <div>
                  <Button
                    size="sm"
                    isLoading={isUpdatingStatus}
                    disabled={!isReadyToClose}
                    onClick={handleCloseEndorsement}
                  >
                    Close Endorsement
                  </Button>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <EditEndorsementPanel
        isOpen={editPanelOpen}
        placement={placement}
        endorsement={endorsement}
        onClose={() => setEditPanelOpen(false)}
      />

      <EndorsementSlipPreviewModal
        isOpen={endorsementSlipPreviewOpen}
        placement={placement}
        endorsement={endorsement}
        participants={endorsementParticipants}
        closings={endorsementClosings}
        notes={endorsementNotes}
        summary={endorsementSummary}
        onClose={() => setEndorsementSlipPreviewOpen(false)}
      />

      {marketPreview && (
        <EndorsementSlipPreviewModal
          isOpen={!!marketPreview}
          placement={placement}
          endorsement={endorsement}
          participants={endorsementParticipants}
          closings={endorsementClosings}
          notes={endorsementNotes}
          summary={endorsementSummary}
          documentTitle={marketPreview.documentTitle}
          previewNotice={marketPreview.previewNotice}
          focusedCounterpartyId={marketPreview.counterpartyId}
          focusedRecipient={{
            name: marketPreview.recipientName,
            relationship: marketPreview.relationship,
            offeredLinePercent: marketPreview.offeredLinePercent,
            status: marketPreview.status,
          }}
          onClose={() => setMarketPreview(null)}
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

      <EndorsementDocumentModal
        isOpen={!!documentPreview}
        document={documentPreview}
        onClose={() => setDocumentPreview(null)}
      />

      <EndorsementClosingSnapshotModal
        isOpen={!!endorsementClosingPreview}
        placement={placement}
        endorsement={endorsement}
        closing={endorsementClosingPreview}
        onClose={() => setEndorsementClosingPreview(null)}
      />

      <NoteDocumentModal
        isOpen={!!noteDocumentPreview || !!noteRecordPreview}
        document={noteDocumentPreview}
        note={noteRecordPreview}
        placement={placement}
        onClose={() => {
          setNoteDocumentPreview(null);
          setNoteRecordPreview(null);
        }}
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
