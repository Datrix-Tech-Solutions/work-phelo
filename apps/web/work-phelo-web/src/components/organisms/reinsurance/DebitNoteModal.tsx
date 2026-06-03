'use client';

import { DocumentPreviewModal } from '@/components/organisms/reinsurance/DocumentPreviewModal';
import { Facultative } from '@/types/reinsurance';
import { useCedants } from '@/hooks';

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

function today() {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface DebitNoteModalProps {
  isOpen: boolean;
  placement: Facultative;
  onPrint: () => void;
  onClose: () => void;
}

export function DebitNoteModal({ isOpen, placement, onPrint, onClose }: DebitNoteModalProps) {
  const { data: cedants = [] } = useCedants();

  const {
    currency,
    facultativeOffer,
    premium,
    commission,
    classOfBusiness,
    title,
    reference,
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

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`Debit Note — ${reference}`}
      documentTitle="Debit Note"
      onPrint={onPrint}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4 text-sm">
        {/* Debit No / Date row */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs text-gray-400 uppercase tracking-wide">Debit No.</span>
            <p className="font-semibold text-gray-900">{reference}</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Date</span>
            <p className="font-semibold text-gray-900">{today()}</p>
          </div>
        </div>

        {/* Bill To */}
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Bill To</span>
          <p className="font-semibold text-gray-900">{cedant.name}</p>
          {cedantLocation && <p className="text-gray-500">{cedantLocation}</p>}
        </div>

        {/* Table */}
        <table className="w-full border-collapse border border-gray-200 rounded-lg overflow-hidden text-sm">
          <tbody>
            {/* Description heading */}
            <tr className="bg-gray-50">
              <td
                colSpan={2}
                className="py-2 px-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-200"
              >
                Description
              </td>
            </tr>

            {[
              { label: 'Reinsured', value: cedant.name },
              { label: 'Policy Type', value: classOfBusiness ?? '—' },
              { label: 'Insured', value: title },
              { label: 'Policy Number', value: reference },
              {
                label: 'Policy Period',
                value: `${fmtDate(inceptionDate)} – ${fmtDate(expiryDate)}`,
              },
              { label: 'Currency', value: currency ?? '—' },
            ].map((row) => (
              <tr key={row.label} className="border-b border-gray-100 last:border-b-0">
                <td className="py-2 px-4 text-gray-500 w-1/2">{row.label}</td>
                <td className="py-2 px-4 text-right font-medium text-gray-900">{row.value}</td>
              </tr>
            ))}

            {/* Particulars heading */}
            <tr className="bg-gray-50">
              <td
                colSpan={2}
                className="py-2 px-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide border-y border-gray-200"
              >
                Particulars
              </td>
            </tr>

            {[
              { label: '100% Gross Premium', value: fmtAmount(premium, currency) },
              {
                label: `${facOffer}% Facultative Share`,
                value: fmtAmount(facPremium, currency),
              },
              {
                label: `Less Commission ${commission ?? 0}%`,
                value: commissionAmt != null ? fmtAmount(commissionAmt, currency) : '—',
              },
              {
                label: 'Net Premium Due iRisk Re',
                value: fmtAmount(netPremium, currency),
                bold: true,
              },
            ].map((row) => (
              <tr key={row.label} className="border-b border-gray-100 last:border-b-0">
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
    </DocumentPreviewModal>
  );
}
