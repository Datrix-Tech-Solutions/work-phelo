'use client';

import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DetailField } from '@/components/atoms/DetailField';
import { Facultative } from '@/types/reinsurance';

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
    createdAt,
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Offer Slip — ${title}`}
      width="sm:w-[40vw] sm:max-w-[40vw]"
      height="sm:h-[90vh] sm:max-h-[90vh]"
      fullScreenMobile
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close Preview
          </Button>
          <Button onClick={onPrint}>Print</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <DetailField horizontal label="Date" value={fmtDate(createdAt)} />
        <DetailField horizontal label="Cover Type" value={classOfBusiness ?? '—'} />
        <DetailField horizontal label="Original Insured" value={title} />
        <DetailField horizontal label="Policy Number" value={reference} />
        <DetailField horizontal label="Currency" value={currency ?? '—'} />
        <DetailField
          horizontal
          label="Insurance Period"
          value={`${fmtDate(inceptionDate ?? '')} – ${fmtDate(expiryDate ?? '')}`}
        />

        {(businessEntries.length > 0 || offerEntries.length > 0) && (
          <>
            <hr className="border-gray-100 my-1" />
            {businessEntries.map(([key, val]) => (
              <DetailField key={key} horizontal label={toLabel(key)} value={fmtFieldValue(val)} />
            ))}
            {offerEntries.map(([key, val]) => (
              <DetailField key={key} horizontal label={toLabel(key)} value={fmtFieldValue(val)} />
            ))}
          </>
        )}

        <hr className="border-gray-100 my-1" />

        <DetailField horizontal label="100% Sum Insured" value={fmtAmount(sumInsured, currency)} />
        <DetailField horizontal label="Fac. Offer (%)" value={`${facOffer}%`} />
        <DetailField horizontal label="Offer" value={fmtAmount(facSumInsured, currency)} />
        <DetailField horizontal label="Premium Rate" value={rate != null ? `${rate}%` : '—'} />
        <DetailField horizontal label="100% Gross Premium" value={fmtAmount(premium, currency)} />
        <DetailField
          horizontal
          label="Reinsurance Premium"
          value={fmtAmount(reinsurancePremium, currency)}
        />
        <DetailField
          horizontal
          label="Commission"
          value={`${fmtAmount(commissions, currency)} (${commission ?? 0}% + ${brokerageFee}%)`}
        />

        <hr className="border-gray-100 my-1" />

        <DetailField horizontal label="Net Premium" value={fmtAmount(netPremium, currency)} />
      </div>
    </Modal>
  );
}
