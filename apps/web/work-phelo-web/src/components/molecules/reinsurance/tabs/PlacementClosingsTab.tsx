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
  usePlacementNotes,
  useCreatePlacementDebitNote,
  useCreatePlacementCreditNote,
  useGeneratePlacementNoteDocument,
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
  closingNumber: string;
  netPremium: number | null;
  currency: string | null;
  createdAt: string;
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
  const [mailToCedantOpen, setMailToCedantOpen] = useState(false);
  const [mailToReinsurerRow, setMailToReinsurerRow] = useState<ClosingRow | null>(null);

  const { data: cedants = [] } = useCedants();
  const { data: reinsurers = [] } = useReinsurers();
  const { data: closings = [], isLoading: isLoadingClosings } = usePlacementClosings(placement.id);
  const { data: placementNotes = [], refetch: refetchPlacementNotes } = usePlacementNotes(
    placement.id,
  );
  const createDebitNote = useCreatePlacementDebitNote(placement.id);
  const createCreditNote = useCreatePlacementCreditNote(placement.id);
  const generateNoteDocument = useGeneratePlacementNoteDocument(placement.id);

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
  const isNoteBusy =
    createDebitNote.isPending || createCreditNote.isPending || generateNoteDocument.isPending;

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
      closingNumber: closing.closingNumber,
      netPremium: toNumber(closing.netPremium),
      currency: closing.currency,
      createdAt: closing.createdAt,
    }));

  const openNoteDocument = async (note: PlacementNote) => {
    const document = await generateNoteDocument.mutateAsync({ noteId: note.id });
    setNoteDocumentPreview(document);
  };

  const findActiveDebitNote = (notes = placementNotes) => notes.find(isActiveDebitNote);
  const findActiveCreditNote = (closingId: string, notes = placementNotes) =>
    notes.find((note) => isActiveCreditNote(note, closingId));

  const handleOpenDebitNote = async () => {
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
      setDebitNoteViewed(true);
      useToastStore.getState().addToast({
        message: 'Debit note snapshot ready',
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
        message: 'Credit note snapshot ready',
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
      width: '2fr',
      render: (row) => <span className="font-medium text-gray-900">{row.reinsurerCompany}</span>,
    },
    {
      key: 'signedShare',
      label: 'Signed Share',
      width: '1fr',
      render: (row) => <span className="text-gray-700">{fmtPct(row.signedShare)}</span>,
    },
    {
      key: 'signedGrossPremium',
      label: 'Signed Gross Premium',
      width: '1.5fr',
      render: (row) => (
        <span className="text-gray-700">
          {row.signedGrossPremium === null ? '—' : fmtAmount(row.signedGrossPremium, row.currency)}
        </span>
      ),
    },
    {
      key: 'netPremium',
      label: 'Net Premium',
      width: '1.5fr',
      render: (row) => (
        <span className="text-gray-700">
          {row.netPremium === null ? '—' : fmtAmount(row.netPremium, row.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Closing Status',
      width: '1fr',
      render: (row) => <span className="text-gray-700">{row.status}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '1fr',
      render: (row) => (
        <div className="flex items-center gap-3">
          <TableButton isLoading={isNoteBusy} onClick={() => handleOpenCreditNote(row)}>
            View Credit Note
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
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoadingClosings}
        emptyMessage="No confirmed placement closings yet"
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
        secondaryButtons={[
          ...(isPlacementClosed
            ? [
                {
                  label: 'Preview Guarantee Note',
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
        isOpen={!!noteDocumentPreview}
        document={noteDocumentPreview}
        onClose={() => setNoteDocumentPreview(null)}
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
