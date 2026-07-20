'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { TableButton } from '@/components/atoms/TableButton';
import { GuaranteeNoteModal } from '@/components/organisms/reinsurance/documents/GuaranteeNoteModal';
import { CreditNoteModal } from '@/components/organisms/reinsurance/documents/CreditNoteModal';
import { DebitNoteModal } from '@/components/organisms/reinsurance/documents/DebitNoteModal';
import { MailPreviewModal } from '@/components/organisms/reinsurance/MailPreviewModal';
import {
  useCedants,
  useReinsurers,
  usePlacementEndorsements,
  usePlacementEffectiveView,
} from '@/hooks';
import { useReinsuranceCharges } from '@/hooks/reinsurance/useReinsuranceCharges';
import { Facultative, PlacementParticipant, isEndorsementSentToMarket } from '@/types/reinsurance';
import { isForeignCedant, selectChargeRate } from '@/lib/reinsuranceTax';

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
  const [debitNoteOpen, setDebitNoteOpen] = useState(false);
  const [creditNoteRow, setCreditNoteRow] = useState<ClosingRow | null>(null);
  const [mailToCedantOpen, setMailToCedantOpen] = useState(false);
  const [mailToReinsurerRow, setMailToReinsurerRow] = useState<ClosingRow | null>(null);

  const { data: cedants = [] } = useCedants();
  const { data: reinsurers = [] } = useReinsurers();
  const { data: charges } = useReinsuranceCharges();
  const { data: endorsements = [] } = usePlacementEndorsements(placement.id);
  const hasActiveEndorsement = endorsements.some((e) => isEndorsementSentToMarket(e.status));
  const { data: effectiveView, isLoading: isLoadingEffectiveView } = usePlacementEffectiveView(
    placement.id,
    hasActiveEndorsement,
  );

  const fullCedant = cedants.find((c) => c.id === placement.cedant.id);
  const foreignCedant = isForeignCedant(fullCedant);

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
  const effectiveTotals = hasActiveEndorsement ? effectiveView?.effectiveTotals : undefined;
  const participantShareOverrides = effectiveView
    ? Object.fromEntries(
        effectiveView.effectiveParticipants.map((ep) => [ep.counterpartyId, ep.signedLinePercent]),
      )
    : undefined;

  const baseRows: ClosingRow[] = placement.participants
    .filter((p) => p.status === 'CLOSED')
    .map((p) => toClosingRow(p, premium));

  // Once an endorsement is in market, overlay the revised share/premium from the
  // effective view onto the base rows, and surface any reinsurer that only exists
  // because of the endorsement (not part of the original placement closings).
  const effectiveByCounterpartyId =
    hasActiveEndorsement && effectiveView
      ? new Map(effectiveView.effectiveParticipants.map((ep) => [ep.counterpartyId, ep]))
      : null;

  const rows: ClosingRow[] = effectiveByCounterpartyId
    ? [
        ...baseRows.map((row) => {
          const ep = effectiveByCounterpartyId.get(row.counterpartyId);
          if (!ep) return row;
          effectiveByCounterpartyId.delete(row.counterpartyId);
          return { ...row, signedShare: ep.signedLinePercent, signedGrossPremium: ep.grossPremium };
        }),
        ...[...effectiveByCounterpartyId.values()].map((ep) => ({
          id: ep.counterpartyId,
          counterpartyId: ep.counterpartyId,
          reinsurerCompany: ep.counterparty.name,
          signedShare: ep.signedLinePercent,
          signedGrossPremium: ep.grossPremium,
          brokerageFee: reinsurers.find((r) => r.id === ep.counterpartyId)?.brokerageFee ?? 0,
        })),
      ]
    : baseRows;

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
      width: '1fr',
      render: (row) => (
        <div className="flex items-center gap-3">
          <TableButton onClick={() => setCreditNoteRow(row)}>View Closings</TableButton>
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
        isLoading={hasActiveEndorsement && isLoadingEffectiveView}
        emptyMessage="No accepted participants yet"
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
        secondaryButtons={[
          { label: 'View Guarantee Note', onClick: () => setGuaranteeNoteOpen(true) },
          { label: 'View Debit Note', onClick: () => setDebitNoteOpen(true) },
        ]}
        actionButton={{ label: 'Mail to Cedant', onClick: () => setMailToCedantOpen(true) }}
      />

      <GuaranteeNoteModal
        isOpen={guaranteeNoteOpen}
        placement={placement}
        counterpartyId=""
        reinsurerCompany=""
        facultativeOfferOverride={effectiveTotals?.facultativeOfferPercent}
        sumInsuredOverride={effectiveTotals?.sumInsured}
        premiumOverride={effectiveTotals?.premium}
        commissionOverride={effectiveTotals?.commissionPercent}
        participantShareOverrides={hasActiveEndorsement ? participantShareOverrides : undefined}
        onPrint={() => setGuaranteeNoteOpen(false)}
        onClose={() => setGuaranteeNoteOpen(false)}
      />

      <DebitNoteModal
        isOpen={debitNoteOpen}
        placement={placement}
        facultativeOfferOverride={effectiveTotals?.facultativeOfferPercent}
        premiumOverride={effectiveTotals?.premium}
        commissionOverride={effectiveTotals?.commissionPercent}
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
          nicLevyPct={foreignCedant ? selectChargeRate(charges, 'NIC_LEVY', placement.currency) : 0}
          withholdingTaxPct={
            foreignCedant ? selectChargeRate(charges, 'WITHHOLDING_TAX', placement.currency) : 0
          }
          sumInsuredOverride={effectiveTotals?.sumInsured}
          premiumOverride={effectiveTotals?.premium}
          commissionOverride={effectiveTotals?.commissionPercent}
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
