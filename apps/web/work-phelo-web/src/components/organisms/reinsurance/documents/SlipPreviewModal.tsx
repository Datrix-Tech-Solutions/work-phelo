'use client';

import { DetailField } from '@/components/atoms/DetailField';
import { Facultative } from '@/types/reinsurance';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';

function toLabel(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtFieldValue(val: unknown): string {
  if (val == null) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function today() {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number | null, currency: string | null) {
  if (val == null) return '—';
  return `${currency ?? ''} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

interface SlipPreviewModalProps {
  isOpen: boolean;
  placement: Facultative;
  brokerageFee: number;
  onPrint: () => void;
  onClose: () => void;
}

export function SlipPreviewModal({
  isOpen,
  placement,
  brokerageFee,
  onPrint,
  onClose,
}: SlipPreviewModalProps) {
  const {
    currency,
    facultativeOffer,
    sumInsured,
    premium,
    commission,
    rate,
    classOfBusiness,
    title,
    reference,
    inceptionDate,
    expiryDate,
    businessDetails,
    offerDetails,
  } = placement;

  const businessEntries = Object.entries(businessDetails ?? {});
  const offerEntries = Object.entries(offerDetails ?? {});

  const facOffer = facultativeOffer ?? 0;
  const facSumInsured = sumInsured != null ? (facOffer / 100) * sumInsured : null;
  const reinsurancePremium = premium != null ? (facOffer / 100) * premium : null;
  const commissions =
    reinsurancePremium != null
      ? (((commission ?? 0) + brokerageFee) / 100) * reinsurancePremium
      : null;
  const netPremium =
    reinsurancePremium != null && commissions != null ? reinsurancePremium - commissions : null;

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`Offer Slip — ${title}`}
      documentTitle="Facultative Offer Slip"
      onPrint={onPrint}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <DetailField inline label="Date" value={today()} />
        <DetailField inline label="Cover Type" value={classOfBusiness ?? '—'} />
        <DetailField inline label="Original Insured" value={title} />
        <DetailField inline label="Policy Number" value={reference} />
        <DetailField inline label="Currency" value={currency ?? '—'} />
        <DetailField
          inline
          label="Insurance Period"
          value={`${fmtDate(inceptionDate ?? '')} – ${fmtDate(expiryDate ?? '')}`}
        />

        {(businessEntries.length > 0 || offerEntries.length > 0) && (
          <>
            <hr className="border-gray-100 my-1" />
            {businessEntries.map(([key, val]) => (
              <DetailField key={key} inline label={toLabel(key)} value={fmtFieldValue(val)} />
            ))}
            {offerEntries.map(([key, val]) => (
              <DetailField key={key} inline label={toLabel(key)} value={fmtFieldValue(val)} />
            ))}
          </>
        )}

        <hr className="border-gray-100 my-1" />

        <DetailField inline label="100% Sum Insured" value={fmtAmount(sumInsured, currency)} />
        <DetailField inline label="Premium Rate" value={rate != null ? `${rate}%` : '—'} />
        <DetailField inline label="100% Gross Premium" value={fmtAmount(premium, currency)} />
        <DetailField
          inline
          label="Offer"
          value={
            facSumInsured != null ? `${fmtAmount(facSumInsured, currency)} (${facOffer}%)` : '—'
          }
        />

        <DetailField
          inline
          label="Reinsurance Premium"
          value={fmtAmount(reinsurancePremium, currency)}
        />
        <DetailField
          inline
          label="Commission"
          value={`${fmtAmount(commissions, currency)} (${commission ?? 0}% + ${brokerageFee}%)`}
        />

        <hr className="border-gray-100 my-1" />

        <DetailField inline label="Net Premium" value={fmtAmount(netPremium, currency)} />
      </div>
    </DocumentPreviewModal>
  );
}
