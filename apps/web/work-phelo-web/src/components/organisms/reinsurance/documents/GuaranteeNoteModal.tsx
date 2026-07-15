'use client';

import Image from 'next/image';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { DetailField } from '@/components/atoms/DetailField';
import { Facultative } from '@/types/reinsurance';
import { useReinsurers, useCedants, useRiskTypes } from '@/hooks';
import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';

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

interface GuaranteeNoteModalProps {
  isOpen: boolean;
  placement: Facultative;
  counterpartyId: string;
  reinsurerCompany: string;
  onPrint: () => void;
  onClose: () => void;
}

export function GuaranteeNoteModal({
  isOpen,
  placement,
  counterpartyId,
  reinsurerCompany,
  onPrint,
  onClose,
}: GuaranteeNoteModalProps) {
  const { data: reinsurers = [] } = useReinsurers();
  const { data: cedants = [] } = useCedants();
  const { data: riskTypes = [] } = useRiskTypes();

  const reinsurer = reinsurers.find((r) => r.id === counterpartyId);
  const reinsurerAddr = reinsurer?.addresses?.find((a) => a.isPrimary) ?? reinsurer?.addresses?.[0];

  const fullCedant = cedants.find((c) => c.id === placement.cedant.id);
  const cedantAddr = fullCedant?.addresses?.find((a) => a.isPrimary) ?? fullCedant?.addresses?.[0];

  const displayName = reinsurerCompany || placement.cedant.name;
  const displayCity = reinsurerAddr?.city ?? cedantAddr?.city ?? null;
  const displayRegionCountry =
    [reinsurerAddr?.state, reinsurerAddr?.country].filter(Boolean).join(' - ') ||
    [cedantAddr?.state, cedantAddr?.country].filter(Boolean).join(' - ') ||
    null;
  const {
    currency,
    facultativeOffer,
    sumInsured,
    premium,
    commission,
    classOfBusiness,
    title,
    reference,
    policyNumber,
    inceptionDate,
    expiryDate,
    cedant,
    participants,
    riskTypeId,
  } = placement;

  const riskTypeName = riskTypes.find((rt) => rt.id === riskTypeId)?.name ?? null;

  const facOffer = facultativeOffer ?? 0;
  const facSumInsured = sumInsured != null ? (facOffer / 100) * sumInsured : null;
  const facPremium = premium != null ? (facOffer / 100) * premium : null;
  const commissionAmount = facPremium != null ? ((commission ?? 0) / 100) * facPremium : null;
  const netPremium =
    facPremium != null && commissionAmount != null ? facPremium - commissionAmount : null;

  const participantRows = participants.filter(
    (p) =>
      (p.role === 'REINSURER' || p.role === 'LEAD_REINSURER' || p.role === 'CO_REINSURER') &&
      parseFloat(p.sharePercent ?? '0') > 0,
  );

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`Guarantee Note — ${reference}`}
      documentTitle="Guarantee Note"
      fileName={buildDocumentFileName(
        'Guarantee Note',
        policyNumber ?? reference,
        riskTypeName,
        title,
      )}
      afterContent={
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
            width={160}
            height={80}
            style={{ objectFit: 'contain', marginTop: '8px', marginBottom: '4px' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <p style={{ margin: 0, fontWeight: 700, color: '#111827' }}>Nana Yaa Savage-Mensah</p>
            <p style={{ margin: 0, fontWeight: 700, color: '#111827' }}>Managing Director (AG)</p>
          </div>
        </div>
      }
      onPrint={onPrint}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        {/* Address block */}
        <div className="flex flex-col gap-0.5 text-sm mb-2">
          <p className="text-gray-500">
            {new Date().toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <p className="font-medium text-gray-900 mt-2">The Managing Director</p>
          <p className="text-gray-800">{displayName}</p>
          {displayCity && <p className="text-gray-600">{displayCity}</p>}
          {displayRegionCountry && <p className="text-gray-600">{displayRegionCountry}</p>}
          <p className="font-medium text-gray-900 mt-2">Dear Sir/Madam</p>
        </div>

        <hr className="border-gray-100 mb-1" />

        {/* Section heading */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-1">
          Policy Details &amp; Risk Description
        </p>

        <DetailField inline label="Cover Type" value={classOfBusiness ?? '—'} />
        <DetailField inline label="Reinsured" value={cedant.name} />
        <DetailField inline label="Policy Number" value={reference} />
        <DetailField inline label="Original Insured" value={title} />
        <DetailField inline label="Currency" value={currency ?? '—'} />
        <DetailField
          inline
          label="Insurance Period"
          value={`${fmtDate(inceptionDate)} – ${fmtDate(expiryDate)}`}
        />

        <hr className="border-gray-100 my-1" />

        <DetailField inline label="Sum Insured" value={fmtAmount(sumInsured, currency)} />
        <DetailField inline label="Premium" value={fmtAmount(premium, currency)} />
        <DetailField
          inline
          label="Facultative (Offer)"
          value={
            facSumInsured != null
              ? `${fmtAmount(facSumInsured, currency)} (${facOffer}% of 100%)`
              : '—'
          }
        />
        <DetailField inline label="Facultative Premium" value={fmtAmount(facPremium, currency)} />
        <DetailField inline label="Commission" value={fmtAmount(commissionAmount, currency)} />

        <hr className="border-gray-100 my-1" />

        <DetailField inline label="Net Premium" value={fmtAmount(netPremium, currency)} />

        <hr className="border-gray-100 my-2" />

        {/* Participants */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Reinsurance Participant(s)
        </p>

        {participantRows.length === 0 ? (
          <p className="text-sm text-gray-400">No participants assigned.</p>
        ) : (
          participantRows.map((p) => (
            <DetailField
              key={p.id}
              inline
              label={p.counterparty.name}
              value={`${parseFloat(p.sharePercent ?? '0')}% of 100%`}
            />
          ))
        )}
      </div>
    </DocumentPreviewModal>
  );
}
