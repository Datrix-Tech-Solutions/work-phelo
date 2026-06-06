'use client';

import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { Facultative } from '@/types/reinsurance';
import { useReinsurers } from '@/hooks';

function toLabel(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtFieldValue(val: unknown): string {
  if (val == null) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number | null, currency: string | null) {
  if (val == null) return '—';
  return `${currency ?? ''} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

interface CreditNoteRow {
  label: string;
  pct?: string;
  value?: string;
  bold?: boolean;
  divider?: boolean;
}

interface CreditNoteModalProps {
  isOpen: boolean;
  placement: Facultative;
  sharePercent: number;
  brokerageFee: number;
  counterpartyId: string;
  reinsurerCompany: string;
  nicLevyPct?: number;
  withholdingTaxPct?: number;
  onPrint: () => void;
  onClose: () => void;
}

export function CreditNoteModal({
  isOpen,
  placement,
  sharePercent,
  brokerageFee,
  counterpartyId,
  reinsurerCompany,
  nicLevyPct = 0,
  withholdingTaxPct = 0,
  onPrint,
  onClose,
}: CreditNoteModalProps) {
  const { data: reinsurers = [] } = useReinsurers();
  const reinsurer = reinsurers.find((r) => r.id === counterpartyId);
  const addr = reinsurer?.addresses?.find((a) => a.isPrimary) ?? reinsurer?.addresses?.[0];
  const reinsurerCity = addr?.city ?? null;
  const reinsurerRegionCountry = [addr?.state, addr?.country].filter(Boolean).join(' - ') || null;
  const {
    currency,
    sumInsured,
    premium,
    commission,
    classOfBusiness,
    title,
    reference,
    inceptionDate,
    expiryDate,
    cedant,
    businessDetails,
    offerDetails,
  } = placement;

  const riskDetailRows: CreditNoteRow[] = [
    ...Object.entries(businessDetails ?? {}),
    ...Object.entries(offerDetails ?? {}),
  ].map(([key, val]) => ({ label: toLabel(key), value: fmtFieldValue(val) }));

  const yourSumInsured = sumInsured != null ? (sharePercent / 100) * sumInsured : null;
  const yourPremium = premium != null ? (sharePercent / 100) * premium : null;
  const totalCommissionPct = (commission ?? 0) + brokerageFee;
  const commissionAmt = yourPremium != null ? (totalCommissionPct / 100) * yourPremium : null;
  const nicLevyAmt = yourPremium != null ? (nicLevyPct / 100) * yourPremium : 0;
  const withholdingTaxAmt = yourPremium != null ? (withholdingTaxPct / 100) * yourPremium : 0;
  const netPremium =
    yourPremium != null && commissionAmt != null
      ? yourPremium - commissionAmt - nicLevyAmt - withholdingTaxAmt
      : null;

  const rows: CreditNoteRow[] = [
    { label: 'Reinsured', value: cedant.name },
    { label: 'Insured', value: title },
    { label: 'Policy Number', value: reference },
    { label: 'Class of Insurance', value: classOfBusiness ?? '—' },
    ...riskDetailRows,
    {
      label: 'Period of Insurance',
      value: `${fmtDate(inceptionDate)} – ${fmtDate(expiryDate)}`,
    },
    { label: 'Currency', value: currency ?? '—' },
    { label: '', divider: true },
    { label: 'Total Sum Insured', value: fmtAmount(sumInsured, currency) },
    { label: 'Total Premium', value: fmtAmount(premium, currency) },
    { label: 'Your Share', pct: `${sharePercent}%` },
    { label: 'Your Sum Insured', value: fmtAmount(yourSumInsured, currency) },
    { label: 'Your Premium', value: fmtAmount(yourPremium, currency) },
    {
      label: 'Less Commission',
      pct: `${totalCommissionPct}%`,
      value: fmtAmount(commissionAmt, currency),
    },
    {
      label: 'NIC Levy',
      pct: `${nicLevyPct}%`,
      value: fmtAmount(nicLevyAmt, currency),
    },
    {
      label: 'Withholding Tax',
      pct: `${withholdingTaxPct}%`,
      value: fmtAmount(withholdingTaxAmt, currency),
    },
    { label: '', divider: true },
    { label: 'Net Premium', value: fmtAmount(netPremium, currency), bold: true },
  ];

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`Credit Note — ${reference}`}
      documentTitle="Credit Note"
      onPrint={onPrint}
      onClose={onClose}
    >
      {/* Address block */}
      <div className="flex flex-col gap-0.5 text-sm mb-4">
        <p className="text-gray-500">
          {new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </p>
        <p className="font-medium text-gray-900 mt-2">The Managing Director</p>
        <p className="text-gray-800">{reinsurerCompany}</p>
        {reinsurerCity && <p className="text-gray-600">{reinsurerCity}</p>}
        {reinsurerRegionCountry && <p className="text-gray-600">{reinsurerRegionCountry}</p>}
        <p className="font-medium text-gray-900 mt-2">Dear Sir/Madam</p>
      </div>

      <table className="w-full text-sm border-collapse">
        <tbody>
          {rows.map((row, i) =>
            row.divider ? (
              <tr key={i}>
                <td colSpan={3} className="py-1">
                  <hr className="border-gray-100" />
                </td>
              </tr>
            ) : (
              <tr key={i} className="border-b border-gray-50 last:border-0">
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
    </DocumentPreviewModal>
  );
}
