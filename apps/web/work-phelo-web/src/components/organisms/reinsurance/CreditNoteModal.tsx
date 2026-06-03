'use client';

import { DocumentPreviewModal } from '@/components/organisms/reinsurance/DocumentPreviewModal';
import { Facultative } from '@/types/reinsurance';

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
  nicLevyPct = 0,
  withholdingTaxPct = 0,
  onPrint,
  onClose,
}: CreditNoteModalProps) {
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
  } = placement;

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
