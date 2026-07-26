'use client';

import React from 'react';
import { DetailField } from '@/components/atoms/DetailField';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import {
  EndorsementParticipantClosing,
  Facultative,
  PlacementEndorsement,
  PlacementEndorsementParticipant,
  PlacementEndorsementSummary,
  PlacementNote,
} from '@/types/reinsurance';
import { useReinsurers, useRiskTypes } from '@/hooks';
import { useReinsuranceCharges } from '@/hooks/reinsurance/useReinsuranceCharges';
import { isForeignCedant, selectChargeRate } from '@/lib/reinsuranceTax';
import { placementDetailEntries } from '@/lib/reinsurance/placementFormDetails';
import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

interface EndorsementSlipPreviewModalProps {
  isOpen: boolean;
  placement: Facultative;
  endorsement: PlacementEndorsement;
  participants: PlacementEndorsementParticipant[];
  closings: EndorsementParticipantClosing[];
  notes: PlacementNote[];
  summary?: PlacementEndorsementSummary;
  documentTitle?: string;
  previewNotice?: string;
  focusedCounterpartyId?: string | null;
  focusedRecipient?: {
    name: string;
    relationship: string;
    offeredLinePercent: string | number;
    status: string;
  } | null;
  /** 'OFFER_SLIP' — brand-new market participant, rendered like the original placement's
   *  Offer Slip. 'REVISED_CERTIFICATE' — existing participant reviewing revised terms,
   *  rendered like the endorsement certificate (Original vs Revised participation/impact),
   *  computed live since no closing has been confirmed yet. Omitted for the whole-endorsement
   *  overview, which keeps the generic layout. */
  previewFormat?: 'OFFER_SLIP' | 'REVISED_CERTIFICATE';
  brokerageFee?: number;
  onClose: () => void;
}

type FieldType = 'amount' | 'percent' | 'date' | 'text';

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

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === '—') return null;
  return <DetailField inline label={label} value={value} />;
}

function getSnapshotParticipants(snapshot: Record<string, unknown>): Record<string, unknown>[] {
  const ps = snapshot.participants;
  return Array.isArray(ps) ? (ps as Record<string, unknown>[]) : [];
}

function toNum(val: unknown): number {
  if (val == null) return 0;
  const n = typeof val === 'string' ? parseFloat(val) : Number(val);
  return isNaN(n) ? 0 : n;
}

function renderFieldVal(val: unknown, type: FieldType, currency: unknown): string {
  if (val == null || val === '') return '—';
  if (type === 'amount') return fmtMoney(toNum(val), currency);
  if (type === 'percent') return `${toNum(val)}%`;
  if (type === 'date') return fmtDate(val);
  return String(val);
}

function buildChangeSentence(
  changedFields: { key: string; label: string; type: FieldType }[],
  originalPlacement: UnknownRecord,
  proposed: UnknownRecord,
  effectiveDate: unknown,
  prevCurrency: unknown,
  currency: unknown,
): React.ReactNode {
  if (changedFields.length === 0) return null;

  const clauses: React.ReactNode[] = changedFields.map(({ key, label, type }) => {
    const prev = originalPlacement[key];
    const curr = proposed[key];
    const prevStr = renderFieldVal(prev, type, prevCurrency);
    const currStr = renderFieldVal(curr, type, currency);
    let verb = 'changed';
    if (type === 'amount' || type === 'percent') {
      verb = toNum(curr) > toNum(prev) ? 'increased' : 'decreased';
    }
    return (
      <React.Fragment key={key}>
        the {label.toLowerCase()} was {verb} from <strong>{prevStr}</strong> to{' '}
        <strong>{currStr}</strong>
      </React.Fragment>
    );
  });

  const joined: React.ReactNode[] = [];
  clauses.forEach((clause, i) => {
    if (i > 0) {
      joined.push(
        <React.Fragment key={`sep-${i}`}>
          {i === clauses.length - 1 ? ', and ' : ', '}
        </React.Fragment>,
      );
    }
    joined.push(clause);
  });

  return (
    <>
      Effective from <strong>{fmtDate(effectiveDate)}</strong>, {joined}.
    </>
  );
}

/**
 * Content for an existing participant reviewing revised endorsement terms — mirrors the
 * pre-existing EndorsementReinsurerCertificateModal layout exactly, computed live since no
 * closing has been confirmed for this endorsement yet.
 */
function RevisedOfferContent({
  placement,
  endorsement,
  counterpartyId,
  reinsurerName,
  sharePercent,
  brokerageFee,
}: {
  placement: Facultative;
  endorsement: PlacementEndorsement;
  counterpartyId: string;
  reinsurerName: string;
  sharePercent: number;
  brokerageFee: number;
}) {
  const originalPlacement = getSnapshotPlacement(endorsement.originalSnapshot);
  const proposed = endorsement.proposedSnapshot
    ? getSnapshotPlacement(endorsement.proposedSnapshot)
    : null;

  const originalParticipants = getSnapshotParticipants(endorsement.originalSnapshot);
  const originalParticipant = originalParticipants.find(
    (p) => text(p.counterpartyId) === counterpartyId,
  );

  // Previous values
  const prevShare = toNum(
    originalParticipant?.signedLinePercent ?? originalParticipant?.sharePercent,
  );
  const prevBrokerage = toNum(originalParticipant?.brokerageFee);
  const prevPremium = toNum(originalPlacement.premium);
  const prevSumInsured = toNum(originalPlacement.sumInsured);
  const prevCommission = toNum(originalPlacement.commission);
  const prevCurrency = text(originalPlacement.currency);
  const prevYourPremium = (prevShare / 100) * prevPremium;
  const prevYourSumInsured = (prevShare / 100) * prevSumInsured;
  const prevCommissionAmt = ((prevCommission + prevBrokerage) / 100) * prevYourPremium;
  const prevNetPremium = prevYourPremium - prevCommissionAmt;

  // Revised values — live, since this endorsement hasn't been confirmed/closed yet
  const currency = placement.currency;
  const yourPremium = (sharePercent / 100) * (placement.premium ?? 0);
  const yourSumInsured = (sharePercent / 100) * (placement.sumInsured ?? 0);
  const commissionAmt = (((placement.commission ?? 0) + brokerageFee) / 100) * yourPremium;
  const netPremium = yourPremium - commissionAmt;

  // Financial impact (deltas)
  const additionalPremium = yourPremium - prevYourPremium;
  const additionalCommission = commissionAmt - prevCommissionAmt;
  const netAmountPayable = netPremium - prevNetPremium;

  const changedFields = proposed
    ? CHANGE_FIELDS.filter(({ key }) => {
        const prev = originalPlacement[key];
        const curr = proposed[key];
        return curr !== undefined && String(prev ?? '') !== String(curr ?? '');
      })
    : [];

  const narrative =
    proposed && changedFields.length > 0
      ? buildChangeSentence(
          changedFields,
          originalPlacement,
          proposed,
          endorsement.effectiveDate,
          prevCurrency,
          currency,
        )
      : null;

  return (
    <>
      {/* POLICY INFORMATION */}
      <SectionHeading>Policy Information</SectionHeading>
      <table className="w-full text-sm border-collapse mb-2">
        <tbody>
          {[
            { label: 'Cedant', value: placement.cedant.name },
            { label: 'Reinsurer', value: reinsurerName },
            { label: 'Insured', value: text(placement.title) },
            { label: 'Policy Number', value: displayPolicyNumber(placement.policyNumber) },
            { label: 'Endorsement No.', value: endorsement.endorsementNumber },
            { label: 'Effective Date', value: fmtDate(endorsement.effectiveDate) },
            { label: 'Currency', value: text(placement.currency) },
            { label: 'Class of Business', value: text(placement.classOfBusiness) },
          ].map((row) => (
            <tr key={row.label} className="border-b border-gray-50 last:border-0">
              <td className="py-1.5 pr-4 text-gray-500 w-2/5">{row.label}</td>
              <td className="py-1.5 pl-4 text-gray-900 font-medium">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ENDORSEMENT SUMMARY */}
      <SectionHeading>Endorsement Summary</SectionHeading>
      <div className="text-sm mb-2 space-y-2">
        {Boolean(endorsement.reason) && (
          <div>
            <span className="text-gray-500">Reason:</span>
            <p className="text-gray-900 font-medium mt-0.5">{endorsement.reason}</p>
          </div>
        )}
        {narrative ? (
          <p className="text-gray-800 leading-relaxed">{narrative}</p>
        ) : (
          <p className="text-gray-400 italic">No parameter changes recorded.</p>
        )}
      </div>

      {/* REINSURER PARTICIPATION */}
      <SectionHeading>Reinsurer Participation</SectionHeading>
      <table className="w-full text-sm border-collapse mb-2">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-1.5 pr-4 text-left text-xs font-semibold text-gray-500 w-1/3" />
            <th className="py-1.5 px-4 text-left text-xs font-semibold text-gray-500 w-1/3">
              Original
            </th>
            <th className="py-1.5 pl-4 text-left text-xs font-semibold text-gray-500 w-1/3">
              Revised
            </th>
          </tr>
        </thead>
        <tbody>
          {[
            {
              label: 'Your Participation %',
              previous: prevShare ? `${prevShare}%` : 'no change',
              revised: `${sharePercent}%`,
              bold: false,
            },
            {
              label: 'Your Share SI',
              previous: fmtMoney(prevYourSumInsured || null, prevCurrency),
              revised: fmtMoney(yourSumInsured, currency),
              bold: false,
            },
            {
              label: 'Your Gross Premium',
              previous: fmtMoney(prevYourPremium || null, prevCurrency),
              revised: fmtMoney(yourPremium, currency),
              bold: false,
            },
            {
              label: 'Your Commission',
              previous: fmtMoney(prevCommissionAmt || null, prevCurrency),
              revised: fmtMoney(commissionAmt, currency),
              bold: false,
            },
            {
              label: 'Your Net Premium',
              previous: fmtMoney(prevNetPremium || null, prevCurrency),
              revised: fmtMoney(netPremium, currency),
              bold: true,
            },
          ].map((row) => (
            <tr key={row.label} className="border-b border-gray-50 last:border-0">
              <td
                className={`py-1.5 pr-4 ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
              >
                {row.label}
              </td>
              <td
                className={`py-1.5 px-4 ${row.bold ? 'font-semibold text-gray-600' : 'text-gray-700'}`}
              >
                {row.previous}
              </td>
              <td
                className={`py-1.5 pl-4 ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-900'}`}
              >
                {row.revised}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* FINANCIAL IMPACT */}
      <SectionHeading>Financial Impact</SectionHeading>
      <table className="w-full text-sm border-collapse mb-2">
        <tbody>
          {[
            {
              label: additionalPremium >= 0 ? 'Additional Premium Due' : 'Return Premium',
              value: fmtMoney(Math.abs(additionalPremium), currency),
            },
            {
              label: additionalCommission >= 0 ? 'Additional Commission' : 'Return Commission',
              value: fmtMoney(Math.abs(additionalCommission), currency),
            },
            {
              label: netAmountPayable >= 0 ? 'Net Amount Payable' : 'Net Amount Returnable',
              value: fmtMoney(Math.abs(netAmountPayable), currency),
              bold: true,
            },
          ].map((row) => (
            <tr key={row.label} className="border-b border-gray-50 last:border-0">
              <td
                className={`py-1.5 pr-4 ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
              >
                {row.label}
              </td>
              <td
                className={`py-1.5 pl-4 text-right ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-900'}`}
              >
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* SPECIAL CONDITIONS */}
      <SectionHeading>Special Conditions</SectionHeading>
      <ul className="text-sm text-gray-700 space-y-1 list-none mb-2">
        <li>• All other terms remain unchanged.</li>
        <li>• This endorsement forms part of the original facultative slip.</li>
      </ul>
    </>
  );
}

/**
 * Content for a brand-new endorsement market offer — mirrors the original placement's
 * SlipPreviewModal layout exactly, just sourced from the endorsement's current (proposed)
 * terms instead of the original placement snapshot, and offered at this recipient's line.
 */
function OfferSlipContent({
  placement,
  endorsement,
  counterpartyId,
  offeredLinePercent,
  brokerageFee,
}: {
  placement: Facultative;
  endorsement: PlacementEndorsement;
  counterpartyId?: string | null;
  offeredLinePercent: number;
  brokerageFee: number;
}) {
  const proposed = getSnapshotPlacement(endorsement.proposedSnapshot ?? {});
  const pick = <T,>(key: string, fallback: T): T =>
    proposed[key] !== undefined && proposed[key] !== null ? (proposed[key] as T) : fallback;

  const currency = pick('currency', placement.currency);
  const sumInsured = pick<number | null>('sumInsured', placement.sumInsured);
  const premium = pick<number | null>('premium', placement.premium);
  const commission = pick<number | null>('commission', placement.commission);
  const rate = pick<number | null>('rate', placement.rate);
  const classOfBusiness = pick<string | null>('classOfBusiness', placement.classOfBusiness);
  const title = pick<string>('title', placement.title);
  const inceptionDate = pick<string | null>('inceptionDate', placement.inceptionDate);
  const expiryDate = pick<string | null>('expiryDate', placement.expiryDate);
  const businessDetails = pick<Record<string, unknown> | null>(
    'businessDetails',
    placement.businessDetails,
  );
  const offerDetails = pick<Record<string, unknown> | null>('offerDetails', placement.offerDetails);
  const description = pick<string | null>('description', placement.description);

  const { data: reinsurers = [] } = useReinsurers();
  const { data: charges } = useReinsuranceCharges();
  const reinsurer = reinsurers.find((r) => r.id === counterpartyId);
  const foreignReinsurer = isForeignCedant(reinsurer);
  const nicLevyRate = selectChargeRate(charges, 'NIC_LEVY', currency);
  const withholdingTaxRate = selectChargeRate(charges, 'WITHHOLDING_TAX', currency);

  const businessEntries = placementDetailEntries(businessDetails);
  const offerEntries = placementDetailEntries(offerDetails);

  const facOffer = offeredLinePercent;
  const facSumInsured = sumInsured != null ? (facOffer / 100) * sumInsured : null;
  const reinsurancePremium = premium != null ? (facOffer / 100) * premium : null;
  const commissions =
    reinsurancePremium != null
      ? (((commission ?? 0) + brokerageFee) / 100) * reinsurancePremium
      : null;
  const netPremium =
    reinsurancePremium != null && commissions != null ? reinsurancePremium - commissions : null;
  const nicLevy =
    foreignReinsurer && reinsurancePremium != null
      ? reinsurancePremium * (nicLevyRate / 100)
      : null;
  const withholdingTax =
    foreignReinsurer && reinsurancePremium != null
      ? reinsurancePremium * (withholdingTaxRate / 100)
      : null;
  const netPremiumPayable =
    netPremium != null ? netPremium - (nicLevy ?? 0) - (withholdingTax ?? 0) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="mb-4">
        <Field label="Date" value={fmtDate(new Date().toISOString())} />
      </div>
      <Field label="Cover Type" value={classOfBusiness} />
      <Field label="Original Insured" value={title} />
      <Field label="Policy Number" value={displayPolicyNumber(placement.policyNumber)} />
      <Field label="Currency" value={currency} />
      {(inceptionDate || expiryDate) && (
        <Field
          label="Insurance Period"
          value={`${fmtDate(inceptionDate ?? '')} – ${fmtDate(expiryDate ?? '')}`}
        />
      )}

      {(businessEntries.length > 0 || offerEntries.length > 0) && (
        <>
          <hr className="border-gray-100 my-1" />
          {businessEntries.map((entry) => {
            const formatted = text(entry.value);
            return formatted === '—' ? null : (
              <DetailField key={entry.key} inline label={entry.label} value={formatted} />
            );
          })}
          {offerEntries.map((entry) => {
            const formatted = text(entry.value);
            return formatted === '—' ? null : (
              <DetailField key={entry.key} inline label={entry.label} value={formatted} />
            );
          })}
        </>
      )}

      {(sumInsured != null ||
        rate != null ||
        premium != null ||
        facSumInsured != null ||
        reinsurancePremium != null) && (
        <>
          <hr className="border-gray-100 my-1" />
          <Field
            label="100% Sum Insured"
            value={sumInsured != null ? fmtMoney(sumInsured, currency) : null}
          />
          <Field label="Premium Rate" value={rate != null ? `${rate}%` : null} />
          <Field
            label="100% Gross Premium"
            value={premium != null ? fmtMoney(premium, currency) : null}
          />
          <Field
            label="Offer"
            value={
              facSumInsured != null ? `${fmtMoney(facSumInsured, currency)} (${facOffer}%)` : null
            }
          />
          <Field
            label="Reinsurance Premium"
            value={reinsurancePremium != null ? fmtMoney(reinsurancePremium, currency) : null}
          />
          <Field
            label="Reinsurance Commission"
            value={
              commissions != null
                ? `${fmtMoney(commissions, currency)} (${(commission ?? 0) + brokerageFee}%)`
                : null
            }
          />
          {nicLevy != null && withholdingTax != null && (
            <>
              <Field label={`NIC Levy (${nicLevyRate}%)`} value={fmtMoney(nicLevy, currency)} />
              <Field
                label={`Withholding Tax (${withholdingTaxRate}%)`}
                value={fmtMoney(withholdingTax, currency)}
              />
            </>
          )}
        </>
      )}

      {netPremiumPayable != null && (
        <>
          <hr className="border-gray-100 my-1" />
          <Field label="Net Premium" value={fmtMoney(netPremiumPayable, currency)} />
        </>
      )}
      {description && (
        <>
          <hr className="border-gray-100 my-1" />
          <p className="text-xs font-semibold text-gray-400 tracking-wide">Kindly Refer:</p>
          <div
            className="text-sm text-gray-700"
            dangerouslySetInnerHTML={{ __html: description }}
          />
        </>
      )}
    </div>
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
  documentTitle = 'Endorsement Slip Preview',
  previewNotice = 'Backend record preview. No immutable official endorsement slip snapshot has been generated yet.',
  focusedCounterpartyId,
  focusedRecipient,
  previewFormat,
  brokerageFee = 0,
  onClose,
}: EndorsementSlipPreviewModalProps) {
  const { data: riskTypes = [] } = useRiskTypes();
  const original = getSnapshotPlacement(endorsement.originalSnapshot);
  const proposed = getSnapshotPlacement(endorsement.proposedSnapshot ?? {});
  const confirmedClosings = closings.filter((closing) => closing.status === 'CONFIRMED');
  const focusedParticipant = focusedCounterpartyId
    ? participants.find((participant) => participant.counterpartyId === focusedCounterpartyId)
    : undefined;
  const focusedReinsurerName =
    focusedRecipient?.name ??
    focusedParticipant?.counterparty?.name ??
    focusedParticipant?.counterpartyId ??
    null;

  if (previewFormat === 'OFFER_SLIP') {
    const riskTypeName = riskTypes.find((rt) => rt.id === placement.riskTypeId)?.name ?? null;
    const offeredLinePercent = Number(focusedRecipient?.offeredLinePercent ?? 0);
    return (
      <DocumentPreviewModal
        isOpen={isOpen}
        title={`${documentTitle} — ${placement.title}`}
        documentTitle="Facultative Offer Slip"
        fileName={buildDocumentFileName(
          'Offer Slip',
          displayPolicyNumber(placement.policyNumber),
          riskTypeName,
          placement.title,
          focusedReinsurerName ?? undefined,
        )}
        onPrint={() => {}}
        onClose={onClose}
      >
        <OfferSlipContent
          placement={placement}
          endorsement={endorsement}
          counterpartyId={focusedCounterpartyId}
          offeredLinePercent={Number.isFinite(offeredLinePercent) ? offeredLinePercent : 0}
          brokerageFee={brokerageFee}
        />
      </DocumentPreviewModal>
    );
  }

  if (previewFormat === 'REVISED_CERTIFICATE') {
    const riskTypeName = riskTypes.find((rt) => rt.id === placement.riskTypeId)?.name ?? null;
    const sharePercent = Number(focusedRecipient?.offeredLinePercent ?? 0);
    return (
      <DocumentPreviewModal
        isOpen={isOpen}
        title={`Endorsement Certificate — ${endorsement.endorsementNumber}`}
        documentTitle="Endorsement Certificate"
        fileName={buildDocumentFileName(
          'Endorsement Certificate',
          displayPolicyNumber(placement.policyNumber),
          riskTypeName,
          placement.title,
          focusedReinsurerName ? `to ${focusedReinsurerName}` : null,
        )}
        onPrint={() => {}}
        onClose={onClose}
      >
        <RevisedOfferContent
          placement={placement}
          endorsement={endorsement}
          counterpartyId={focusedCounterpartyId ?? ''}
          reinsurerName={focusedReinsurerName ?? ''}
          sharePercent={Number.isFinite(sharePercent) ? sharePercent : 0}
          brokerageFee={brokerageFee}
        />
      </DocumentPreviewModal>
    );
  }

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`${documentTitle} — ${endorsement.endorsementNumber}`}
      documentTitle={documentTitle}
      fileName={buildDocumentFileName(
        documentTitle,
        endorsement.endorsementNumber,
        placement.reference,
        focusedReinsurerName ?? undefined,
      )}
      qrValue={`${endorsement.endorsementNumber}:${endorsement.id}:PREVIEW`}
      onPrint={() => {}}
      onClose={onClose}
    >
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
        {previewNotice}
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

      {(focusedParticipant || focusedRecipient) && (
        <>
          <SectionHeading>Market Recipient</SectionHeading>
          <InfoRows
            rows={[
              {
                label: 'Reinsurer',
                value:
                  focusedRecipient?.name ??
                  focusedParticipant?.counterparty?.name ??
                  focusedParticipant?.counterpartyId ??
                  '—',
              },
              {
                label: 'Relationship',
                value:
                  focusedRecipient?.relationship ??
                  (focusedParticipant?.originalParticipantId
                    ? 'Existing placement participant reviewing revised terms'
                    : 'New endorsement participant reviewing current endorsed risk'),
              },
              {
                label: 'Offered / Revised Line',
                value: fmtPct(
                  focusedRecipient?.offeredLinePercent ??
                    focusedParticipant?.signedLinePercent ??
                    focusedParticipant?.sharePercent,
                ),
              },
              {
                label: 'Response Status',
                value: focusedRecipient?.status ?? focusedParticipant?.status ?? '—',
              },
            ]}
          />
        </>
      )}

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
