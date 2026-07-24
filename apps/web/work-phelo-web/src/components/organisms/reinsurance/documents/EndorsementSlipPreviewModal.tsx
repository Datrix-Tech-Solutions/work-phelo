'use client';

import React from 'react';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import {
  EndorsementParticipantClosing,
  Facultative,
  PlacementEndorsement,
  PlacementEndorsementParticipant,
  PlacementEndorsementSummary,
  PlacementNote,
} from '@/types/reinsurance';
import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';

interface EndorsementSlipPreviewModalProps {
  isOpen: boolean;
  placement: Facultative;
  endorsement: PlacementEndorsement;
  participants: PlacementEndorsementParticipant[];
  closings: EndorsementParticipantClosing[];
  notes: PlacementNote[];
  summary?: PlacementEndorsementSummary;
  onClose: () => void;
}

const CHANGE_FIELDS: {
  key: string;
  label: string;
  type: 'amount' | 'percent' | 'date' | 'text';
}[] = [
  { key: 'title', label: 'Insured', type: 'text' },
  { key: 'sumInsured', label: 'Sum Insured', type: 'amount' },
  { key: 'premium', label: 'Premium', type: 'amount' },
  { key: 'rate', label: 'Rate', type: 'percent' },
  { key: 'facultativeOffer', label: 'Facultative Offer', type: 'percent' },
  { key: 'commission', label: 'Commission', type: 'percent' },
  { key: 'currency', label: 'Currency', type: 'text' },
  { key: 'inceptionDate', label: 'Inception Date', type: 'date' },
  { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
  { key: 'classOfBusiness', label: 'Class of Business', type: 'text' },
];

type UnknownRecord = Record<string, unknown>;

function getSnapshotPlacement(snapshot: Record<string, unknown>): Record<string, unknown> {
  if (snapshot.placement && typeof snapshot.placement === 'object') {
    return snapshot.placement as Record<string, unknown>;
  }
  return snapshot;
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

function fmtPct(value: unknown): string {
  const numeric = numberValue(value);
  return numeric === null ? '—' : `${numeric.toLocaleString()}%`;
}

function fmtMoney(value: unknown, currency?: unknown): string {
  const numeric = numberValue(value);
  if (numeric === null) return '—';
  return `${currency ? `${currency} ` : ''}${numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatField(
  value: unknown,
  type: (typeof CHANGE_FIELDS)[number]['type'],
  currency: unknown,
) {
  if (type === 'amount') return fmtMoney(value, currency);
  if (type === 'percent') return fmtPct(value);
  if (type === 'date') return fmtDate(value);
  return text(value);
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

function ChangeTable({
  original,
  proposed,
  currency,
}: {
  original: UnknownRecord;
  proposed: UnknownRecord;
  currency: unknown;
}) {
  const changed = CHANGE_FIELDS.filter(({ key }) => {
    if (!(key in proposed)) return false;
    return String(original[key] ?? '') !== String(proposed[key] ?? '');
  });

  if (changed.length === 0) {
    return <p className="text-sm text-gray-400 italic">No revised placement terms recorded.</p>;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="py-1.5 pr-3 text-left text-xs font-semibold text-gray-500">Field</th>
          <th className="px-3 py-1.5 text-left text-xs font-semibold text-gray-500">Original</th>
          <th className="py-1.5 pl-3 text-left text-xs font-semibold text-gray-500">Proposed</th>
        </tr>
      </thead>
      <tbody>
        {changed.map((field) => (
          <tr key={field.key} className="border-b border-gray-50 last:border-0">
            <td className="py-1.5 pr-3 text-gray-500">{field.label}</td>
            <td className="px-3 py-1.5 text-gray-700">
              {formatField(original[field.key], field.type, original.currency ?? currency)}
            </td>
            <td className="py-1.5 pl-3 font-medium text-gray-900">
              {formatField(proposed[field.key], field.type, proposed.currency ?? currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EndorsementSlipPreviewModal({
  isOpen,
  placement,
  endorsement,
  participants,
  closings,
  notes,
  summary,
  onClose,
}: EndorsementSlipPreviewModalProps) {
  const original = getSnapshotPlacement(endorsement.originalSnapshot);
  const proposed = getSnapshotPlacement(endorsement.proposedSnapshot ?? {});
  const confirmedClosings = closings.filter((closing) => closing.status === 'CONFIRMED');

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`Endorsement Slip Preview — ${endorsement.endorsementNumber}`}
      documentTitle="Endorsement Slip Preview"
      fileName={buildDocumentFileName(
        'Endorsement Slip Preview',
        endorsement.endorsementNumber,
        placement.reference,
      )}
      qrValue={`${endorsement.endorsementNumber}:${endorsement.id}:PREVIEW`}
      onPrint={() => {}}
      onClose={onClose}
    >
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
        Backend record preview. No immutable official endorsement slip snapshot has been generated
        yet.
      </div>

      <SectionHeading>Endorsement</SectionHeading>
      <InfoRows
        rows={[
          { label: 'Placement Reference', value: placement.reference },
          { label: 'Insured', value: placement.title },
          { label: 'Endorsement Number', value: endorsement.endorsementNumber },
          { label: 'Endorsement Type', value: endorsement.type },
          { label: 'Impact Type', value: text(endorsement.impactType) },
          { label: 'Status', value: endorsement.status },
          { label: 'Effective Date', value: fmtDate(endorsement.effectiveDate) },
          { label: 'Reason', value: text(endorsement.reason) },
        ]}
      />

      <SectionHeading>Original vs Proposed Business</SectionHeading>
      <ChangeTable original={original} proposed={proposed} currency={placement.currency} />

      <SectionHeading>Capacity Summary</SectionHeading>
      <InfoRows
        rows={[
          {
            label: 'Target Capacity',
            value: summary?.targetPercent == null ? '—' : `${summary.targetPercent}%`,
          },
          { label: 'Accepted Capacity', value: summary ? `${summary.acceptedPercent}%` : '—' },
          { label: 'Confirmed Capacity', value: summary ? `${summary.placedPercent}%` : '—' },
          {
            label: 'Remaining Capacity',
            value: summary?.remainingPercent == null ? '—' : `${summary.remainingPercent}%`,
          },
        ]}
      />

      <SectionHeading>Endorsement Participants</SectionHeading>
      {participants.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No endorsement participants recorded.</p>
      ) : (
        <InfoRows
          rows={participants.map((participant) => ({
            label: participant.counterparty?.name ?? participant.counterpartyId,
            value: `${participant.originalParticipantId ? 'REVISED' : 'ADDED'} · ${participant.status} · ${fmtPct(
              participant.signedLinePercent ?? participant.sharePercent,
            )}`,
          }))}
        />
      )}

      <SectionHeading>Confirmed Closings</SectionHeading>
      {confirmedClosings.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No confirmed endorsement closings yet.</p>
      ) : (
        <InfoRows
          rows={confirmedClosings.map((closing) => ({
            label: closing.closingNumber,
            value: `${closing.endorsementParticipant.counterparty.name} · ${fmtPct(
              closing.signedLinePercent,
            )} · Net ${fmtMoney(closing.netPremium, closing.currency)}`,
          }))}
        />
      )}

      {notes.length > 0 && (
        <>
          <SectionHeading>Endorsement Notes</SectionHeading>
          <InfoRows
            rows={notes.map((note) => ({
              label: note.noteNumber,
              value: `${note.type} · ${note.status} · Net ${fmtMoney(note.netAmount, note.currency)}`,
            }))}
          />
        </>
      )}
    </DocumentPreviewModal>
  );
}
