'use client';

import React from 'react';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import {
  EndorsementParticipantClosing,
  Facultative,
  PlacementEndorsement,
} from '@/types/reinsurance';
import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';

interface EndorsementClosingSnapshotModalProps {
  isOpen: boolean;
  placement: Facultative;
  endorsement: PlacementEndorsement;
  closing: EndorsementParticipantClosing | null;
  onClose: () => void;
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtPct(value: unknown): string {
  const numeric = numberValue(value);
  if (numeric === null) return '—';
  return `${numeric.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })}%`;
}

function fmtMoney(value: unknown, currency?: string | null): string {
  const numeric = numberValue(value);
  if (numeric === null) return '—';
  return `${currency ?? ''} ${numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`.trim();
}

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return text(value);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-6 first:mt-0">
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-500">
        {children}
      </p>
      <div className="border-t border-gray-300" />
    </div>
  );
}

function InfoRows({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-gray-50 last:border-0">
            <td className="w-2/5 py-1.5 pr-4 text-gray-500">{row.label}</td>
            <td className="py-1.5 pl-4 font-medium text-gray-900">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EndorsementClosingSnapshotModal({
  isOpen,
  placement,
  endorsement,
  closing,
  onClose,
}: EndorsementClosingSnapshotModalProps) {
  if (!closing) return null;

  const reinsurer = closing.endorsementParticipant.counterparty;
  const originalParticipantId = closing.endorsementParticipant.originalParticipantId;

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`Endorsement Closing — ${closing.closingNumber}`}
      documentTitle="Endorsement Closing Snapshot"
      fileName={buildDocumentFileName(
        'Endorsement Closing Snapshot',
        closing.closingNumber,
        endorsement.endorsementNumber,
        reinsurer.name,
      )}
      qrValue={`${closing.closingNumber}:${closing.id}:${closing.status}`}
      onPrint={() => {}}
      onClose={onClose}
    >
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
        Backend endorsement closing snapshot. This is inspection-only and does not generate an
        official certificate.
      </div>

      <SectionHeading>Closing Control</SectionHeading>
      <InfoRows
        rows={[
          { label: 'Closing Number', value: closing.closingNumber },
          { label: 'Status', value: closing.status },
          { label: 'Created', value: fmtDate(closing.createdAt) },
          { label: 'Issued At', value: fmtDate(closing.issuedAt) },
          { label: 'Confirmed At', value: fmtDate(closing.confirmedAt) },
        ]}
      />

      <SectionHeading>Endorsement</SectionHeading>
      <InfoRows
        rows={[
          { label: 'Placement Reference', value: placement.reference },
          { label: 'Insured', value: placement.title },
          { label: 'Endorsement Number', value: endorsement.endorsementNumber },
          { label: 'Endorsement Type', value: endorsement.type },
          { label: 'Impact Type', value: text(endorsement.impactType) },
          { label: 'Effective Date', value: fmtDate(endorsement.effectiveDate) },
        ]}
      />

      <SectionHeading>Reinsurer</SectionHeading>
      <InfoRows
        rows={[
          { label: 'Reinsurer', value: reinsurer.name },
          { label: 'Registration Number', value: text(reinsurer.registrationNumber) },
          {
            label: 'Participant Classification',
            value: originalParticipantId ? 'REVISED' : 'ADDED',
          },
          { label: 'Original Participant ID', value: text(originalParticipantId) },
        ]}
      />

      <SectionHeading>Financial Snapshot</SectionHeading>
      <InfoRows
        rows={[
          { label: 'Signed Line', value: fmtPct(closing.signedLinePercent) },
          { label: 'Share Percent', value: fmtPct(closing.sharePercent) },
          {
            label: 'Sum Insured Snapshot',
            value: fmtMoney(closing.sumInsuredSnapshot, closing.currency),
          },
          { label: 'Premium Snapshot', value: fmtMoney(closing.premiumSnapshot, closing.currency) },
          { label: 'Commission Percent', value: fmtPct(closing.commissionPercent) },
          {
            label: 'Commission Amount',
            value: fmtMoney(closing.commissionAmount, closing.currency),
          },
          { label: 'Brokerage Percent', value: fmtPct(closing.brokeragePercent) },
          { label: 'Brokerage Amount', value: fmtMoney(closing.brokerageAmount, closing.currency) },
          { label: 'Net Premium', value: fmtMoney(closing.netPremium, closing.currency) },
        ]}
      />
    </DocumentPreviewModal>
  );
}
