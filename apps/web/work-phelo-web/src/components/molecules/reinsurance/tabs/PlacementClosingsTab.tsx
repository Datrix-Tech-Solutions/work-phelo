'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { TableActionButton } from '@/components/atoms/TableActionButton';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Icons } from '@/components/atoms/icons';
import { GuaranteeNoteModal } from '@/components/organisms/reinsurance/documents/GuaranteeNoteModal';
import { CreditNoteModal } from '@/components/organisms/reinsurance/documents/CreditNoteModal';
import { DebitNoteModal } from '@/components/organisms/reinsurance/documents/DebitNoteModal';
import { MailPreviewModal } from '@/components/organisms/reinsurance/MailPreviewModal';
import {
  useCedants,
  useCreateClosing,
  usePlacementClosings,
  useReinsurers,
  useUpdateClosingStatus,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import {
  Facultative,
  PlacementParticipant,
  PlacementParticipantClosing,
  PlacementParticipantClosingStatus,
} from '@/types/reinsurance';

interface ClosingRow {
  id: string;
  participantId: string;
  counterpartyId: string;
  reinsurerCompany: string;
  closingNumber: string;
  status: PlacementParticipantClosingStatus;
  signedShare: number;
  signedGrossPremium: number;
  brokerageFee: number;
  currency: string | null;
}

function fmtPct(val: number) {
  return `${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}%`;
}

function fmtAmount(val: number, currency: string | null) {
  return `${currency ?? ''} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

function toClosingRow(closing: PlacementParticipantClosing): ClosingRow {
  return {
    id: closing.id,
    participantId: closing.participantId,
    counterpartyId: closing.participant.counterpartyId,
    reinsurerCompany: closing.participant.counterparty.name,
    closingNumber: closing.closingNumber,
    status: closing.status,
    signedShare: parseFloat(closing.signedLinePercent),
    signedGrossPremium: parseFloat(closing.grossPremium ?? '0'),
    brokerageFee: parseFloat(closing.brokeragePercent ?? '0'),
    currency: closing.currency,
  };
}

const CLOSING_STATUS_VARIANT: Record<
  PlacementParticipantClosingStatus,
  'neutral' | 'info' | 'success' | 'danger'
> = {
  DRAFT: 'neutral',
  ISSUED: 'info',
  CONFIRMED: 'success',
  VOID: 'danger',
};

interface PlacementClosingsTabProps {
  placement: Facultative;
}

export function PlacementClosingsTab({ placement }: PlacementClosingsTabProps) {
  const [guaranteeNoteOpen, setGuaranteeNoteOpen] = useState(false);
  const [debitNoteOpen, setDebitNoteOpen] = useState(false);
  const [creditNoteRow, setCreditNoteRow] = useState<ClosingRow | null>(null);
  const [mailToCedantOpen, setMailToCedantOpen] = useState(false);
  const [mailToReinsurerRow, setMailToReinsurerRow] = useState<ClosingRow | null>(null);
  const [recoveringParticipantId, setRecoveringParticipantId] = useState<string | null>(null);

  const { data: cedants = [] } = useCedants();
  const { data: reinsurers = [] } = useReinsurers();
  const { data: closings = [], isLoading: closingsLoading } = usePlacementClosings(placement.id);
  const { mutateAsync: createClosing } = useCreateClosing(placement.id);
  const { mutateAsync: updateClosingStatus } = useUpdateClosingStatus(placement.id);
  const addToast = useToastStore((state) => state.addToast);

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

  const rows = closings.map(toClosingRow);
  const activeClosingParticipantIds = new Set(
    closings.filter((closing) => closing.status !== 'VOID').map((closing) => closing.participantId),
  );
  const acceptedParticipantsWithoutClosing = placement.participants.filter(
    (participant) =>
      participant.status === 'ACCEPTED' && !activeClosingParticipantIds.has(participant.id),
  );
  const hasAcceptedParticipants = placement.participants.some(
    (participant) => participant.status === 'ACCEPTED',
  );
  const hasConfirmedClosing = closings.some((closing) => closing.status === 'CONFIRMED');

  const handleCreateConfirmedClosing = async (participant: PlacementParticipant) => {
    setRecoveringParticipantId(participant.id);
    try {
      const closing = await createClosing(participant.id);
      await updateClosingStatus({ closingId: closing.id, status: 'ISSUED' });
      await updateClosingStatus({ closingId: closing.id, status: 'CONFIRMED' });
      addToast({ message: 'Confirmed closing created successfully', type: 'success' });
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    } finally {
      setRecoveringParticipantId(null);
    }
  };

  const columns: Column<ClosingRow>[] = [
    {
      key: 'closingNumber',
      label: 'Closing',
      width: '0.8fr',
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
        <span className="text-gray-700">{fmtAmount(row.signedGrossPremium, row.currency)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '0.8fr',
      render: (row) => <Badge label={row.status} variant={CLOSING_STATUS_VARIANT[row.status]} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '2.5fr',
      render: (row) => (
        <div className="flex items-center gap-5 w-full justify-end">
          <TableActionButton
            icon={<Icons.Mail className="w-3.5 h-3.5 shrink-0" />}
            onClick={() => setCreditNoteRow(row)}
          >
            View Credit Note
          </TableActionButton>
          <TableActionButton
            icon={<Icons.SendHorizonal className="w-3.5 h-3.5 shrink-0" />}
            onClick={() => setMailToReinsurerRow(row)}
          >
            Mail reinsurer
          </TableActionButton>
        </div>
      ),
    },
  ];

  return (
    <>
      {hasAcceptedParticipants && !hasConfirmedClosing && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Accepted reinsurers exist without confirmed closings. Create and confirm a closing before
          recording payments.
        </div>
      )}

      {acceptedParticipantsWithoutClosing.length > 0 && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-gray-900">Closing recovery</p>
          <div className="mt-3 flex flex-col gap-2">
            {acceptedParticipantsWithoutClosing.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2"
              >
                <span className="text-sm text-gray-700">{participant.counterparty.name}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  isLoading={recoveringParticipantId === participant.id}
                  loadingText="Creating…"
                  disabled={recoveringParticipantId !== null}
                  onClick={() => void handleCreateConfirmedClosing(participant)}
                >
                  Create confirmed closing
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        isLoading={closingsLoading}
        emptyMessage="No closings have been created yet."
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
        secondaryButtons={[
          { label: 'View Guarantee Note', onClick: () => setGuaranteeNoteOpen(true) },
          { label: 'View Debit Note', onClick: () => setDebitNoteOpen(true) },
        ]}
        actionButton={{ label: 'Mail to cedant', onClick: () => setMailToCedantOpen(true) }}
      />

      <GuaranteeNoteModal
        isOpen={guaranteeNoteOpen}
        placement={placement}
        counterpartyId=""
        reinsurerCompany=""
        onPrint={() => setGuaranteeNoteOpen(false)}
        onClose={() => setGuaranteeNoteOpen(false)}
      />

      <DebitNoteModal
        isOpen={debitNoteOpen}
        placement={placement}
        onPrint={() => setDebitNoteOpen(false)}
        onClose={() => setDebitNoteOpen(false)}
      />

      {creditNoteRow && (
        <CreditNoteModal
          isOpen={!!creditNoteRow}
          placement={placement}
          sharePercent={creditNoteRow.signedShare}
          brokerageFee={creditNoteRow.brokerageFee}
          counterpartyId={creditNoteRow.counterpartyId}
          reinsurerCompany={creditNoteRow.reinsurerCompany}
          onPrint={() => setCreditNoteRow(null)}
          onClose={() => setCreditNoteRow(null)}
        />
      )}

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
