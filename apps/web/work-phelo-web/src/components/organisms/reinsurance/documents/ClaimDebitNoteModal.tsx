'use client';

import Image from 'next/image';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import {
  Facultative,
  PlacementClaim,
  PlacementClaimAllocation,
  PlacementParticipant,
} from '@/types/reinsurance';
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
  claim?: PlacementClaim;
  claimAmount?: number | null;
  /** Confirmed-closing-snapshot allocation for this reinsurer, when one exists — carries the
   * endorsement-adjusted share/amount, which can differ from the live participant record. */
  allocation?: PlacementClaimAllocation;
  /** 'claim' (default) is the existing invoice-style Claim Debit Note. 'notification' is the
   * Notification stage's advice letter — same underlying data, different document entirely. */
  mode?: 'claim' | 'notification';
  onPrint: () => void;
  onClose: () => void;
}

export function ClaimDebitNoteModal({
  isOpen,
  placement,
  participant,
  claim,
  claimAmount,
  allocation,
  mode = 'claim',
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

  // Prefer the allocation — a confirmed-closing snapshot that already folds in any endorsement
  // adjustments — over the live participant record, which can drift from what was actually
  // allocated once an endorsement has since changed the reinsurer's share.
  const sharePercent = allocation
    ? parseFloat(allocation.signedLinePercent)
    : parseFloat(participant.sharePercent ?? '0');
  const amountDue = allocation
    ? parseFloat(allocation.allocatedFinalLossAmount ?? allocation.allocatedEstimatedLossAmount)
    : claimAmount != null
      ? (sharePercent / 100) * claimAmount
      : null;

  const isNotification = mode === 'notification';
  const documentLabel = isNotification ? 'Claim Notification' : 'Claim Debit Note';

  const signatureBlock = (
    <>
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
    </>
  );

  const claimDebitNoteAfterContent = (
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
      {signatureBlock}
    </div>
  );

  // Same signatory as the Claim Debit Note, plus the letterhead/company block and disclaimer
  // the notification template calls for underneath it.
  const notificationAfterContent = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        fontSize: '14px',
        color: '#374151',
      }}
    >
      <p style={{ margin: 0 }}>Yours faithfully,</p>
      {signatureBlock}

      <div
        style={{
          borderTop: '1px solid #e5e7eb',
          marginTop: '16px',
          paddingTop: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, fontWeight: 700, color: '#111827' }}>
          iRisk Reinsurance Brokers Limited
        </p>
        <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
          No. D17 Boundary Road, Near Kaiser Kitchen Appliances, East Legon, Accra | P. O. Box
          MD2671, Madina - Accra | Tel: +233 (501) 605 643 / +233 (246) 923 436
        </p>
        <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>
          This notification does not constitute an admission of liability or confirmation of
          coverage.
        </p>
      </div>
    </div>
  );

  const claimDebitNoteContent = (
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

          {/* Claim amount*/}
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
            <td className="py-2.5 px-4 font-semibold text-gray-900 w-1/2">Amount Due from you:</td>
            <td className="py-2.5 px-4 text-right font-bold text-gray-900">
              {amountDue != null ? fmtNum(amountDue) : '—'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const notificationContent = (
    <div className="flex flex-col gap-4 text-base">
      <div className="flex flex-col gap-0.5 mb-2">
        <p className="font-medium text-gray-900">{participant.counterparty.name}</p>
        {addr?.line1 && <p className="text-gray-700">{addr.line1}</p>}
        {addr?.line2 && <p className="text-gray-700">{addr.line2}</p>}
        {(addr?.city || addr?.country) && (
          <p className="text-gray-700">{[addr?.city, addr?.country].filter(Boolean).join(', ')}</p>
        )}

        <p className="text-gray-500 mt-3">
          Date:{' '}
          {new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </p>

        <p className="font-semibold text-gray-900 mt-3">
          RE: CLAIM NOTIFICATION – {title ?? '—'} – {cedant.name} – {classOfBusiness ?? '—'}
        </p>

        <p className="font-medium text-gray-900 mt-3">Dear Sirs,</p>
        <p className="text-gray-700 mt-3 leading-relaxed">
          We hereby notify you of a claim under the above risk, which may give rise to a recovery
          under the applicable reinsurance arrangement.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        {[
          { label: 'Name of Insured', value: title ?? '—' },
          { label: 'Cedant', value: cedant.name },
          { label: 'Risk Class', value: classOfBusiness ?? '—' },
          { label: 'Policy No.', value: displayPolicyNumber(policyNumber) },
          { label: 'Claim No.', value: claim?.claimNumber ?? '—' },
          { label: 'Date of Loss', value: fmtDate(claim?.occurrenceDate) },
          { label: 'Nature of Loss', value: claim?.claimCause ?? '—' },
          { label: 'Estimated Gross Loss', value: fmtAmount(claimAmount, currency) },
          { label: 'Estimated Reinsurance Exposure', value: fmtAmount(amountDue, currency) },
        ].map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <span className="text-gray-600">{row.label}:</span>
            <span className="font-medium text-gray-900 text-right">{row.value}</span>
          </div>
        ))}
      </div>

      <p className="text-gray-700 leading-relaxed">
        Kindly acknowledge receipt of this notification. Further information will be provided as it
        becomes available.
      </p>
      <p className="text-gray-700 leading-relaxed">
        This notification is made without prejudice and subject to the terms and conditions of the
        applicable reinsurance contract.
      </p>
    </div>
  );

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`${documentLabel} — ${displayPolicyNumber(policyNumber)}`}
      documentTitle={documentLabel}
      fileName={buildDocumentFileName(
        documentLabel,
        displayPolicyNumber(policyNumber),
        riskTypeName,
        title,
        `to ${participant.counterparty.name}`,
      )}
      onPrint={onPrint}
      onClose={onClose}
      afterContent={isNotification ? notificationAfterContent : claimDebitNoteAfterContent}
    >
      {isNotification ? notificationContent : claimDebitNoteContent}
    </DocumentPreviewModal>
  );
}
