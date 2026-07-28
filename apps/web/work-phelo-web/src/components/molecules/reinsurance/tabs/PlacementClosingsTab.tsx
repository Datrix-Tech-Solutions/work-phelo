'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { TableButton } from '@/components/atoms/TableButton';
import { GuaranteeNoteModal } from '@/components/organisms/reinsurance/documents/GuaranteeNoteModal';
import { NoteDocumentModal } from '@/components/organisms/reinsurance/documents/NoteDocumentModal';
import { PlacementClosingSnapshotModal } from '@/components/organisms/reinsurance/documents/PlacementClosingSnapshotModal';
import { EndorsementClosingSnapshotModal } from '@/components/organisms/reinsurance/documents/EndorsementClosingSnapshotModal';
import { MailPreviewModal } from '@/components/organisms/reinsurance/MailPreviewModal';
import {
  useCedants,
  useReinsurers,
  usePlacementClosings,
  usePlacementEndorsements,
  usePlacementEndorsementClosings,
  usePlacementDocuments,
  usePlacementNotes,
  useCreatePlacementDebitNote,
  useCreatePlacementCreditNote,
  useCreatePlacementEndorsementCreditNote,
  usePlacementEffectiveView,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import {
  EndorsementParticipantClosing,
  Facultative,
  PlacementDocument,
  PlacementEndorsement,
  PlacementNote,
  PlacementParticipantClosing,
} from '@/types/reinsurance';

interface ClosingRow {
  id: string;
  counterpartyId: string;
  reinsurerCompany: string;
  signedShare: number;
  signedGrossPremium: number | null;
  brokerageFee: number;
  status: string;
  netPremium: number | null;
  currency: string | null;
}

interface EffectivePositionRow {
  id: string;
  counterpartyId: string;
  reinsurerCompany: string;
  signedShare: number;
  grossPremium: number;
  netPremium: number;
  currency: string | null;
  participationType: 'ORIGINAL' | 'REVISED' | 'ADDED';
  sourceType: 'PLACEMENT_CLOSING' | 'ENDORSEMENT_CLOSING';
  sourceClosingId: string;
  sourceEndorsementId?: string;
  sourceCount: number;
}

interface MailReinsurerRow {
  counterpartyId: string;
  brokerageFee: number;
}

interface EndorsementClosingPreviewState {
  endorsement: PlacementEndorsement;
  closing: EndorsementParticipantClosing;
}

function fmtPct(val: number) {
  return `${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}%`;
}

function fmtAmount(val: number, currency: string | null) {
  return `${currency ?? ''} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

function toNumber(val: string | number | null | undefined): number | null {
  if (val == null || val === '') return null;
  const parsed = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(parsed) ? parsed : null;
}

function isActiveNote(note: PlacementNote) {
  return note.status !== 'VOID';
}

function isActiveDebitNote(note: PlacementNote) {
  return note.type === 'DEBIT_NOTE' && isActiveNote(note);
}

function isActiveCreditNote(note: PlacementNote, closingId: string) {
  return note.type === 'CREDIT_NOTE' && note.closingId === closingId && isActiveNote(note);
}

function isActiveEndorsementCreditNote(note: PlacementNote, endorsementClosingId: string) {
  return (
    note.type === 'ENDORSEMENT_CREDIT_NOTE' &&
    note.endorsementClosingId === endorsementClosingId &&
    isActiveNote(note)
  );
}

interface PlacementClosingsTabProps {
  placement: Facultative;
}

export function PlacementClosingsTab({ placement }: PlacementClosingsTabProps) {
  const [guaranteeNoteOpen, setGuaranteeNoteOpen] = useState(false);
  const [guaranteeNoteViewed, setGuaranteeNoteViewed] = useState(false);
  const [debitNoteViewed, setDebitNoteViewed] = useState(false);
  const [noteDocumentPreview, setNoteDocumentPreview] = useState<PlacementDocument | null>(null);
  const [noteRecordPreview, setNoteRecordPreview] = useState<PlacementNote | null>(null);
  const [placementClosingPreview, setPlacementClosingPreview] =
    useState<PlacementParticipantClosing | null>(null);
  const [endorsementClosingPreview, setEndorsementClosingPreview] =
    useState<EndorsementClosingPreviewState | null>(null);
  const [mailToCedantOpen, setMailToCedantOpen] = useState(false);
  const [mailToReinsurerRow, setMailToReinsurerRow] = useState<MailReinsurerRow | null>(null);

  const { data: cedants = [] } = useCedants();
  const { data: reinsurers = [] } = useReinsurers();
  const { data: closings = [], isLoading: isLoadingClosings } = usePlacementClosings(placement.id);
  const { data: endorsements = [] } = usePlacementEndorsements(placement.id);
  const { data: endorsementClosings = [], isLoading: isLoadingEndorsementClosings } =
    usePlacementEndorsementClosings(placement.id, endorsements);
  const { data: effectiveView, isLoading: isLoadingEffectiveView } = usePlacementEffectiveView(
    placement.id,
  );
  const { data: placementDocuments = [] } = usePlacementDocuments(placement.id);
  const { data: placementNotes = [], refetch: refetchPlacementNotes } = usePlacementNotes(
    placement.id,
  );
  const createDebitNote = useCreatePlacementDebitNote(placement.id);
  const createCreditNote = useCreatePlacementCreditNote(placement.id);
  const createEndorsementCreditNote = useCreatePlacementEndorsementCreditNote(placement.id);

  const fullCedant = cedants.find((c) => c.id === placement.cedant.id);

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

  const isPlacementClosed = placement.status === 'CLOSED';
  const hasAppliedEndorsements = (effectiveView?.appliedEndorsements.length ?? 0) > 0;
  const isCurrentDebitNoteSupported = !hasAppliedEndorsements;
  const isNoteBusy =
    createDebitNote.isPending ||
    createCreditNote.isPending ||
    createEndorsementCreditNote.isPending;

  const rows: ClosingRow[] = closings
    .filter((closing) => closing.status === 'CONFIRMED')
    .map((closing) => ({
      id: closing.id,
      counterpartyId: closing.participant.counterpartyId,
      reinsurerCompany: closing.participant.counterparty.name,
      signedShare: toNumber(closing.signedLinePercent) ?? 0,
      signedGrossPremium: toNumber(closing.grossPremium),
      brokerageFee: toNumber(closing.brokeragePercent) ?? 0,
      status: closing.status,
      netPremium: toNumber(closing.netPremium),
      currency: closing.currency,
    }));

  const effectiveRows: EffectivePositionRow[] =
    effectiveView?.effectiveParticipants
      .map((participant) => {
        const currentSource =
          participant.sources.find((source) => source.sourceType === 'ENDORSEMENT_CLOSING') ??
          participant.sources[0];
        if (!currentSource) return undefined;
        const row: EffectivePositionRow = {
          id: `${participant.counterpartyId}:${currentSource.sourceType}:${currentSource.closingId}`,
          counterpartyId: participant.counterpartyId,
          reinsurerCompany: participant.counterparty.name,
          signedShare: participant.signedLinePercent,
          grossPremium: participant.grossPremium,
          netPremium: participant.netPremium,
          currency: effectiveView.effectiveTotals.currency,
          participationType: participant.participationType,
          sourceType: currentSource.sourceType,
          sourceClosingId: currentSource.closingId,
          sourceEndorsementId: currentSource.endorsementId,
          sourceCount: participant.sources.length,
        };
        return row;
      })
      .filter((row): row is EffectivePositionRow => Boolean(row)) ?? [];

  const effectiveColumns: Column<EffectivePositionRow>[] = [
    {
      key: 'reinsurerCompany',
      label: 'Current Reinsurer',
      width: 'minmax(200px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.reinsurerCompany}</span>,
    },
    {
      key: 'signedShare',
      label: 'Current Signed Share',
      width: '160px',
      render: (row) => <span className="text-gray-700">{fmtPct(row.signedShare)}</span>,
    },
    {
      key: 'participationType',
      label: 'Source',
      width: '140px',
      render: (row) => (
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {row.participationType.toLowerCase()}
          {row.sourceCount > 1 ? ` · ${row.sourceCount} snapshots` : ''}
        </span>
      ),
    },
    {
      key: 'grossPremium',
      label: 'Current Gross Premium',
      width: 'minmax(200px, 1fr)',
      render: (row) => (
        <span className="text-gray-700">{fmtAmount(row.grossPremium, row.currency)}</span>
      ),
    },
    {
      key: 'netPremium',
      label: 'Current Net Premium',
      width: 'minmax(200px, 1fr)',
      render: (row) => (
        <span className="text-gray-700">{fmtAmount(row.netPremium, row.currency)}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 'minmax(240px, 1fr)',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <TableButton variant="green" onClick={() => handleViewEffectiveClosing(row)}>
            View Closing
          </TableButton>
          <TableButton isLoading={isNoteBusy} onClick={() => handleOpenEffectiveCreditNote(row)}>
            Credit Note
          </TableButton>
          <TableButton
            variant="blue"
            onClick={() =>
              setMailToReinsurerRow({
                counterpartyId: row.counterpartyId,
                brokerageFee: 0,
              })
            }
          >
            Mail Reinsurer
          </TableButton>
        </div>
      ),
    },
  ];

  const openNoteDocument = async (note: PlacementNote) => {
    const document = placementDocuments.find(
      (item) => item.noteId === note.id && item.status !== 'VOID',
    );
    setNoteDocumentPreview(document ?? null);
    setNoteRecordPreview(document ? null : note);
  };

  const findActiveDebitNote = (notes = placementNotes) => notes.find(isActiveDebitNote);
  const findActiveCreditNote = (closingId: string, notes = placementNotes) =>
    notes.find((note) => isActiveCreditNote(note, closingId));
  const findActiveEndorsementCreditNote = (endorsementClosingId: string, notes = placementNotes) =>
    notes.find((note) => isActiveEndorsementCreditNote(note, endorsementClosingId));

  const findEndorsementClosingContext = (endorsementId: string, closingId: string) => {
    const endorsement = endorsements.find((item) => item.id === endorsementId);
    const closing = endorsementClosings.find((item) => item.id === closingId);
    return endorsement && closing ? { endorsement, closing } : null;
  };

  const handleViewEffectiveClosing = (row: EffectivePositionRow) => {
    if (row.sourceType === 'PLACEMENT_CLOSING') {
      const closing = closings.find((item) => item.id === row.sourceClosingId);
      if (closing) {
        setPlacementClosingPreview(closing);
        return;
      }
    }

    if (row.sourceType === 'ENDORSEMENT_CLOSING' && row.sourceEndorsementId) {
      const context = findEndorsementClosingContext(row.sourceEndorsementId, row.sourceClosingId);
      if (context) {
        setEndorsementClosingPreview(context);
        return;
      }
    }

    useToastStore.getState().addToast({
      message: 'Current closing snapshot could not be found. Refresh and try again.',
      type: 'error',
    });
  };

  const handleOpenDebitNote = async () => {
    setDebitNoteViewed(true);
    try {
      let note = findActiveDebitNote();
      if (!note) {
        try {
          note = await createDebitNote.mutateAsync();
        } catch (error) {
          const message = extractError(error);
          if (!message.toLowerCase().includes('active debit note')) throw error;
          const refreshed = await refetchPlacementNotes();
          note = findActiveDebitNote(refreshed.data ?? []);
        }
      }
      if (!note) throw new Error('Active debit note could not be found.');
      await openNoteDocument(note);
      useToastStore.getState().addToast({
        message: 'Debit note ready',
        type: 'success',
      });
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    }
  };

  const handleOpenCreditNote = async (closingId: string) => {
    try {
      let note = findActiveCreditNote(closingId);
      if (!note) {
        try {
          note = await createCreditNote.mutateAsync({ closingId });
        } catch (error) {
          const message = extractError(error);
          if (!message.toLowerCase().includes('active credit note')) throw error;
          const refreshed = await refetchPlacementNotes();
          note = findActiveCreditNote(closingId, refreshed.data ?? []);
        }
      }
      if (!note) throw new Error('Active credit note could not be found.');
      await openNoteDocument(note);
      useToastStore.getState().addToast({
        message: 'Credit note ready',
        type: 'success',
      });
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    }
  };

  const handleOpenEndorsementCreditNote = async (endorsementId: string, closingId: string) => {
    try {
      let note = findActiveEndorsementCreditNote(closingId);
      if (!note) {
        try {
          note = await createEndorsementCreditNote.mutateAsync({ endorsementId, closingId });
        } catch (error) {
          const message = extractError(error);
          if (!message.toLowerCase().includes('active endorsement credit note')) throw error;
          const refreshed = await refetchPlacementNotes();
          note = findActiveEndorsementCreditNote(closingId, refreshed.data ?? []);
        }
      }
      if (!note) throw new Error('Active endorsement credit note could not be found.');
      await openNoteDocument(note);
      useToastStore.getState().addToast({
        message: 'Credit note ready',
        type: 'success',
      });
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    }
  };

  const handleOpenEffectiveCreditNote = async (row: EffectivePositionRow) => {
    if (row.sourceType === 'PLACEMENT_CLOSING') {
      await handleOpenCreditNote(row.sourceClosingId);
      return;
    }
    if (row.sourceType === 'ENDORSEMENT_CLOSING' && row.sourceEndorsementId) {
      await handleOpenEndorsementCreditNote(row.sourceEndorsementId, row.sourceClosingId);
      return;
    }
    useToastStore.getState().addToast({
      message: 'Credit note source could not be resolved for this current position.',
      type: 'error',
    });
  };

  const columns: Column<ClosingRow>[] = [
    {
      key: 'reinsurerCompany',
      label: 'Reinsurance Company',
      width: 'minmax(200px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.reinsurerCompany}</span>,
    },
    {
      key: 'signedShare',
      label: 'Signed Share',
      width: '150px',
      render: (row) => <span className="text-gray-700">{fmtPct(row.signedShare)}</span>,
    },
    {
      key: 'signedGrossPremium',
      label: 'Signed Gross Premium',
      width: 'minmax(200px, 1fr)',
      render: (row) => (
        <span className="text-gray-700">
          {row.signedGrossPremium === null ? '—' : fmtAmount(row.signedGrossPremium, row.currency)}
        </span>
      ),
    },
    {
      key: 'netPremium',
      label: 'Net Premium',
      width: 'minmax(200px, 1fr)',
      render: (row) => (
        <span className="text-gray-700">
          {row.netPremium === null ? '—' : fmtAmount(row.netPremium, row.currency)}
        </span>
      ),
    },

    {
      key: 'actions',
      label: 'Actions',
      width: 'minmax(200px, 1fr)',
      render: (row) => (
        <div className="flex items-center gap-3">
          <TableButton isLoading={isNoteBusy} onClick={() => handleOpenCreditNote(row.id)}>
            View Closings
          </TableButton>
          <TableButton variant="blue" onClick={() => setMailToReinsurerRow(row)}>
            Mail Reinsurer
          </TableButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <section className="mb-5 flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">
              Current Effective Closings / Position
            </h4>
            <p className="text-xs text-gray-500">
              Latest confirmed placement position from original closings plus closed effective
              endorsements. Historical original closings remain listed separately below.
            </p>
          </div>
          {isPlacementClosed && (
            <div className="flex flex-wrap items-center gap-2">
              <TableButton
                variant="gray"
                onClick={() => {
                  setGuaranteeNoteOpen(true);
                  setGuaranteeNoteViewed(true);
                }}
                className={guaranteeNoteViewed ? '' : 'btn-pulse'}
              >
                View Guarantee Note
              </TableButton>
              <TableButton
                variant={isCurrentDebitNoteSupported ? 'green' : 'gray'}
                disabled={!isCurrentDebitNoteSupported}
                tooltip={
                  isCurrentDebitNoteSupported
                    ? undefined
                    : 'Current effective debit note generation is not yet backend-supported after endorsements. Original debit notes remain historical.'
                }
                onClick={handleOpenDebitNote}
                className={debitNoteViewed ? '' : 'btn-pulse'}
              >
                View Debit Note
              </TableButton>
              <TableButton variant="blue" onClick={() => setMailToCedantOpen(true)}>
                Mail to Cedant
              </TableButton>
            </div>
          )}
        </div>
        <DataTable
          columns={effectiveColumns}
          data={effectiveRows}
          isLoading={isLoadingEffectiveView || isLoadingEndorsementClosings}
          emptyMessage="No confirmed effective placement position yet"
          currentPage={1}
          totalPages={1}
          onPageChange={() => {}}
          noInternalScroll
        />
      </section>

      <section className="mb-3">
        <h4 className="text-sm font-semibold text-gray-900">Original Placement Closings</h4>
        <p className="text-xs text-gray-500">
          Historical original placement closing snapshots. These records are not rewritten by
          endorsements.
        </p>
      </section>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoadingClosings}
        emptyMessage="No accepted participants yet"
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
      />

      <GuaranteeNoteModal
        isOpen={guaranteeNoteOpen}
        placement={placement}
        facultativeOfferOverride={effectiveView?.effectiveTotals.facultativeOfferPercent}
        sumInsuredOverride={effectiveView?.effectiveTotals.sumInsured}
        premiumOverride={effectiveView?.effectiveTotals.premium}
        commissionOverride={effectiveView?.effectiveTotals.commissionPercent}
        currencyOverride={effectiveView?.effectiveTotals.currency}
        titleOverride={effectiveView?.effectiveTerms.title}
        policyNumberOverride={effectiveView?.effectiveTerms.policyNumber}
        inceptionDateOverride={effectiveView?.effectiveTerms.inceptionDate}
        expiryDateOverride={effectiveView?.effectiveTerms.expiryDate}
        effectiveParticipantOverrides={effectiveView?.effectiveParticipants.map((participant) => ({
          id: participant.counterpartyId,
          counterpartyName: participant.counterparty.name,
          displaySharePercent: participant.signedLinePercent,
        }))}
        onPrint={() => setGuaranteeNoteOpen(false)}
        onClose={() => setGuaranteeNoteOpen(false)}
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

      <MailPreviewModal
        isOpen={mailToCedantOpen}
        placement={placement}
        brokerageFee={0}
        recipients={fullCedant?.email ? [fullCedant.email] : []}
        onSend={() => setMailToCedantOpen(false)}
        onClose={() => setMailToCedantOpen(false)}
      />

      <PlacementClosingSnapshotModal
        isOpen={!!placementClosingPreview}
        placement={placement}
        closing={placementClosingPreview}
        onClose={() => setPlacementClosingPreview(null)}
      />

      {endorsementClosingPreview && (
        <EndorsementClosingSnapshotModal
          isOpen
          placement={placement}
          endorsement={endorsementClosingPreview.endorsement}
          closing={endorsementClosingPreview.closing}
          onClose={() => setEndorsementClosingPreview(null)}
        />
      )}

      {mailToReinsurerRow && (
        <MailPreviewModal
          isOpen={!!mailToReinsurerRow}
          placement={placement}
          brokerageFee={mailToReinsurerRow.brokerageFee}
          recipients={reinsurerEmails[mailToReinsurerRow.counterpartyId] ?? []}
          onSend={() => setMailToReinsurerRow(null)}
          onClose={() => setMailToReinsurerRow(null)}
        />
      )}
    </>
  );
}
