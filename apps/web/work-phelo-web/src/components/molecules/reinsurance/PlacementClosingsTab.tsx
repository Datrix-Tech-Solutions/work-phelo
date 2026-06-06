'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { TableActionButton } from '@/components/atoms/TableActionButton';
import { Icons } from '@/components/atoms/icons';
import { GuaranteeNoteModal } from '@/components/organisms/reinsurance/documents/GuaranteeNoteModal';
import { CreditNoteModal } from '@/components/organisms/reinsurance/documents/CreditNoteModal';
import { DebitNoteModal } from '@/components/organisms/reinsurance/documents/DebitNoteModal';
import { MailPreviewModal } from '@/components/organisms/reinsurance/MailPreviewModal';
import { useCedants, useReinsurers } from '@/hooks';
import { Facultative, PlacementParticipant } from '@/types/reinsurance';

interface ClosingRow {
  id: string;
  counterpartyId: string;
  reinsurerCompany: string;
  signedShare: number;
  signedGrossPremium: number;
  brokerageFee: number;
}

function fmtPct(val: number) {
  return `${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}%`;
}

function fmtAmount(val: number, currency: string | null) {
  return `${currency ?? ''} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

function toClosingRow(p: PlacementParticipant, premium: number): ClosingRow {
  const signedShare = parseFloat(p.signedLinePercent ?? p.sharePercent ?? '0');
  return {
    id: p.id,
    counterpartyId: p.counterpartyId,
    reinsurerCompany: p.counterparty.name,
    signedShare,
    signedGrossPremium: (signedShare / 100) * premium,
    brokerageFee: parseFloat(p.brokerageFee ?? '0'),
  };
}

interface PlacementClosingsTabProps {
  placement: Facultative;
}

export function PlacementClosingsTab({ placement }: PlacementClosingsTabProps) {
  const [guaranteeNoteOpen, setGuaranteeNoteOpen] = useState(false);
  const [creditNoteRow, setCreditNoteRow] = useState<ClosingRow | null>(null);
  const [debitNoteOpen, setDebitNoteOpen] = useState(false);
  const [mailToCedantOpen, setMailToCedantOpen] = useState(false);
  const [mailToReinsurerRow, setMailToReinsurerRow] = useState<ClosingRow | null>(null);

  const { data: cedants = [] } = useCedants();
  const { data: reinsurers = [] } = useReinsurers();

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

  const rows: ClosingRow[] = placement.participants
    .filter((p) => p.status === 'ACCEPTED' || p.status === 'CLOSED')
    .map((p) => toClosingRow(p, premium));

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
          {fmtAmount(row.signedGrossPremium, placement.currency)}
        </span>
      ),
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
            icon={<Icons.Mail className="w-3.5 h-3.5 shrink-0" />}
            onClick={() => setDebitNoteOpen(true)}
          >
            View Debit Note
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
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="No accepted participants yet"
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
        secondaryButton={{
          label: 'View Guarantee Note',
          onClick: () => setGuaranteeNoteOpen(true),
        }}
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
