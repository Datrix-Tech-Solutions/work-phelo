'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Icons } from '@/components/atoms/icons';
import { SlipPreviewModal } from '@/components/organisms/reinsurance/SlipPreviewModal';
import { GuaranteeNoteModal } from '@/components/organisms/reinsurance/GuaranteeNoteModal';
import { CreditNoteModal } from '@/components/organisms/reinsurance/CreditNoteModal';
import { DebitNoteModal } from '@/components/organisms/reinsurance/DebitNoteModal';
import { Facultative, PlacementParticipant } from '@/types/reinsurance';

interface ClosingRow {
  id: string;
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
  const [slipPreviewId, setSlipPreviewId] = useState<string | null>(null);
  const [guaranteeOpen, setGuaranteeOpen] = useState(false);
  const [creditNoteRow, setCreditNoteRow] = useState<ClosingRow | null>(null);
  const [debitNoteOpen, setDebitNoteOpen] = useState(false);

  const premium = placement.premium ?? 0;

  const rows: ClosingRow[] = placement.participants
    .filter((p) => p.status === 'ACCEPTED' || p.status === 'CLOSED')
    .map((p) => toClosingRow(p, premium));

  const slipRow = rows.find((r) => r.id === slipPreviewId);

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
        <div className="flex items-center gap-2 w-full pr-10">
          <button
            type="button"
            onClick={() => {
              /* TODO */
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-900 border border-gray-300 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
          >
            <Icons.Mail className="w-3.5 h-3.5 shrink-0" />
            Mail cedant
          </button>
          <button
            type="button"
            onClick={() => setSlipPreviewId(row.id)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-900 border border-gray-300 rounded-lg hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-colors"
          >
            <Icons.SendHorizonal className="w-3.5 h-3.5 shrink-0" />
            Mail reinsurer
          </button>
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
        rowActions={(row) => [
          { label: 'View Closings', onClick: () => {} },
          { label: 'View Credit Note', onClick: () => setCreditNoteRow(row) },
          { label: 'View Debit Note', onClick: () => setDebitNoteOpen(true) },
          { label: 'View Guarantee Note', onClick: () => setGuaranteeOpen(true) },
        ]}
      />

      <SlipPreviewModal
        isOpen={!!slipPreviewId}
        placement={placement}
        brokerageFee={slipRow?.brokerageFee ?? 0}
        onPrint={() => setSlipPreviewId(null)}
        onClose={() => setSlipPreviewId(null)}
      />

      <GuaranteeNoteModal
        isOpen={guaranteeOpen}
        placement={placement}
        onPrint={() => setGuaranteeOpen(false)}
        onClose={() => setGuaranteeOpen(false)}
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
          onPrint={() => setCreditNoteRow(null)}
          onClose={() => setCreditNoteRow(null)}
        />
      )}
    </>
  );
}
