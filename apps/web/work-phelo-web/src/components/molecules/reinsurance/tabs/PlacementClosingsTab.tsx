'use client';

import { useRef, useState } from 'react';
import { DataTable } from '@/components/organisms/shared/DataTable';
import type { Column } from '@/components/organisms/shared/DataTable';
import { TableButton } from '@/components/atoms/TableButton';
import { GuaranteeNoteModal } from '@/components/organisms/reinsurance/documents/GuaranteeNoteModal';
import { MailPreviewModal } from '@/components/organisms/reinsurance/MailPreviewModal';
import { ReinsuranceNotesTable } from '@/components/molecules/reinsurance/ReinsuranceNotesTable';
import { PlacementNotePreviewModal } from '@/components/organisms/reinsurance/documents/PlacementNotePreviewModal';
import {
  useCedants,
  useGeneratePlacementCreditNote,
  useGeneratePlacementDebitNote,
  useIssuePlacementNote,
  usePlacementClosings,
  usePlacementNotes,
  useReinsurers,
  useVoidPlacementNote,
} from '@/hooks';
import {
  Facultative,
  PlacementNote,
  PlacementParticipant,
  PlacementParticipantClosing,
} from '@/types/reinsurance';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface ClosingRow {
  id: string;
  participantId: string;
  counterpartyId: string;
  reinsurerCompany: string;
  signedShare: number;
  signedGrossPremium: number;
  brokerageFee: number;
  status: PlacementParticipantClosing['status'];
  closingNumber: string;
}

function fmtPct(val: number) {
  return `${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}%`;
}

function fmtAmount(val: number, currency: string | null) {
  return `${currency ?? ''} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

function parseAmount(val: string | number | null | undefined) {
  if (val == null) return 0;
  const amount = typeof val === 'number' ? val : parseFloat(val);
  return Number.isFinite(amount) ? amount : 0;
}

function toClosingRow(
  closing: PlacementParticipantClosing,
  participant: PlacementParticipant | undefined,
  premium: number,
): ClosingRow {
  const fallbackCounterpartyId = participant?.counterpartyId ?? '';
  const fallbackName = participant?.counterparty?.name ?? 'Unknown reinsurer';
  const signedShare = parseAmount(participant?.signedLinePercent ?? participant?.sharePercent);
  return {
    id: closing.id,
    participantId: closing.participantId,
    counterpartyId: fallbackCounterpartyId,
    reinsurerCompany: fallbackName,
    signedShare,
    signedGrossPremium: (signedShare / 100) * premium,
    brokerageFee: parseAmount(participant?.brokerageFee),
    status: closing.status,
    closingNumber: closing.closingNumber,
  };
}

interface PlacementClosingsTabProps {
  placement: Facultative;
}

export function PlacementClosingsTab({ placement }: PlacementClosingsTabProps) {
  const [guaranteeNoteOpen, setGuaranteeNoteOpen] = useState(false);
  const [notePreviewTarget, setNotePreviewTarget] = useState<PlacementNote | null>(null);
  const [mailToCedantOpen, setMailToCedantOpen] = useState(false);
  const [mailToReinsurerRow, setMailToReinsurerRow] = useState<ClosingRow | null>(null);
  const [isOpeningDebitNote, setIsOpeningDebitNote] = useState(false);
  const [openingCreditNoteId, setOpeningCreditNoteId] = useState<string | null>(null);
  const debitNoteInFlightRef = useRef(false);
  const creditNoteInFlightRef = useRef<Set<string>>(new Set());

  const toast = useToast();
  const { data: cedants = [] } = useCedants();
  const { data: reinsurers = [] } = useReinsurers();
  const { data: closings = [], isLoading: closingsLoading } = usePlacementClosings(placement.id);
  const {
    data: notes = [],
    isLoading: notesLoading,
    isError: notesError,
    refetch: refetchNotes,
  } = usePlacementNotes(placement.id);
  const generateDebitNote = useGeneratePlacementDebitNote(placement.id);
  const generateCreditNote = useGeneratePlacementCreditNote(placement.id);
  const issueNote = useIssuePlacementNote(placement.id);
  const voidNote = useVoidPlacementNote(placement.id);

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

  const premium = placement.premium ?? 0;

  const rows: ClosingRow[] = closings
    .filter((closing) => closing.status !== 'VOID')
    .map((closing) =>
      toClosingRow(
        closing,
        placement.participants.find((p) => p.id === closing.participantId),
        premium,
      ),
    );

  const placementNotes = notes.filter(
    (note) => note.type === 'DEBIT_NOTE' || note.type === 'CREDIT_NOTE',
  );

  const findActiveDebitNote = (source = placementNotes) =>
    source.find((note) => note.type === 'DEBIT_NOTE' && note.status !== 'VOID');

  const findActiveCreditNote = (closingId: string, source = placementNotes) =>
    source.find(
      (note) =>
        note.type === 'CREDIT_NOTE' && note.closingId === closingId && note.status !== 'VOID',
    );

  const getLatestPlacementNotes = async () => {
    const latest = await refetchNotes();
    return (
      latest.data?.filter((item) => item.type === 'DEBIT_NOTE' || item.type === 'CREDIT_NOTE') ?? []
    );
  };

  const handleViewDebitNote = async () => {
    if (debitNoteInFlightRef.current) return;
    debitNoteInFlightRef.current = true;
    setIsOpeningDebitNote(true);
    try {
      let note = findActiveDebitNote();
      if (!note) {
        note = findActiveDebitNote(await getLatestPlacementNotes());
      }
      if (!note) {
        try {
          note = await generateDebitNote.mutateAsync();
        } catch (error) {
          note = findActiveDebitNote(await getLatestPlacementNotes());
          if (!note) throw error;
        }
      }
      setNotePreviewTarget(note);
    } catch (error) {
      toast.error(extractError(error, 'Failed to open debit note'));
    } finally {
      debitNoteInFlightRef.current = false;
      setIsOpeningDebitNote(false);
    }
  };

  const handleViewCreditNote = async (closingId: string) => {
    if (creditNoteInFlightRef.current.has(closingId)) return;
    creditNoteInFlightRef.current.add(closingId);
    setOpeningCreditNoteId(closingId);
    try {
      let note = findActiveCreditNote(closingId);
      if (!note) {
        note = findActiveCreditNote(closingId, await getLatestPlacementNotes());
      }
      if (!note) {
        try {
          note = await generateCreditNote.mutateAsync(closingId);
        } catch (error) {
          note = findActiveCreditNote(closingId, await getLatestPlacementNotes());
          if (!note) throw error;
        }
      }
      setNotePreviewTarget(note);
    } catch (error) {
      toast.error(extractError(error, 'Failed to open credit note'));
    } finally {
      creditNoteInFlightRef.current.delete(closingId);
      setOpeningCreditNoteId((current) => (current === closingId ? null : current));
    }
  };

  const handleIssueNote = async (noteId: string) => {
    try {
      await issueNote.mutateAsync(noteId);
      toast.success('Note issued');
    } catch (error) {
      toast.error(extractError(error, 'Failed to issue note'));
    }
  };

  const handleVoidNote = async ({ noteId, voidReason }: { noteId: string; voidReason: string }) => {
    try {
      await voidNote.mutateAsync({ noteId, voidReason });
      toast.success('Note voided');
    } catch (error) {
      toast.error(extractError(error, 'Failed to void note'));
    }
  };

  const columns: Column<ClosingRow>[] = [
    {
      key: 'closingNumber',
      label: 'Closing No.',
      width: '1fr',
      render: (row) => <span className="font-medium text-gray-900">{row.closingNumber}</span>,
    },
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
          {fmtAmount(row.signedGrossPremium, placement.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '1fr',
      render: (row) => <span className="text-gray-700">{row.status}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '1fr',
      render: (row) => (
        <div className="flex items-center gap-3">
          <TableButton
            onClick={() => handleViewCreditNote(row.id)}
            isLoading={openingCreditNoteId === row.id}
            disabled={row.status !== 'CONFIRMED' || !!openingCreditNoteId}
            tooltip={
              row.status !== 'CONFIRMED'
                ? 'Credit notes require a confirmed closing.'
                : openingCreditNoteId && openingCreditNoteId !== row.id
                  ? 'Another credit note is opening.'
                  : undefined
            }
          >
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
        isLoading={closingsLoading}
        emptyMessage="No closings have been created yet"
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
        secondaryButtons={[
          { label: 'View Guarantee Note', onClick: () => setGuaranteeNoteOpen(true) },
          {
            label: 'View Debit Note',
            onClick: handleViewDebitNote,
            isLoading: isOpeningDebitNote,
            disabled: isOpeningDebitNote,
            loadingText: 'Opening…',
          },
        ]}
        actionButton={{ label: 'Mail to Cedant', onClick: () => setMailToCedantOpen(true) }}
      />

      <div className="mt-6">
        <div className="mb-2 flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Backend Notes History
          </p>
          <p className="text-xs text-gray-400">
            Saved debit and credit notes for this placement. Use the closings actions above for the
            primary document workflow.
          </p>
        </div>
        <ReinsuranceNotesTable
          notes={placementNotes}
          isLoading={notesLoading}
          isError={notesError}
          emptyMessage="No placement notes yet"
          onIssue={handleIssueNote}
          onVoid={handleVoidNote}
          isVoidPending={voidNote.isPending}
        />
      </div>

      <GuaranteeNoteModal
        isOpen={guaranteeNoteOpen}
        placement={placement}
        counterpartyId=""
        reinsurerCompany=""
        onPrint={() => setGuaranteeNoteOpen(false)}
        onClose={() => setGuaranteeNoteOpen(false)}
      />

      {notePreviewTarget && (
        <PlacementNotePreviewModal
          isOpen
          note={notePreviewTarget}
          onPrint={() => setNotePreviewTarget(null)}
          onClose={() => setNotePreviewTarget(null)}
        />
      )}

      <MailPreviewModal
        isOpen={mailToCedantOpen}
        placement={placement}
        brokerageFee={0}
        recipients={fullCedant?.email ? [fullCedant.email] : []}
        primaryActionLabel="Close Preview"
        onSend={() => setMailToCedantOpen(false)}
        onClose={() => setMailToCedantOpen(false)}
      />

      {mailToReinsurerRow && (
        <MailPreviewModal
          isOpen={!!mailToReinsurerRow}
          placement={placement}
          brokerageFee={mailToReinsurerRow.brokerageFee}
          recipients={reinsurerEmails[mailToReinsurerRow.counterpartyId] ?? []}
          primaryActionLabel="Close Preview"
          onSend={() => setMailToReinsurerRow(null)}
          onClose={() => setMailToReinsurerRow(null)}
        />
      )}
    </>
  );
}
