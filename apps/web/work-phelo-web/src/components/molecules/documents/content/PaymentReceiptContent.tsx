'use client';

import { Facultative, PlacementPayment } from '@/types/reinsurance';
import { useCedants, useReinsurers } from '@/hooks';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import {
  DocumentContentFrame,
  DocumentField,
  DocumentIssueHeader,
} from '@/components/molecules/documents/DocumentContentFrame';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(
  val: number | string | null | undefined,
  currency: string | null | undefined,
): string {
  if (val == null) return '—';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (Number.isNaN(n)) return '—';
  return `${currency ?? ''} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`.trim();
}

const groupLabelStyle = {
  fontFamily: 'var(--doc-font-content)',
  marginTop: 'var(--doc-space-section)',
} as const;

export interface PaymentReceiptContentProps {
  placement: Facultative;
  payment: PlacementPayment;
}

/** The payment receipt — content only, rendered with the shared document type
 *  system. The signatory block is supplied by the page template. */
export function PaymentReceiptContent({ placement, payment }: PaymentReceiptContentProps) {
  const { data: cedants = [] } = useCedants();
  const { data: reinsurers = [] } = useReinsurers();

  const isDisbursement = payment.type === 'REINSURER_DISBURSEMENT';

  const {
    currency,
    facultativeOffer,
    premium,
    commission,
    classOfBusiness,
    title,
    policyNumber,
    inceptionDate,
    expiryDate,
    cedant,
  } = placement;

  const fullCedant = cedants.find((c) => c.id === cedant.id);
  const cedantAddress =
    fullCedant?.addresses?.find((a) => a.isPrimary) ?? fullCedant?.addresses?.[0];
  const cedantLocation = cedantAddress
    ? [cedantAddress.city, cedantAddress.state, cedantAddress.country].filter(Boolean).join(', ')
    : null;

  const reinsurer = reinsurers.find((r) => r.id === payment.counterparty.id);
  const reinsurerAddress =
    reinsurer?.addresses?.find((a) => a.isPrimary) ?? reinsurer?.addresses?.[0];
  const reinsurerLocation = reinsurerAddress
    ? [reinsurerAddress.city, reinsurerAddress.state, reinsurerAddress.country]
        .filter(Boolean)
        .join(', ')
    : null;

  const partyName = isDisbursement ? payment.counterparty.name : cedant.name;
  const partyLocation = isDisbursement ? reinsurerLocation : cedantLocation;

  const facOffer = facultativeOffer ?? 0;
  const facPremium = premium != null ? (facOffer / 100) * premium : null;
  const commissionAmt = facPremium != null ? ((commission ?? 0) / 100) * facPremium : null;
  const netPremium =
    facPremium != null && commissionAmt != null ? facPremium - commissionAmt : null;

  const isCheque = payment.notes === 'Cheque payment';
  const refParts = (payment.reference ?? '').split(' — ');
  const chequeNumber = isCheque ? refParts[0] || null : null;
  const bankName = isCheque ? (refParts[1] ?? refParts[0] ?? null) : (refParts[0] ?? null);

  const paidAmount = parseFloat(payment.amount);
  const disbursementClosingNet =
    payment.closing?.netPremium ?? payment.endorsementClosing?.netPremium;
  const comparableNet = isDisbursement
    ? disbursementClosingNet != null
      ? parseFloat(disbursementClosingNet)
      : null
    : netPremium;
  const being =
    comparableNet != null && !Number.isNaN(comparableNet) && paidAmount >= comparableNet
      ? 'Full Payment'
      : 'Partial Payment';

  const clientRows = [
    { label: isDisbursement ? 'Paid To' : 'Received From', value: partyName },
    { label: 'Amount', value: fmtAmount(payment.amount, payment.currency) },
    { label: 'Being', value: being },
  ];

  const paymentRows = [
    { label: 'Payment Type', value: isCheque ? 'Cheque' : 'Bank Transfer' },
    ...(isCheque && chequeNumber ? [{ label: 'Cheque Number', value: chequeNumber }] : []),
    ...(bankName ? [{ label: 'Bank Name', value: bankName }] : []),
    { label: isCheque ? 'Date on Cheque' : 'Payment Date', value: fmtDate(payment.paymentDate) },
  ];

  const descriptionRows = [
    { label: 'Reinsured', value: cedant.name },
    { label: 'Policy Type', value: classOfBusiness ?? '—' },
    { label: 'Insured', value: title ?? '—' },
    { label: 'Policy Number', value: displayPolicyNumber(policyNumber) },
    { label: 'Policy Period', value: `${fmtDate(inceptionDate)} – ${fmtDate(expiryDate)}` },
    { label: 'Currency', value: currency ?? '—' },
  ];

  const particularsRows: { label: string; value: string; bold?: boolean }[] = [
    { label: '100% Gross Premium', value: fmtAmount(premium, currency) },
    { label: `${facOffer}% Facultative Share`, value: fmtAmount(facPremium, currency) },
    {
      label: `Less Commission ${commission ?? 0}%`,
      value: commissionAmt != null ? fmtAmount(commissionAmt, currency) : '—',
    },
    {
      label: `Net Premium Received by ${isDisbursement ? partyName : 'iRisk Re'}`,
      value: fmtAmount(payment.amount, payment.currency),
      bold: true,
    },
  ];

  return (
    <DocumentContentFrame title="Payment Receipt">
      <DocumentIssueHeader
        referenceLabel="Receipt No."
        reference={payment.reference ?? displayPolicyNumber(policyNumber)}
        date={fmtDate(payment.paymentDate)}
        partyLabel="Receipt To"
        partyName={partyName}
        partyLocation={partyLocation}
      />

      <p className="font-semibold text-gray-500" style={groupLabelStyle}>
        Client Details
      </p>
      {clientRows.map((row) => (
        <DocumentField key={row.label} label={row.label} value={row.value} />
      ))}

      <p className="font-semibold text-gray-500" style={groupLabelStyle}>
        Payment Details
      </p>
      {paymentRows.map((row) => (
        <DocumentField key={row.label} label={row.label} value={row.value} />
      ))}

      <p className="font-semibold text-gray-500" style={groupLabelStyle}>
        Risk Description
      </p>
      {descriptionRows.map((row) => (
        <DocumentField key={row.label} label={row.label} value={row.value} />
      ))}

      <p className="font-semibold text-gray-500" style={groupLabelStyle}>
        Payment Particulars
      </p>
      {particularsRows.map((row) => (
        <DocumentField key={row.label} label={row.label} value={row.value} strong={row.bold} />
      ))}

      <p
        className="text-center italic text-gray-600"
        style={{ fontFamily: 'var(--doc-font-content)', marginTop: 'var(--doc-space-section)' }}
      >
        Thank you for your payment!
      </p>
    </DocumentContentFrame>
  );
}
