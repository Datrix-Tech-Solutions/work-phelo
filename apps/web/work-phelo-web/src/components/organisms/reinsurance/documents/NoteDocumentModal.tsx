'use client';

import React from 'react';
import Image from 'next/image';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { Facultative, PlacementDocument, PlacementNote } from '@/types/reinsurance';
import { useCedants, useReinsurers, useRiskTypes } from '@/hooks';
import { placementDetailEntries } from '@/lib/reinsurance/placementFormDetails';
import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

type UnknownRecord = Record<string, unknown>;

interface NoteDocumentModalProps {
  isOpen: boolean;
  document: PlacementDocument | null;
  note?: PlacementNote | null;
  placement?: Facultative;
  onClose: () => void;
}

interface NoteRow {
  label: string;
  pct?: string;
  value?: string;
  bold?: boolean;
  divider?: boolean;
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

function fmtFieldValue(val: unknown): string {
  if (val == null || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtAmount(val: number | null, currency: string | null | undefined): string {
  if (val == null) return '—';
  return `${currency ?? ''} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

function fmtDateShort(value: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return text(value);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateLong(value: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return text(value);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function today(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function profileFromPayload(payload: UnknownRecord) {
  const profile = record(payload.documentProfile);
  const identity = record(profile.identity);
  const branding = record(profile.branding);
  const logo = record(branding.logo);
  const signature = record(branding.signature);
  const footer = record(profile.footer);
  const contact = record(profile.contact);
  const signatory = record(profile.signatory);
  const banking = record(profile.banking);

  return {
    displayName: text(identity.displayName || identity.legalName),
    logoSrc: typeof logo.dataUri === 'string' ? logo.dataUri : null,
    signatureSrc: typeof signature.dataUri === 'string' ? signature.dataUri : null,
    footerText: typeof footer.text === 'string' ? footer.text : null,
    contact,
    signatory,
    bankAccounts: Array.isArray(banking.defaultAccounts) ? banking.defaultAccounts.map(record) : [],
  };
}

function noteKind(type: unknown): 'CREDIT' | 'DEBIT' {
  return type === 'CREDIT_NOTE' || type === 'ENDORSEMENT_CREDIT_NOTE' ? 'CREDIT' : 'DEBIT';
}

/** Reinsurer-facing credit note — layout matches the pre-existing CreditNoteModal. */
function CreditNoteContent({
  note,
  placement,
  reinsurerCompany,
  profile,
}: {
  note: UnknownRecord;
  placement?: Facultative;
  reinsurerCompany: string;
  profile: ReturnType<typeof profileFromPayload>;
}) {
  const { data: reinsurers = [] } = useReinsurers();
  const counterpartyId = text(record(note.counterparty).id || note.counterpartyId);
  const reinsurer = reinsurers.find((r) => r.id === counterpartyId);
  const addr = reinsurer?.addresses?.find((a) => a.isPrimary) ?? reinsurer?.addresses?.[0];
  const reinsurerCity = addr?.city ?? null;
  const reinsurerRegionCountry = [addr?.state, addr?.country].filter(Boolean).join(' - ') || null;

  const currency =
    text(note.currency) !== '—' ? String(note.currency) : (placement?.currency ?? null);
  const grossAmount = numberValue(note.grossAmount);
  const commissionPct = numberValue(note.commissionPercent) ?? 0;
  const commissionAmt = numberValue(note.commissionAmount) ?? 0;
  const brokeragePct = numberValue(note.brokeragePercent) ?? 0;
  const brokerageAmt = numberValue(note.brokerageAmount) ?? 0;
  const totalCommissionPct = commissionPct + brokeragePct;
  const totalCommissionAmt = commissionAmt + brokerageAmt;
  const nicLevyPct = numberValue(note.nicLevyPercent) ?? 0;
  const nicLevyAmt = numberValue(note.nicLevyAmount) ?? 0;
  const withholdingTaxPct = numberValue(note.withholdingTaxPercent) ?? 0;
  const withholdingTaxAmt = numberValue(note.withholdingTaxAmount) ?? 0;
  const netAmount = numberValue(note.netAmount);

  const totalPremium = placement?.premium ?? null;
  const totalSumInsured = placement?.sumInsured ?? null;
  const impliedSharePercent =
    totalPremium && grossAmount != null && totalPremium !== 0
      ? (grossAmount / totalPremium) * 100
      : null;
  const yourSumInsured =
    impliedSharePercent != null && totalSumInsured != null
      ? (impliedSharePercent / 100) * totalSumInsured
      : null;

  const riskDetailRows: NoteRow[] = [
    ...placementDetailEntries(placement?.businessDetails ?? null),
    ...placementDetailEntries(placement?.offerDetails ?? null),
  ].map((entry) => ({ label: entry.label, value: fmtFieldValue(entry.value) }));

  const descriptionRows: NoteRow[] = [
    { label: 'Reinsured', value: text(placement?.cedant?.name) },
    { label: 'Insured', value: text(placement?.title) },
    { label: 'Policy Number', value: displayPolicyNumber(placement?.policyNumber ?? null) },
    { label: 'Class of Insurance', value: text(placement?.classOfBusiness) },
    ...riskDetailRows,
    {
      label: 'Period of Insurance',
      value: `${fmtDateShort(placement?.inceptionDate)} – ${fmtDateShort(placement?.expiryDate)}`,
    },
    { label: 'Currency', value: currency ?? '—' },
  ];

  const financialRows: NoteRow[] = [
    { label: 'Total Sum Insured', value: fmtAmount(totalSumInsured, currency) },
    { label: 'Total Premium', value: fmtAmount(totalPremium, currency) },
    {
      label: 'Your Share',
      pct: impliedSharePercent != null ? `${impliedSharePercent.toFixed(2)}%` : '—',
    },
    { label: 'Your Sum Insured', value: fmtAmount(yourSumInsured, currency) },
    { label: 'Your Premium', value: fmtAmount(grossAmount, currency) },
    {
      label: 'Less Commission',
      pct: `${totalCommissionPct}%`,
      value: fmtAmount(totalCommissionAmt, currency),
    },
    ...(nicLevyPct > 0
      ? [{ label: 'NIC Levy', pct: `${nicLevyPct}%`, value: fmtAmount(nicLevyAmt, currency) }]
      : []),
    ...(withholdingTaxPct > 0
      ? [
          {
            label: 'Withholding Tax',
            pct: `${withholdingTaxPct}%`,
            value: fmtAmount(withholdingTaxAmt, currency),
          },
        ]
      : []),
    { label: '', divider: true },
    { label: 'Net Premium', value: fmtAmount(netAmount, currency), bold: true },
  ];

  return (
    <>
      {/* Address block */}
      <div className="flex flex-col gap-0.5 text-sm mb-4">
        <p className="text-gray-500">{fmtDateLong(new Date().toISOString())}</p>
        <p className="font-medium text-gray-900 mt-2">The Managing Director</p>
        <p className="text-gray-800">{reinsurerCompany}</p>
        {reinsurerCity && <p className="text-gray-600">{reinsurerCity}</p>}
        {reinsurerRegionCountry && <p className="text-gray-600">{reinsurerRegionCountry}</p>}
        <p className="font-medium text-gray-900 mt-2">Dear Sir/Madam</p>
        <p className="text-gray-700 mt-3 leading-relaxed">
          We refer to the risk below and your subsequent acceptance of a share of the same risk.
          Kindly issue your guarantee in accordance with the information below.
        </p>
      </div>

      <table className="w-full text-sm border-collapse">
        <tbody>
          {descriptionRows.map((row, i) => (
            <tr key={i}>
              <td className="py-2 pr-4 text-gray-500 w-1/2">{row.label}</td>
              <td className="py-2 px-4 text-center text-gray-600 w-1/6 whitespace-nowrap">
                {row.pct ?? ''}
              </td>
              <td className="py-2 pl-4 text-right w-1/3 whitespace-nowrap text-gray-800">
                {row.value ?? ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="w-full text-sm border-collapse">
        <tbody>
          {financialRows.map((row, i) =>
            row.divider ? (
              <tr key={i}>
                <td colSpan={3} className="py-1">
                  <hr className="border-gray-100" />
                </td>
              </tr>
            ) : (
              <tr key={i}>
                <td
                  className={`py-2 pr-4 text-gray-500 w-1/2 ${row.bold ? 'font-semibold text-gray-900' : ''}`}
                >
                  {row.label}
                </td>
                <td className="py-2 px-4 text-center text-gray-600 w-1/6 whitespace-nowrap">
                  {row.pct ?? ''}
                </td>
                <td
                  className={`py-2 pl-4 text-right w-1/3 whitespace-nowrap ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-800'}`}
                >
                  {row.value ?? ''}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      {placement?.description && (
        <div className="my-2">
          <p className="text-xs font-semibold text-gray-400 tracking-wide mb-1">Kindly Refer:</p>
          <div
            className="text-sm text-gray-700"
            dangerouslySetInnerHTML={{ __html: placement.description }}
          />
        </div>
      )}

      <div className="mt-8 flex flex-col gap-2 text-sm text-gray-700">
        <p>Thank You.</p>
        <p>Yours faithfully,</p>
        <Image
          src={profile.signatureSrc ?? '/signature.png'}
          alt="Signature"
          width={160}
          height={80}
          className="object-contain mt-2 mb-1"
          unoptimized={!!profile.signatureSrc}
        />
        <div className="flex flex-col gap-0.5">
          <p className="font-bold text-gray-900">{text(profile.signatory.name)}</p>
          <p className="font-bold text-gray-900">{text(profile.signatory.title)}</p>
        </div>
      </div>
    </>
  );
}

/** Cedant-facing debit note — layout matches the pre-existing DebitNoteModal. */
function DebitNoteContent({
  note,
  placement,
  cedantName,
  profile,
}: {
  note: UnknownRecord;
  placement?: Facultative;
  cedantName: string;
  profile: ReturnType<typeof profileFromPayload>;
}) {
  const { data: cedants = [] } = useCedants();
  const counterpartyId = text(record(note.counterparty).id || note.counterpartyId);
  const fullCedant = cedants.find(
    (c) => c.id === (counterpartyId !== '—' ? counterpartyId : placement?.cedant?.id),
  );
  const primaryAddress =
    fullCedant?.addresses?.find((a) => a.isPrimary) ?? fullCedant?.addresses?.[0];
  const cedantLocation = primaryAddress
    ? [primaryAddress.city, primaryAddress.state, primaryAddress.country].filter(Boolean).join(', ')
    : null;

  const currency =
    text(note.currency) !== '—' ? String(note.currency) : (placement?.currency ?? null);
  const grossAmount = numberValue(note.grossAmount);
  const commissionPct = numberValue(note.commissionPercent) ?? 0;
  const commissionAmt = numberValue(note.commissionAmount);
  const netAmount = numberValue(note.netAmount);
  const totalPremium = placement?.premium ?? null;
  const impliedFacOffer =
    totalPremium && grossAmount != null && totalPremium !== 0
      ? (grossAmount / totalPremium) * 100
      : (placement?.facultativeOffer ?? 0);

  const debitNo =
    text(note.noteNumber) !== '—'
      ? text(note.noteNumber)
      : displayPolicyNumber(placement?.policyNumber ?? null);
  const debitDate = note.noteDate ? fmtDateShort(note.noteDate) : today();
  const policyNumberDisplay = displayPolicyNumber(placement?.policyNumber ?? null);

  const bankAccounts = profile.bankAccounts.filter(
    (account) => !currency || text(account.currency) === currency,
  );
  const netPremiumLabel =
    profile.displayName !== '—' ? `Net Premium Due ${profile.displayName}` : 'Net Premium Due';

  return (
    <>
      <div className="flex flex-col gap-4 text-sm">
        {/* Debit No / Date row */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs text-gray-400 uppercase tracking-wide">Debit No.</span>
            <p className="font-semibold text-gray-900">{debitNo}</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Date</span>
            <p className="font-semibold text-gray-900">{debitDate}</p>
          </div>
        </div>

        {/* Bill To */}
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Bill To</span>
          <p className="font-semibold text-gray-900">{cedantName}</p>
          {cedantLocation && <p className="text-gray-500">{cedantLocation}</p>}
        </div>

        {/* Table */}
        <table className="w-full border-collapse border border-gray-200 overflow-hidden text-sm">
          <tbody>
            <tr className="bg-blue-900">
              <td
                colSpan={2}
                className="py-2 px-4 text-center text-xs font-semibold text-gray-100 uppercase tracking-wide border-b border-blue-900"
              >
                Description
              </td>
            </tr>

            {[
              { label: 'Reinsured', value: cedantName },
              { label: 'Policy Type', value: text(placement?.classOfBusiness) },
            ].map((row) => (
              <tr key={row.label}>
                <td className="py-2 px-4 text-gray-500 w-1/2">{row.label}</td>
                <td className="py-2 px-4 text-right font-medium text-gray-900">{row.value}</td>
              </tr>
            ))}

            {[
              { label: 'Insured', value: text(placement?.title) },
              { label: 'Policy Number', value: policyNumberDisplay },
              {
                label: 'Policy Period',
                value: `${fmtDateShort(placement?.inceptionDate)} – ${fmtDateShort(placement?.expiryDate)}`,
              },
              { label: 'Currency', value: currency ?? '—' },
            ].map((row) => (
              <tr key={row.label}>
                <td className="py-2 px-4 text-gray-500 w-1/2">{row.label}</td>
                <td className="py-2 px-4 text-right font-medium text-gray-900">{row.value}</td>
              </tr>
            ))}

            <tr className="bg-blue-900">
              <td
                colSpan={2}
                className="py-2 px-4 text-center text-xs font-semibold text-gray-100 uppercase tracking-wide border-y border-blue-900"
              >
                Particulars
              </td>
            </tr>

            {[
              { label: '100% Gross Premium', value: fmtAmount(totalPremium, currency) },
              {
                label: `${impliedFacOffer.toFixed(2)}% Facultative Share`,
                value: fmtAmount(grossAmount, currency),
              },
              {
                label: `Less Commission ${commissionPct}%`,
                value: commissionAmt != null ? fmtAmount(commissionAmt, currency) : '—',
              },
              {
                label: netPremiumLabel,
                value: fmtAmount(netAmount, currency),
                bold: true,
              },
            ].map((row) => (
              <tr key={row.label}>
                <td
                  className={`py-2 px-4 w-1/2 ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
                >
                  {row.label}
                </td>
                <td
                  className={`py-2 px-4 text-right ${row.bold ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}
                >
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-10 flex flex-col gap-6 border-t border-gray-200 pt-6">
        <p className="text-sm text-gray-700 italic text-center">Thank you for choosing us!</p>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Signature / Stamp</span>
          <Image
            src={profile.signatureSrc ?? '/signature.png'}
            alt="Signature"
            width={160}
            height={80}
            className="object-contain mt-2"
            unoptimized={!!profile.signatureSrc}
          />
          <div className="w-64 border-b border-gray-400" />
        </div>

        {bankAccounts.length > 0 && (
          <div
            className="flex flex-col gap-1 p-4 border border-gray-200 rounded-lg bg-gray-50 text-xs text-gray-700"
            style={{ breakInside: 'avoid' }}
          >
            <p className="font-semibold text-gray-900 mb-1">Bank Account</p>
            {bankAccounts.map((account) => (
              <p key={text(account.id)}>
                {text(account.accountName)} · {text(account.bankName)}
                {account.branchName ? `, ${text(account.branchName)}` : ''} ·{' '}
                {text(account.currency)} {text(account.accountNumber)}
              </p>
            ))}
          </div>
        )}

        <p className="text-xs font-semibold text-gray-800 leading-relaxed">
          NOTE: COVER IS SUBJECT TO PREMIUM PAYMENT WARRANTY, PLEASE. WE WOULD THEREFORE APPRECIATE
          PAYMENT AS SOON AS POSSIBLE.
        </p>
      </div>
    </>
  );
}

export function NoteDocumentModal({
  isOpen,
  document,
  note: noteRecord,
  placement,
  onClose,
}: NoteDocumentModalProps) {
  const { data: riskTypes = [] } = useRiskTypes();

  if (!document && !noteRecord) return null;

  const payload = document ? record(document.renderPayload) : {};
  const note: UnknownRecord = document ? record(payload.note) : record(noteRecord);
  const profile = profileFromPayload(payload);
  const kind = noteKind(note.type);
  const title = kind === 'CREDIT' ? 'Closings' : 'Debit Note';
  const displayNumber = text(note.noteNumber || document?.documentNumber);
  const riskTypeName = placement
    ? (riskTypes.find((rt) => rt.id === placement.riskTypeId)?.name ?? null)
    : null;

  const counterparty = record(note.counterparty);
  const counterpartyName = text(counterparty.name || placement?.cedant?.name);
  const policyNumberDisplay = displayPolicyNumber(placement?.policyNumber ?? null);

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={
        kind === 'CREDIT'
          ? `Closings — ${policyNumberDisplay}`
          : `Debit Note — ${policyNumberDisplay}`
      }
      documentTitle={title}
      fileName={buildDocumentFileName(
        title,
        policyNumberDisplay,
        riskTypeName,
        placement?.title,
        kind === 'CREDIT' ? `to ${counterpartyName}` : `to ${text(placement?.cedant?.name)}`,
      )}
      logoSrc={profile.logoSrc}
      companyName={profile.displayName}
      qrValue={
        document
          ? `${document.documentNumber}:${document.version}:${document.status}`
          : `${displayNumber}:${text(note.id)}:${text(note.status)}`
      }
      onPrint={() => {}}
      onClose={onClose}
    >
      {kind === 'CREDIT' ? (
        <CreditNoteContent
          note={note}
          placement={placement}
          reinsurerCompany={counterpartyName}
          profile={profile}
        />
      ) : (
        <DebitNoteContent
          note={note}
          placement={placement}
          cedantName={counterpartyName}
          profile={profile}
        />
      )}
    </DocumentPreviewModal>
  );
}
