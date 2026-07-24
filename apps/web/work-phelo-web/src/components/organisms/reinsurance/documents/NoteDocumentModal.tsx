'use client';

import React from 'react';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { PlacementDocument } from '@/types/reinsurance';
import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';

type UnknownRecord = Record<string, unknown>;

interface NoteDocumentModalProps {
  isOpen: boolean;
  document: PlacementDocument | null;
  onClose: () => void;
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
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

function fmtMoney(value: unknown, currency?: unknown): string {
  const numeric = numberValue(value);
  if (numeric === null) return '—';
  return `${currency ? `${currency} ` : ''}${numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
  const banking = record(profile.banking);

  return {
    displayName: text(identity.displayName || identity.legalName),
    logoSrc: typeof logo.dataUri === 'string' ? logo.dataUri : null,
    footerText: typeof footer.text === 'string' ? footer.text : null,
    contact,
    signatory,
    bankAccounts: Array.isArray(banking.defaultAccounts) ? banking.defaultAccounts.map(record) : [],
  };
}

function statusLabel(status: unknown): string {
  if (status === 'ISSUED') return 'Issued / Official';
  if (status === 'VOID') return 'Void / Historical';
  return 'Draft / Not Issued';
}

function documentTitle(type: unknown): string {
  if (type === 'CREDIT_NOTE' || type === 'ENDORSEMENT_CREDIT_NOTE') return 'Credit Note';
  return 'Debit Note';
}

function NoteFooter({ payload }: { payload: UnknownRecord }) {
  const profile = profileFromPayload(payload);
  return (
    <div className="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-500">
      {profile.bankAccounts.length > 0 && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="font-semibold text-gray-800">Bank Account</p>
          {profile.bankAccounts.map((account) => (
            <p key={text(account.id)} className="mt-1">
              {text(account.accountName)} · {text(account.bankName)}
              {account.branchName ? `, ${account.branchName}` : ''} · {text(account.currency)}{' '}
              {text(account.accountNumber)}
            </p>
          ))}
        </div>
      )}
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

export function NoteDocumentModal({ isOpen, document, onClose }: NoteDocumentModalProps) {
  if (!document) return null;

  const payload = record(document.renderPayload);
  const note = record(payload.note);
  const placement = record(note.placement);
  const counterparty = record(note.counterparty);
  const closing = record(note.closing || note.endorsementClosing);
  const title = documentTitle(note.type);
  const profile = profileFromPayload(payload);

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`${title} — ${text(note.noteNumber || document.documentNumber)}`}
      documentTitle={title}
      fileName={buildDocumentFileName(title, text(note.noteNumber || document.documentNumber))}
      logoSrc={profile.logoSrc}
      companyName={profile.displayName}
      qrValue={`${document.documentNumber}:${document.version}:${document.status}`}
      onPrint={() => {}}
      onClose={onClose}
    >
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        {statusLabel(note.status)}
        {note.status === 'DRAFT' && (
          <span className="block pt-1 text-amber-700">
            This note is a backend draft. Issue it before treating it as official.
          </span>
        )}
      </div>

      <SectionHeading>Document Control</SectionHeading>
      <InfoRows
        rows={[
          { label: 'Document Number', value: document.documentNumber },
          { label: 'Note Number', value: text(note.noteNumber) },
          { label: 'Version', value: `v${document.version}` },
          { label: 'Status', value: statusLabel(note.status) },
          { label: 'Note Date', value: fmtDate(note.noteDate) },
          { label: 'Issued At', value: fmtDate(note.issuedAt) },
        ]}
      />

      <SectionHeading>Business Details</SectionHeading>
      <InfoRows
        rows={[
          { label: 'Placement Reference', value: text(placement.reference) },
          { label: 'Insured', value: text(placement.title) },
          { label: 'Class of Business', value: text(placement.classOfBusiness) },
          { label: 'Counterparty', value: text(counterparty.name) },
          { label: 'Closing', value: text(closing.closingNumber) },
          { label: 'Currency', value: text(note.currency) },
        ]}
      />

      <SectionHeading>Financial Snapshot</SectionHeading>
      <InfoRows
        rows={[
          { label: 'Gross Amount', value: fmtMoney(note.grossAmount, note.currency) },
          { label: 'Commission', value: fmtMoney(note.commissionAmount, note.currency) },
          { label: 'Brokerage', value: fmtMoney(note.brokerageAmount, note.currency) },
          { label: 'NIC Levy', value: fmtMoney(note.nicLevyAmount, note.currency) },
          {
            label: 'Withholding Tax',
            value: fmtMoney(note.withholdingTaxAmount, note.currency),
          },
          { label: 'Net Amount', value: fmtMoney(note.netAmount, note.currency) },
        ]}
      />

      <NoteFooter payload={payload} />
    </DocumentPreviewModal>
  );
}
