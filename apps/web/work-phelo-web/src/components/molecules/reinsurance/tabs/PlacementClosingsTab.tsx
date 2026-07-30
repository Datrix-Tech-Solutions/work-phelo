'use client';

import { useState } from 'react';
import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { TableButton } from '@/components/atoms/TableButton';
import { GuaranteeNoteModal } from '@/components/organisms/reinsurance/documents/GuaranteeNoteModal';
import { NoteDocumentModal } from '@/components/organisms/reinsurance/documents/NoteDocumentModal';
import {
  ClosingLetterData,
  ClosingLetterModal,
} from '@/components/organisms/reinsurance/documents/ClosingLetterModal';
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
  usePlacementEffectiveView,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/store/toast.store';
import {
  Facultative,
  PlacementDocument,
  PlacementEndorsement,
  PlacementNote,
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

const PARTICIPATION_TYPE_LABEL: Record<EffectivePositionRow['participationType'], string> = {
  ORIGINAL: 'original',
  REVISED: 'endorsed',
  ADDED: 'added',
};

function isActiveNote(note: PlacementNote) {
  return note.status !== 'VOID';
}

function isActiveDebitNote(note: PlacementNote) {
  return note.type === 'DEBIT_NOTE' && isActiveNote(note);
}

function isActiveCreditNote(note: PlacementNote, closingId: string) {
  return note.type === 'CREDIT_NOTE' && note.closingId === closingId && isActiveNote(note);
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
  const [closingLetterPreview, setClosingLetterPreview] = useState<{
    closing: ClosingLetterData;
    endorsement?: PlacementEndorsement;
  } | null>(null);
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
  const isNoteBusy = createDebitNote.isPending || createCreditNote.isPending;

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
      width: 'minmax(220px, 1fr)',
      render: (row) => (
        <span className="flex flex-col">
          <span className="font-medium text-gray-900">{row.reinsurerCompany}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            {PARTICIPATION_TYPE_LABEL[row.participationType]}
            {row.sourceCount > 1 ? ` · ${row.sourceCount} snapshots` : ''}
          </span>
        </span>
      ),
    },
    {
      key: 'signedShare',
      label: 'Current Signed Share',
      width: '160px',
      render: (row) => <span className="text-gray-700">{fmtPct(row.signedShare)}</span>,
    },
    {
      key: 'grossPremium',
      label: 'Current Gross Premium',
      width: '200px',
      render: (row) => (
        <span className="text-gray-700">{fmtAmount(row.grossPremium, row.currency)}</span>
      ),
    },
    {
      key: 'netPremium',
      label: 'Current Net Premium',
      width: '200px',
      render: (row) => (
        <span className="text-gray-700">{fmtAmount(row.netPremium, row.currency)}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 'minmax(200px, 1fr)',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <TableButton variant="green" onClick={() => handleViewEffectiveClosing(row)}>
            View Closing
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

  const handleViewEffectiveClosing = (row: EffectivePositionRow) => {
    if (row.sourceType === 'PLACEMENT_CLOSING') {
      const closing = closings.find((item) => item.id === row.sourceClosingId);
      if (closing) {
        setClosingLetterPreview({
          closing: {
            id: closing.id,
            closingNumber: closing.closingNumber,
            status: closing.status,
            currency: closing.currency,
            signedLinePercent: closing.signedLinePercent,
            sumInsuredSnapshot: null,
            premiumSnapshot: closing.grossPremium,
            commissionPercent: closing.commissionPercent,
            commissionAmount: closing.commissionAmount,
            brokeragePercent: closing.brokeragePercent,
            brokerageAmount: closing.brokerageAmount,
            netPremium: closing.netPremium,
            reinsurer: closing.participant.counterparty,
          },
        });
        return;
      }
    }

    if (row.sourceType === 'ENDORSEMENT_CLOSING') {
      const closing = endorsementClosings.find((item) => item.id === row.sourceClosingId);
      const endorsement = endorsements.find((item) => item.id === row.sourceEndorsementId);
      if (closing) {
        setClosingLetterPreview({
          closing: {
            id: closing.id,
            closingNumber: closing.closingNumber,
            status: closing.status,
            currency: closing.currency,
            signedLinePercent: closing.signedLinePercent,
            sumInsuredSnapshot: closing.sumInsuredSnapshot,
            premiumSnapshot: closing.premiumSnapshot,
            commissionPercent: closing.commissionPercent,
            commissionAmount: closing.commissionAmount,
            brokeragePercent: closing.brokeragePercent,
            brokerageAmount: closing.brokerageAmount,
            netPremium: closing.netPremium,
            reinsurer: closing.endorsementParticipant.counterparty,
          },
          endorsement,
        });
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

  const originalParticipantCount = rows.length;
  const originalTotalNetPremium = rows.reduce((sum, row) => sum + (row.netPremium ?? 0), 0);
  const originalTotalShare = rows.reduce((sum, row) => sum + row.signedShare, 0);
  const originalCurrency = rows.find((row) => row.currency)?.currency ?? placement.currency;

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
        </div>
      ),
    },
  ];

  return (
    <>
      <section className="mb-5">
        <DataTable
          columns={effectiveColumns}
          data={effectiveRows}
          isLoading={isLoadingEffectiveView || isLoadingEndorsementClosings}
          emptyMessage="No confirmed effective placement position yet"
          currentPage={1}
          totalPages={1}
          onPageChange={() => {}}
          noInternalScroll
          secondaryButtons={
            isPlacementClosed
              ? [
                  {
                    label: 'View Guarantee Note',
                    onClick: () => {
                      setGuaranteeNoteOpen(true);
                      setGuaranteeNoteViewed(true);
                    },
                    className: cn(
                      'bg-transparent text-blue-600 border-blue-400 hover:bg-blue-400 hover:text-white hover:border-blue-400 focus:ring-blue-400',
                      guaranteeNoteViewed ? '' : 'btn-pulse',
                    ),
                  },
                  {
                    label: 'View Debit Note',
                    onClick: handleOpenDebitNote,
                    disabled: !isCurrentDebitNoteSupported,
                    title: isCurrentDebitNoteSupported
                      ? undefined
                      : 'Current effective debit note generation is not yet backend-supported after endorsements. Original debit notes remain historical.',
                    className: cn(
                      'ml-3 bg-transparent',
                      isCurrentDebitNoteSupported
                        ? 'text-green-700 border-green-600 hover:bg-green-600 hover:text-white hover:border-green-600 focus:ring-green-600'
                        : 'text-gray-600 border-gray-400 hover:bg-gray-400 hover:text-white hover:border-gray-400 focus:ring-gray-400',
                      debitNoteViewed ? '' : 'btn-pulse',
                    ),
                  },
                  // {
                  //   label: 'Mail to Cedant',
                  //   onClick: () => setMailToCedantOpen(true),
                  //   className:
                  //     'ml-3 bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700 focus:ring-blue-600',
                  // },
                ]
              : undefined
          }
        />
      </section>

      <CollapsibleOverview
        title="Original Offer"
        defaultCollapsed
        headerExtra={
          <>
            <span className="text-sm text-gray-500">|</span>
            <span className="text-xs text-gray-600 font-medium">
              {originalParticipantCount} participant{originalParticipantCount === 1 ? '' : 's'}
            </span>
            <span className="text-sm text-gray-500">|</span>
            <span className="text-xs text-gray-600 font-medium">
              {fmtAmount(originalTotalNetPremium, originalCurrency)} total net premium
            </span>
            <span className="text-sm text-gray-500">|</span>
            <span className="text-xs text-gray-600 font-medium">
              {fmtPct(originalTotalShare)} total share
            </span>
          </>
        }
      >
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
      </CollapsibleOverview>

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

      <ClosingLetterModal
        isOpen={!!closingLetterPreview}
        placement={placement}
        endorsement={closingLetterPreview?.endorsement}
        closing={closingLetterPreview?.closing ?? null}
        onClose={() => setClosingLetterPreview(null)}
      />

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
