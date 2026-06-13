'use client';

import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { Facultative, PlacementPayment } from '@/types/reinsurance';
import { useCedants } from '@/hooks';

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number | string | null | undefined, currency: string | null | undefined) {
  if (val == null) return '—';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return '—';
  return `${currency ?? ''} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr className="bg-blue-900">
      <td
        colSpan={2}
        className="py-2 px-4 text-center text-xs font-semibold text-gray-100 uppercase tracking-wide border-b border-blue-900"
      >
        {label}
      </td>
    </tr>
  );
}

function TableRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr className="border-b border-gray-100 last:border-b-0">
      <td className={`py-2 px-4 w-1/2 ${bold ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
        {label}
      </td>
      <td
        className={`py-2 px-4 text-right ${bold ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}
      >
        {value}
      </td>
    </tr>
  );
}

interface PaymentReceiptModalProps {
  isOpen: boolean;
  placement: Facultative;
  payment: PlacementPayment;
  onPrint: () => void;
  onClose: () => void;
}

export function PaymentReceiptModal({
  isOpen,
  placement,
  payment,
  onPrint,
  onClose,
}: PaymentReceiptModalProps) {
  const { data: cedants = [] } = useCedants();

  const {
    currency,
    facultativeOffer,
    premium,
    commission,
    classOfBusiness,
    title,
    reference,
    policyNumber,
    inceptionDate,
    expiryDate,
    cedant,
  } = placement;

  const fullCedant = cedants.find((c) => c.id === cedant.id);
  const primaryAddress =
    fullCedant?.addresses?.find((a) => a.isPrimary) ?? fullCedant?.addresses?.[0];
  const cedantLocation = primaryAddress
    ? [primaryAddress.city, primaryAddress.state, primaryAddress.country].filter(Boolean).join(', ')
    : null;

  const facOffer = facultativeOffer ?? 0;
  const facPremium = premium != null ? (facOffer / 100) * premium : null;
  const commissionAmt = facPremium != null ? ((commission ?? 0) / 100) * facPremium : null;
  const netPremium =
    facPremium != null && commissionAmt != null ? facPremium - commissionAmt : null;

  // Decode payment method from stored notes/reference
  const isCheque = payment.notes === 'Cheque payment';
  const refParts = (payment.reference ?? '').split(' — ');
  const chequeNumber = isCheque ? refParts[0] || null : null;
  const bankName = isCheque ? (refParts[1] ?? refParts[0] ?? null) : (refParts[0] ?? null);

  const paidAmount = parseFloat(payment.amount);
  const being = netPremium != null && paidAmount >= netPremium ? 'Full Payment' : 'Partial Payment';

  const afterContent = (
    <div className="mt-10 flex flex-col gap-6 border-t border-gray-200 pt-6">
      <p className="text-sm text-gray-700 italic text-center">Thank you for your payment!</p>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">Signature / Stamp</span>
        <div className="w-64 border-b border-gray-400 mt-20" />
      </div>
    </div>
  );

  const clientRows = [
    { label: 'Received From', value: cedant.name },
    { label: 'Amount', value: fmtAmount(payment.amount, payment.currency) },
    { label: 'Being', value: being },
  ];

  const paymentRows = [
    { label: 'Payment Type', value: isCheque ? 'Cheque' : 'Bank Transfer' },
    ...(isCheque && chequeNumber ? [{ label: 'Cheque Number', value: chequeNumber }] : []),
    ...(bankName ? [{ label: 'Bank Name', value: bankName }] : []),
    {
      label: isCheque ? 'Date on Cheque' : 'Payment Date',
      value: fmtDate(payment.paymentDate),
    },
  ];

  const descriptionRows = [
    { label: 'Reinsured', value: cedant.name },
    { label: 'Policy Type', value: classOfBusiness ?? '—' },
    { label: 'Insured', value: title ?? '—' },
    { label: 'Policy Number', value: policyNumber ?? reference ?? '—' },
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
      label: 'Net Premium Received by iRisk Re',
      value: fmtAmount(netPremium, currency),
      bold: true,
    },
  ];

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`Payment Receipt — ${reference}`}
      documentTitle="Payment Receipt"
      onPrint={onPrint}
      onClose={onClose}
      afterContent={afterContent}
    >
      <div className="flex flex-col gap-4 text-sm">
        {/* Receipt No. / Date */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs text-gray-400 uppercase tracking-wide">Receipt No.</span>
            <p className="font-semibold text-gray-900">{payment.reference ?? reference ?? '—'}</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Date</span>
            <p className="font-semibold text-gray-900">{fmtDate(payment.paymentDate)}</p>
          </div>
        </div>

        {/* Receipt To */}
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Receipt To</span>
          <p className="font-semibold text-gray-900">{cedant.name}</p>
          {cedantLocation && <p className="text-gray-500">{cedantLocation}</p>}
        </div>

        {/* Table */}
        <table className="w-full border-collapse border border-gray-200 overflow-hidden text-sm">
          <tbody>
            <SectionHeader label="Client Details" />
            {clientRows.map((row) => (
              <TableRow key={row.label} label={row.label} value={row.value} />
            ))}

            <SectionHeader label="Payment Details" />
            {paymentRows.map((row) => (
              <TableRow key={row.label} label={row.label} value={row.value} />
            ))}

            <SectionHeader label="Risk Description" />
            {descriptionRows.map((row) => (
              <TableRow key={row.label} label={row.label} value={row.value} />
            ))}

            <SectionHeader label="Payment Particulars" />
            {particularsRows.map((row) => (
              <TableRow key={row.label} label={row.label} value={row.value} bold={row.bold} />
            ))}
          </tbody>
        </table>
      </div>
    </DocumentPreviewModal>
  );
}
