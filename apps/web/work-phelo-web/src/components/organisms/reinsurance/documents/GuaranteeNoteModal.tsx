'use client';

import Image from 'next/image';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { DetailField } from '@/components/atoms/DetailField';
import { Facultative } from '@/types/reinsurance';
import { useCedants, useRiskTypes } from '@/hooks';
import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

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
  /** Post-endorsement totals, when this placement has an endorsement in market. */
  facultativeOfferOverride?: number;
  sumInsuredOverride?: number | null;
  premiumOverride?: number | null;
  commissionOverride?: number | null;
  currencyOverride?: string | null;
  titleOverride?: string | null;
  policyNumberOverride?: string | null;
  inceptionDateOverride?: string | null;
  expiryDateOverride?: string | null;
  /** Post-endorsement share per reinsurer, keyed by counterpartyId. */
  participantShareOverrides?: Record<string, number>;
  effectiveParticipantOverrides?: Array<{
    id: string;
    counterpartyName: string;
    displaySharePercent: number;
  }>;
  onPrint: () => void;
  onClose: () => void;
}

export function GuaranteeNoteModal({
  isOpen,
  placement,
  facultativeOfferOverride,
  sumInsuredOverride,
  premiumOverride,
  commissionOverride,
  currencyOverride,
  titleOverride,
  policyNumberOverride,
  inceptionDateOverride,
  expiryDateOverride,
  participantShareOverrides,
  effectiveParticipantOverrides,
  onPrint,
  onClose,
}: GuaranteeNoteModalProps) {
  const { data: cedants = [] } = useCedants();
  const { data: riskTypes = [] } = useRiskTypes();

  const fullCedant = cedants.find((c) => c.id === placement.cedant.id);
  const cedantAddr = fullCedant?.addresses?.find((a) => a.isPrimary) ?? fullCedant?.addresses?.[0];

  const displayName = placement.cedant.name;
  const displayCity = cedantAddr?.city ?? null;
  const displayRegionCountry =
    [cedantAddr?.state, cedantAddr?.country].filter(Boolean).join(' - ') || null;
  const {
    currency,
    facultativeOffer,
    sumInsured,
    premium,
    commission,
    classOfBusiness,
    title,
    policyNumber,
    inceptionDate,
    expiryDate,
    cedant,
    participants,
    riskTypeId,
  } = placement;

  const riskTypeName = riskTypes.find((rt) => rt.id === riskTypeId)?.name ?? null;

  const facOffer = facultativeOfferOverride ?? facultativeOffer ?? 0;
  const effectiveSumInsured = sumInsuredOverride ?? sumInsured;
  const effectivePremium = premiumOverride ?? premium;
  const effectiveCommission = commissionOverride ?? commission;
  const effectiveCurrency = currencyOverride ?? currency;
  const effectiveTitle = titleOverride ?? title;
  const effectivePolicyNumber = policyNumberOverride ?? policyNumber;
  const effectiveInceptionDate = inceptionDateOverride ?? inceptionDate;
  const effectiveExpiryDate = expiryDateOverride ?? expiryDate;
  const facSumInsured = effectiveSumInsured != null ? (facOffer / 100) * effectiveSumInsured : null;
  const facPremium = effectivePremium != null ? (facOffer / 100) * effectivePremium : null;
  const commissionAmount =
    facPremium != null ? ((effectiveCommission ?? 0) / 100) * facPremium : null;
  const netPremium =
    facPremium != null && commissionAmount != null ? facPremium - commissionAmount : null;

  const participantRows =
    effectiveParticipantOverrides ??
    participants
      .filter(
        (p) =>
          (p.role === 'REINSURER' || p.role === 'LEAD_REINSURER' || p.role === 'CO_REINSURER') &&
          p.status === 'CLOSED' &&
          parseFloat(p.sharePercent ?? '0') > 0,
      )
      .map((p) => ({
        id: p.id,
        counterpartyName: p.counterparty.name,
        displaySharePercent:
          participantShareOverrides?.[p.counterpartyId] ?? parseFloat(p.sharePercent ?? '0'),
      }));

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`Guarantee Note — ${displayPolicyNumber(effectivePolicyNumber)}`}
      documentTitle="Guarantee Note"
      fileName={buildDocumentFileName(
        'Guarantee Note',
        displayPolicyNumber(effectivePolicyNumber),
        riskTypeName,
        effectiveTitle,
        `to ${displayName}`,
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
            width={100}
            height={10}
            style={{ objectFit: 'contain', marginTop: '4px', marginBottom: '2px' }}
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
        <div className="flex flex-col gap-0.5 text-base mb-2">
          <p className="text-gray-500">
            {new Date().toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <p className="font-base text-gray-900 mt-2">The Managing Director</p>
          <p className="text-gray-800">{displayName}</p>
          {displayCity && <p className="text-gray-600">{displayCity}</p>}
          {displayRegionCountry && <p className="text-gray-600">{displayRegionCountry}</p>}
          <p className="font-base text-gray-900 mt-2">Dear Sir/Madam</p>
        </div>

        {/* <hr className="border-gray-100 mb-1" /> */}

        {/*  heading */}
        <p className="text-base font-semibold text-gray-900 uppercase tracking-wide pt-1 text-center underline">
          Guarantee Note
        </p>
        <p className="text-base font-semibold text-gray-400 uppercase tracking-wide pt-1">
          Policy Details &amp; Risk Description
        </p>

        <DetailField inline label="Cover Type" value={classOfBusiness ?? '—'} />
        <DetailField inline label="Reinsured" value={cedant.name} />
        <DetailField
          inline
          label="Policy Number"
          value={displayPolicyNumber(effectivePolicyNumber)}
        />
        <DetailField inline label="Original Insured" value={effectiveTitle} />
        <DetailField inline label="Currency" value={effectiveCurrency ?? '—'} />
        <DetailField
          inline
          label="Insurance Period"
          value={`${fmtDate(effectiveInceptionDate)} – ${fmtDate(effectiveExpiryDate)}`}
        />

        <DetailField
          inline
          label="Sum Insured"
          value={fmtAmount(effectiveSumInsured, effectiveCurrency)}
        />
        <DetailField
          inline
          label="Premium"
          value={fmtAmount(effectivePremium, effectiveCurrency)}
        />
        <DetailField
          inline
          label="Facultative (Offer)"
          value={
            facSumInsured != null
              ? `${fmtAmount(facSumInsured, effectiveCurrency)} (${facOffer}% of 100%)`
              : '—'
          }
        />
        <DetailField
          inline
          label="Facultative Premium"
          value={fmtAmount(facPremium, effectiveCurrency)}
        />
        <DetailField
          inline
          label={`Commission (${effectiveCommission ?? 0}%)`}
          value={fmtAmount(commissionAmount, effectiveCurrency)}
        />

        <DetailField inline label="Net Premium" value={fmtAmount(netPremium, effectiveCurrency)} />

        {/* Participants */}
        <p className="text-base font-semibold text-gray-400 uppercase tracking-wide">
          Reinsurance Participant(s)
        </p>

        {participantRows.length === 0 ? (
          <p className="text-base text-gray-400">No participants assigned.</p>
        ) : (
          participantRows.map((p) => (
            <DetailField
              key={p.id}
              inline
              label={p.counterpartyName}
              value={`${p.displaySharePercent}% of 100%`}
            />
          ))
        )}
      </div>
    </DocumentPreviewModal>
  );
}
