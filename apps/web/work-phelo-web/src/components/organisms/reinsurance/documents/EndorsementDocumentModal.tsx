'use client';

import React from 'react';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { PlacementDocument } from '@/types/reinsurance';
import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';

type UnknownRecord = Record<string, unknown>;

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

interface EndorsementDocumentModalProps {
  isOpen: boolean;
  document: PlacementDocument | null;
  onClose: () => void;
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function list(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function getPayload(document: PlacementDocument | null): UnknownRecord {
  return record(document?.renderPayload);
}

function getPlacement(snapshot: unknown): UnknownRecord {
  const item = record(snapshot);
  return record(item.placement).id ? record(item.placement) : item;
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

function fmtPercent(value: unknown): string {
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
  if (type === 'percent') return fmtPercent(value);
  if (type === 'date') return fmtDate(value);
  return text(value);
}

function changedFieldRows(original: UnknownRecord, proposed: UnknownRecord) {
  return CHANGE_FIELDS.filter(({ key }) => {
    if (!(key in proposed)) return false;
    return String(original[key] ?? '') !== String(proposed[key] ?? '');
  });
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-6 first:mt-0">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
        {children}
      </p>
      <div className="border-t border-gray-300" />
    </div>
  );
}

function InfoRows({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <table className="w-full text-sm border-collapse">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-gray-50 last:border-0">
            <td className="py-1.5 pr-4 text-gray-500 w-2/5">{row.label}</td>
            <td className="py-1.5 pl-4 text-gray-900 font-medium">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function profileFromPayload(payload: UnknownRecord) {
  const profile = record(payload.documentProfile);
  const identity = record(profile.identity);
  const branding = record(profile.branding);
  const logo = record(branding.logo);
  const footer = record(profile.footer);
  const contact = record(profile.contact);
  const signatory = record(profile.signatory);

  return {
    displayName: text(identity.displayName || identity.legalName),
    logoSrc: typeof logo.dataUri === 'string' ? logo.dataUri : null,
    footerText: typeof footer.text === 'string' ? footer.text : null,
    contact,
    signatory,
  };
}

function DocumentFooter({ payload }: { payload: UnknownRecord }) {
  const profile = profileFromPayload(payload);
  return (
    <div className="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-500">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-semibold text-gray-700">Authorized Signatory</p>
          <p>{text(profile.signatory.name)}</p>
          <p>{text(profile.signatory.title)}</p>
        </div>
        <div className="text-right">
          <p>{text(profile.contact.physicalAddress)}</p>
          <p>{text(profile.contact.phone)}</p>
          <p>{text(profile.contact.email)}</p>
        </div>
      </div>
      {profile.footerText && <p className="mt-3 text-center">{profile.footerText}</p>}
    </div>
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
  const changed = changedFieldRows(original, proposed);
  if (changed.length === 0) {
    return <p className="text-sm text-gray-400 italic">No revised placement terms recorded.</p>;
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="py-1.5 pr-3 text-left text-xs font-semibold text-gray-500">Field</th>
          <th className="py-1.5 px-3 text-left text-xs font-semibold text-gray-500">Original</th>
          <th className="py-1.5 pl-3 text-left text-xs font-semibold text-gray-500">Proposed</th>
        </tr>
      </thead>
      <tbody>
        {changed.map((field) => (
          <tr key={field.key} className="border-b border-gray-50 last:border-0">
            <td className="py-1.5 pr-3 text-gray-500">{field.label}</td>
            <td className="py-1.5 px-3 text-gray-700">
              {formatField(original[field.key], field.type, original.currency ?? currency)}
            </td>
            <td className="py-1.5 pl-3 text-gray-900 font-medium">
              {formatField(proposed[field.key], field.type, proposed.currency ?? currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ParticipationTable({ participants }: { participants: UnknownRecord[] }) {
  if (participants.length === 0) {
    return <p className="text-sm text-gray-400 italic">No endorsement participants recorded.</p>;
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="py-1.5 pr-3 text-left text-xs font-semibold text-gray-500">Reinsurer</th>
          <th className="py-1.5 px-3 text-left text-xs font-semibold text-gray-500">Class</th>
          <th className="py-1.5 px-3 text-left text-xs font-semibold text-gray-500">Status</th>
          <th className="py-1.5 pl-3 text-right text-xs font-semibold text-gray-500">
            Accepted Line
          </th>
        </tr>
      </thead>
      <tbody>
        {participants.map((participant) => {
          const counterparty = record(participant.counterparty);
          const originalParticipant = record(participant.originalParticipant);
          const classification = originalParticipant.id ? 'REVISED' : 'ADDED';
          return (
            <tr key={text(participant.id)} className="border-b border-gray-50 last:border-0">
              <td className="py-1.5 pr-3 text-gray-900 font-medium">
                {text(counterparty.name || participant.counterpartyId)}
              </td>
              <td className="py-1.5 px-3 text-gray-700">{classification}</td>
              <td className="py-1.5 px-3 text-gray-700">{text(participant.status)}</td>
              <td className="py-1.5 pl-3 text-right text-gray-900">
                {fmtPercent(participant.signedLinePercent ?? participant.sharePercent)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ConfirmedClosingsTable({ closings }: { closings: UnknownRecord[] }) {
  const confirmed = closings.filter((closing) => closing.status === 'CONFIRMED');
  if (confirmed.length === 0) {
    return <p className="text-sm text-gray-400 italic">No confirmed endorsement closings yet.</p>;
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="py-1.5 pr-3 text-left text-xs font-semibold text-gray-500">Closing</th>
          <th className="py-1.5 px-3 text-left text-xs font-semibold text-gray-500">Reinsurer</th>
          <th className="py-1.5 px-3 text-right text-xs font-semibold text-gray-500">Line</th>
          <th className="py-1.5 pl-3 text-right text-xs font-semibold text-gray-500">
            Net Premium
          </th>
        </tr>
      </thead>
      <tbody>
        {confirmed.map((closing) => {
          const endorsementParticipant = record(closing.endorsementParticipant);
          const counterparty = record(endorsementParticipant.counterparty);
          return (
            <tr key={text(closing.id)} className="border-b border-gray-50 last:border-0">
              <td className="py-1.5 pr-3 text-gray-900 font-medium">
                {text(closing.closingNumber)}
              </td>
              <td className="py-1.5 px-3 text-gray-700">{text(counterparty.name)}</td>
              <td className="py-1.5 px-3 text-right text-gray-700">
                {fmtPercent(closing.signedLinePercent)}
              </td>
              <td className="py-1.5 pl-3 text-right text-gray-900 font-medium">
                {fmtMoney(closing.netPremium, closing.currency)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function NoteRows({ notes }: { notes: UnknownRecord[] }) {
  if (notes.length === 0) return null;
  return (
    <>
      <SectionHeading>Financial Notes</SectionHeading>
      <InfoRows
        rows={notes.map((note) => ({
          label: text(note.noteNumber),
          value: `${text(note.type)} · ${text(note.status)} · ${fmtMoney(
            note.netAmount,
            note.currency,
          )}`,
        }))}
      />
    </>
  );
}

function EndorsementSlipContent({ document }: { document: PlacementDocument }) {
  const payload = getPayload(document);
  const endorsement = record(payload.endorsement);
  const placement = record(endorsement.placement);
  const original = getPlacement(endorsement.originalSnapshot);
  const proposed = getPlacement(endorsement.proposedSnapshot);
  const participants = list(endorsement.participants);
  const closings = list(endorsement.closings);
  const notes = list(endorsement.notes);

  return (
    <>
      <SectionHeading>Document Control</SectionHeading>
      <InfoRows
        rows={[
          { label: 'Document Number', value: document.documentNumber },
          { label: 'Version', value: `v${document.version}` },
          { label: 'Status', value: document.status },
          { label: 'Generated', value: fmtDate(document.generatedAt ?? document.createdAt) },
        ]}
      />

      <SectionHeading>Policy Information</SectionHeading>
      <InfoRows
        rows={[
          { label: 'Placement Reference', value: text(placement.reference) },
          { label: 'Cedant', value: text(record(placement.cedant).name) },
          { label: 'Insured', value: text(placement.title || proposed.title || original.title) },
          { label: 'Endorsement No.', value: text(endorsement.endorsementNumber) },
          { label: 'Endorsement Type', value: text(endorsement.type) },
          { label: 'Impact Type', value: text(endorsement.impactType) },
          { label: 'Effective Date', value: fmtDate(endorsement.effectiveDate) },
        ]}
      />

      <SectionHeading>Original vs Proposed Business</SectionHeading>
      <ChangeTable original={original} proposed={proposed} currency={placement.currency} />

      <SectionHeading>Market Response</SectionHeading>
      <ParticipationTable participants={participants} />

      <SectionHeading>Confirmed Endorsement Closings</SectionHeading>
      <ConfirmedClosingsTable closings={closings} />

      <NoteRows notes={notes} />
      <DocumentFooter payload={payload} />
    </>
  );
}

function EndorsementCertificateContent({ document }: { document: PlacementDocument }) {
  const payload = getPayload(document);
  const closing = record(payload.endorsementCertificate);
  const placement = record(closing.placement);
  const endorsement = record(closing.endorsement);
  const participant = record(closing.endorsementParticipant);
  const counterparty = record(participant.counterparty);
  const original = getPlacement(endorsement.originalSnapshot);
  const proposed = getPlacement(endorsement.proposedSnapshot);
  const notes = list(closing.notes);

  return (
    <>
      <SectionHeading>Document Control</SectionHeading>
      <InfoRows
        rows={[
          { label: 'Document Number', value: document.documentNumber },
          { label: 'Version', value: `v${document.version}` },
          { label: 'Status', value: document.status },
          { label: 'Generated', value: fmtDate(document.generatedAt ?? document.createdAt) },
        ]}
      />

      <SectionHeading>Certificate Information</SectionHeading>
      <InfoRows
        rows={[
          { label: 'Placement Reference', value: text(placement.reference) },
          { label: 'Cedant', value: text(record(placement.cedant).name) },
          { label: 'Reinsurer', value: text(counterparty.name) },
          { label: 'Insured', value: text(placement.title || proposed.title || original.title) },
          { label: 'Endorsement No.', value: text(endorsement.endorsementNumber) },
          { label: 'Closing No.', value: text(closing.closingNumber) },
          { label: 'Effective Date', value: fmtDate(endorsement.effectiveDate) },
          { label: 'Confirmed Date', value: fmtDate(closing.confirmedAt) },
        ]}
      />

      <SectionHeading>Original vs Proposed Business</SectionHeading>
      <ChangeTable original={original} proposed={proposed} currency={placement.currency} />

      <SectionHeading>Confirmed Reinsurer Position</SectionHeading>
      <InfoRows
        rows={[
          { label: 'Confirmed Line', value: fmtPercent(closing.signedLinePercent) },
          { label: 'Gross Premium', value: fmtMoney(closing.premiumSnapshot, closing.currency) },
          { label: 'Commission', value: fmtMoney(closing.commissionAmount, closing.currency) },
          { label: 'Brokerage', value: fmtMoney(closing.brokerageAmount, closing.currency) },
          { label: 'Net Premium', value: fmtMoney(closing.netPremium, closing.currency) },
        ]}
      />

      <NoteRows notes={notes} />
      <DocumentFooter payload={payload} />
    </>
  );
}

export function EndorsementDocumentModal({
  isOpen,
  document,
  onClose,
}: EndorsementDocumentModalProps) {
  if (!document) return null;

  const payload = getPayload(document);
  const profile = profileFromPayload(payload);
  const documentTitle =
    document.type === 'ENDORSEMENT_CERTIFICATE' ? 'Endorsement Certificate' : 'Endorsement Slip';

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`${documentTitle} — ${document.documentNumber}`}
      documentTitle={documentTitle}
      fileName={buildDocumentFileName(documentTitle, document.documentNumber)}
      logoSrc={profile.logoSrc}
      companyName={profile.displayName}
      qrValue={`${document.documentNumber}:${document.version}:${document.status}`}
      onPrint={() => {}}
      onClose={onClose}
    >
      {document.type === 'ENDORSEMENT_CERTIFICATE' ? (
        <EndorsementCertificateContent document={document} />
      ) : (
        <EndorsementSlipContent document={document} />
      )}
    </DocumentPreviewModal>
  );
}
