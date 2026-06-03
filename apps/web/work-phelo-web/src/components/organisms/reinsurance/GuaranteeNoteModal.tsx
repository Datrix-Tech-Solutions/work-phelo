'use client';

import { DocumentPreviewModal } from '@/components/organisms/reinsurance/DocumentPreviewModal';
import { DetailField } from '@/components/atoms/DetailField';
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

interface GuaranteeNoteModalProps {
  isOpen: boolean;
  placement: Facultative;
  onPrint: () => void;
  onClose: () => void;
}

export function GuaranteeNoteModal({
  isOpen,
  placement,
  onPrint,
  onClose,
}: GuaranteeNoteModalProps) {
  const {
    currency,
    facultativeOffer,
    sumInsured,
    premium,
    commission,
    classOfBusiness,
    title,
    reference,
    inceptionDate,
    expiryDate,
    cedant,
    participants,
  } = placement;

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
      onPrint={onPrint}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
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
