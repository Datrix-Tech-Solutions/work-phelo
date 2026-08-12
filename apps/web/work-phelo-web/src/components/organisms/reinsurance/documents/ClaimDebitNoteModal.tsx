'use client';

import Image from 'next/image';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { Facultative, PlacementParticipant } from '@/types/reinsurance';
import { useReinsurers, useRiskTypes } from '@/hooks';
import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number | null | undefined, currency: string | null | undefined) {
  if (val == null) return '—';
  return `${currency ?? ''} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

function fmtNum(val: number) {
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface ClaimDebitNoteModalProps {
  isOpen: boolean;
  placement: Facultative;
  participant: PlacementParticipant;
  claimAmount?: number | null;
  onPrint: () => void;
  onClose: () => void;
}

export function ClaimDebitNoteModal({
  isOpen,
  placement,
  participant,
  claimAmount,
  onPrint,
  onClose,
}: ClaimDebitNoteModalProps) {
  const { data: reinsurers = [] } = useReinsurers();
  const { data: riskTypes = [] } = useRiskTypes();
  const reinsurer = reinsurers.find((r) => r.id === participant.counterpartyId);
  const addr = reinsurer?.addresses?.find((a) => a.isPrimary) ?? reinsurer?.addresses?.[0];
  const reinsurerCity = addr?.city ?? null;
  const reinsurerRegionCountry = [addr?.state, addr?.country].filter(Boolean).join(' - ') || null;

  const {
    currency,
    classOfBusiness,
    title,
    policyNumber,
    inceptionDate,
    expiryDate,
    cedant,
    riskTypeId,
  } = placement;

  const riskTypeName = riskTypes.find((rt) => rt.id === riskTypeId)?.name ?? null;

  const sharePercent = parseFloat(participant.sharePercent ?? '0');
  const amountDue = claimAmount != null ? (sharePercent / 100) * claimAmount : null;

  const afterContent = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        fontSize: '14px',
        color: '#374151',
      }}
    >
      <p style={{ margin: 0 }}>Thank You.</p>
      <p style={{ margin: 0 }}>Yours faithfully,</p>
      <Image
        src="/signature.png"
        alt="Signature"
        width={100}
        height={10}
        style={{ objectFit: 'contain', marginTop: '8px', marginBottom: '4px' }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <p style={{ margin: 0, fontWeight: 700, color: '#111827' }}>Nana Yaa Savage-Mensah</p>
        <p style={{ margin: 0, fontWeight: 700, color: '#111827' }}>Managing Director (AG)</p>
      </div>
    </div>
  );

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`Claim Debit Note — ${displayPolicyNumber(policyNumber)}`}
      documentTitle="Claim Debit Note"
      fileName={buildDocumentFileName(
        'Claim Debit Note',
        displayPolicyNumber(policyNumber),
        riskTypeName,
        title,
        `to ${participant.counterparty.name}`,
      )}
      onPrint={onPrint}
      onClose={onClose}
      afterContent={afterContent}
    >
      <div className="flex flex-col gap-4 text-base">
        {/* Address block */}
        <div className="flex flex-col gap-0.5 mb-2">
          <p className="text-gray-500">
            {new Date().toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <p className="font-medium text-gray-900 mt-2">The Managing Director</p>
          <p className="text-gray-800">{participant.counterparty.name}</p>
          {reinsurerCity && <p className="text-gray-600">{reinsurerCity}</p>}
          {reinsurerRegionCountry && <p className="text-gray-600">{reinsurerRegionCountry}</p>}
          <p className="font-medium text-gray-900 mt-2">Dear Sir/Madam</p>
          <p className="text-gray-700 mt-3 leading-relaxed">
            We refer to the risk below and wish to advise you of a claim under the above policy.
            Kindly remit the amount due in accordance with the information below.
          </p>
        </div>

        {/* Table */}
        <table className="w-full border-collapse border border-gray-200 overflow-hidden text-base">
          <tbody>
            {/* Description heading */}
            <tr className="bg-blue-900">
              <td
                colSpan={2}
                className="py-2 px-4 text-center text-sm font-semibold text-gray-100 uppercase tracking-wide border-b border-blue-900"
              >
                Description
              </td>
            </tr>

            {[
              { label: 'Reinsured', value: cedant.name },
              { label: 'Policy Type', value: classOfBusiness ?? '—' },
              { label: 'Insured', value: title ?? '—' },
              { label: 'Policy Number', value: displayPolicyNumber(policyNumber) },
              {
                label: 'Policy Period',
                value: `${fmtDate(inceptionDate)} – ${fmtDate(expiryDate)}`,
              },
              { label: 'Currency', value: currency ?? '—' },
            ].map((row) => (
              <tr key={row.label}>
                <td className="py-2 px-4 text-gray-500 w-1/2">{row.label}</td>
                <td className="py-2 px-4 text-right font-medium text-gray-900">{row.value}</td>
              </tr>
            ))}

            {/* Claim amount — blue header row (replaces Particulars heading) */}
            <tr className="bg-blue-900">
              <td className="py-2.5 px-4 font-semibold text-white w-1/2">Claim amount :</td>
              <td className="py-2.5 px-4 text-right font-bold text-white">
                {fmtAmount(claimAmount, currency)}
              </td>
            </tr>

            {/* Your reinsurance participation */}
            <tr>
              <td className="py-2.5 px-4 text-gray-600 w-1/2">Your reinsurance participation :</td>
              <td className="py-2.5 px-4 text-right text-gray-700">{sharePercent}% of 100%</td>
            </tr>

            {/* Amount Due */}
            <tr>
              <td className="py-2.5 px-4 font-semibold text-gray-900 w-1/2">
                Amount Due from you:
              </td>
              <td className="py-2.5 px-4 text-right font-bold text-gray-900">
                {amountDue != null ? fmtNum(amountDue) : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DocumentPreviewModal>
  );
}
