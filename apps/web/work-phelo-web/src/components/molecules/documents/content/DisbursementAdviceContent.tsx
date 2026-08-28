'use client';

import { Facultative, PlacementPayment } from '@/types/reinsurance';
import { useReinsurers } from '@/hooks';
import { placementDetailEntries } from '@/lib/reinsurance/placementFormDetails';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import {
  DocumentAmountTable,
  DocumentContentFrame,
  DocumentSignature,
} from '@/components/molecules/documents/DocumentContentFrame';

interface Row {
  label: string;
  pct?: string;
  value?: string;
  bold?: boolean;
}

function fmtFieldValue(val: unknown): string {
  if (val == null || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number | null | undefined, currency: string | null | undefined): string {
  if (val == null || Number.isNaN(val)) return '—';
  return `${currency ?? ''} ${val.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`.trim();
}

function longToday(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export interface DisbursementAdviceContentProps {
  placement: Facultative;
  payment: PlacementPayment;
}

/** The reinsurer-facing disbursement advice — the "Closings" letter stripped to
 *  the date, the address and the details table. For REINSURER_DISBURSEMENT
 *  payments only. Content only; the signatory block is fixed branding. */
export function DisbursementAdviceContent({ placement, payment }: DisbursementAdviceContentProps) {
  const { data: reinsurers = [] } = useReinsurers();
  const reinsurer = reinsurers.find((r) => r.id === payment.counterparty.id);
  const addr = reinsurer?.addresses?.find((a) => a.isPrimary) ?? reinsurer?.addresses?.[0];
  const reinsurerCity = addr?.city ?? null;
  const reinsurerRegionCountry = [addr?.state, addr?.country].filter(Boolean).join(' - ') || null;

  const {
    currency: placementCurrency,
    facultativeOffer,
    premium,
    commission,
    sumInsured,
    classOfBusiness,
    title,
    policyNumber,
    inceptionDate,
    expiryDate,
    cedant,
    businessDetails,
    offerDetails,
  } = placement;

  const currency = payment.currency ?? placementCurrency;
  const facOffer = facultativeOffer ?? 0;
  const facSumInsured = sumInsured != null ? (facOffer / 100) * sumInsured : null;
  const facPremium = premium != null ? (facOffer / 100) * premium : null;
  const commissionAmt = facPremium != null ? ((commission ?? 0) / 100) * facPremium : null;
  const paidAmount = parseFloat(payment.amount);

  const isCheque =
    payment.settlementMethod === 'CHEQUE' || (payment.notes ?? '').startsWith('Cheque payment');
  const refParts = (payment.reference ?? '').split(' — ').filter(Boolean);
  const chequeNumber = isCheque ? (refParts[0] ?? null) : null;
  const bankName = isCheque ? (refParts[1] ?? null) : (refParts[0] ?? null);

  const methodPhrase = isCheque
    ? `by cheque${chequeNumber ? ` no. ${chequeNumber}` : ''}${
        bankName ? ` drawn on ${bankName}` : ''
      } dated ${fmtDate(payment.paymentDate)}`
    : `by bank transfer${bankName ? ` through ${bankName}` : ''} on the ${fmtDate(payment.paymentDate)}`;

  const paymentSentence = `We have disbursed a payment of ${fmtAmount(
    paidAmount,
    payment.currency,
  )} ${methodPhrase}.`;

  const riskDetailRows: Row[] = [
    ...placementDetailEntries(businessDetails),
    ...placementDetailEntries(offerDetails),
  ].map((entry) => ({ label: entry.label, value: fmtFieldValue(entry.value) }));

  const descriptionRows: Row[] = [
    { label: 'Reinsured', value: cedant.name },
    { label: 'Insured', value: title ?? '—' },
    { label: 'Policy Number', value: displayPolicyNumber(policyNumber) },
    { label: 'Class of Insurance', value: classOfBusiness ?? '—' },
    ...riskDetailRows,
    { label: 'Period of Insurance', value: `${fmtDate(inceptionDate)} – ${fmtDate(expiryDate)}` },
    { label: 'Currency', value: currency ?? '—' },
  ];

  const financialRows: Row[] = [
    { label: 'Your Share', pct: `${facOffer}%` },
    { label: 'Your Sum Insured', value: fmtAmount(facSumInsured, currency) },
    { label: 'Your Premium', value: fmtAmount(facPremium, currency) },
    {
      label: 'Less Commission',
      pct: `${commission ?? 0}%`,
      value: fmtAmount(commissionAmt, currency),
    },
    { label: 'Net Premium', value: fmtAmount(paidAmount, payment.currency), bold: true },
  ];

  return (
    <DocumentContentFrame title="Disbursement Advice" showTitle={false}>
      <div
        className="flex flex-col gap-[0.3em]"
        style={{ fontFamily: 'var(--doc-font-content)', marginBottom: 'var(--doc-space-section)' }}
      >
        <p className="text-gray-500">{longToday()}</p>
        <p className="mt-[1em] text-gray-900">The Managing Director</p>
        <p className="text-gray-800">{payment.counterparty.name}</p>
        {reinsurerCity && <p className="text-gray-600">{reinsurerCity}</p>}
        {reinsurerRegionCountry && <p className="text-gray-600">{reinsurerRegionCountry}</p>}
      </div>

      <p
        className="text-center font-semibold text-gray-900 underline"
        style={{
          fontFamily: 'var(--doc-font-header)',
          marginBottom: 'var(--doc-space-section)',
        }}
      >
        PAYMENT ADVICE
      </p>

      <DocumentAmountTable rows={[...descriptionRows, ...financialRows]} />

      <p
        className="text-gray-800"
        style={{ fontFamily: 'var(--doc-font-content)', marginTop: 'var(--doc-space-section)' }}
      >
        {paymentSentence}
      </p>

      <div
        className="flex flex-col gap-[0.2em] text-gray-700"
        style={{ fontFamily: 'var(--doc-font-content)', marginTop: 'var(--doc-space-section)' }}
      >
        <p>Thank You.</p>
        <p>Yours faithfully,</p>
        <DocumentSignature />
      </div>
    </DocumentContentFrame>
  );
}
