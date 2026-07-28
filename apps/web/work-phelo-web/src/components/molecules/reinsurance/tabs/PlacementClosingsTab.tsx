'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { TableButton } from '@/components/atoms/TableButton';
import { GuaranteeNoteModal } from '@/components/organisms/reinsurance/documents/GuaranteeNoteModal';
import { NoteDocumentModal } from '@/components/organisms/reinsurance/documents/NoteDocumentModal';
import { MailPreviewModal } from '@/components/organisms/reinsurance/MailPreviewModal';
import {
  useCedants,
  useReinsurers,
  usePlacementClosings,
  usePlacementDocuments,
  usePlacementNotes,
  useCreatePlacementDebitNote,
  useCreatePlacementCreditNote,
  usePlacementEffectiveView,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { Facultative, PlacementDocument, PlacementNote } from '@/types/reinsurance';

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
  reinsurerCompany: string;
  signedShare: number;
  grossPremium: number;
  netPremium: number;
  currency: string | null;
  participationType: 'ORIGINAL' | 'REVISED' | 'ADDED';
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

interface PlacementClosingsTabProps {
  placement: Facultative;
}

export function PlacementClosingsTab({ placement }: PlacementClosingsTabProps) {
  const [guaranteeNoteOpen, setGuaranteeNoteOpen] = useState(false);
  const [guaranteeNoteViewed, setGuaranteeNoteViewed] = useState(false);
  const [debitNoteViewed, setDebitNoteViewed] = useState(false);
  const [noteDocumentPreview, setNoteDocumentPreview] = useState<PlacementDocument | null>(null);
  const [noteRecordPreview, setNoteRecordPreview] = useState<PlacementNote | null>(null);
  const [mailToCedantOpen, setMailToCedantOpen] = useState(false);
  const [mailToReinsurerRow, setMailToReinsurerRow] = useState<ClosingRow | null>(null);

  const { data: cedants = [] } = useCedants();
  const { data: reinsurers = [] } = useReinsurers();
  const { data: closings = [], isLoading: isLoadingClosings } = usePlacementClosings(placement.id);
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
    effectiveView?.effectiveParticipants.map((participant) => ({
      id: participant.counterpartyId,
      reinsurerCompany: participant.counterparty.name,
      signedShare: participant.signedLinePercent,
      grossPremium: participant.grossPremium,
      netPremium: participant.netPremium,
      currency: effectiveView.effectiveTotals.currency,
      participationType: participant.participationType,
    })) ?? [];

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

  const handleOpenCreditNote = async (row: ClosingRow) => {
    try {
      let note = findActiveCreditNote(row.id);
      if (!note) {
        try {
          note = await createCreditNote.mutateAsync({ closingId: row.id });
        } catch (error) {
          const message = extractError(error);
          if (!message.toLowerCase().includes('active credit note')) throw error;
          const refreshed = await refetchPlacementNotes();
          note = findActiveCreditNote(row.id, refreshed.data ?? []);
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
          <TableButton isLoading={isNoteBusy} onClick={() => handleOpenCreditNote(row)}>
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
        <div>
          <h4 className="text-sm font-semibold text-gray-900">
            Current Effective Closings / Position
          </h4>
          <p className="text-xs text-gray-500">
            Latest confirmed placement position from original closings plus closed effective
            endorsements. Historical original closings remain listed separately below.
          </p>
        </div>
        <DataTable
          columns={effectiveColumns}
          data={effectiveRows}
          isLoading={isLoadingEffectiveView}
          emptyMessage="No confirmed effective placement position yet"
          currentPage={1}
          totalPages={1}
          onPageChange={() => {}}
          noInternalScroll
        />
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
        secondaryButtons={[
          ...(isPlacementClosed
            ? [
                {
                  label: 'View Guarantee Note',
                  onClick: () => {
                    setGuaranteeNoteOpen(true);
                    setGuaranteeNoteViewed(true);
                  },
                  className: guaranteeNoteViewed ? 'mx-1' : 'btn-pulse mx-1',
                },
                {
                  label: 'View Debit Note',
                  onClick: handleOpenDebitNote,
                  className: debitNoteViewed ? 'mx-1' : 'btn-pulse mx-1',
                },
              ]
            : []),
        ]}
        actionButton={
          isPlacementClosed
            ? { label: 'Mail to cedant', onClick: () => setMailToCedantOpen(true) }
            : undefined
        }
      />

      <GuaranteeNoteModal
        isOpen={guaranteeNoteOpen}
        placement={placement}
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
