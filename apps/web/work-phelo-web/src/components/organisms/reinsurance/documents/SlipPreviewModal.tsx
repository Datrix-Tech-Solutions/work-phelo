'use client';

import { DetailField } from '@/components/atoms/DetailField';
import { Facultative } from '@/types/reinsurance';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { useCedants } from '@/hooks';
import { isForeignCedant, NIC_LEVY_RATE, WITHHOLDING_TAX_RATE } from '@/lib/reinsuranceTax';

function toLabel(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtFieldValue(val: unknown): string {
  if (val == null) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === '—') return null;
  return <DetailField inline label={label} value={value} />;
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

  const { data: cedants = [] } = useCedants();
  const foreignCedant = isForeignCedant(cedants.find((c) => c.id === placement.cedant.id));

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
  const nicLevy = foreignCedant && netPremium != null ? netPremium * NIC_LEVY_RATE : null;
  const withholdingTax =
    foreignCedant && netPremium != null ? netPremium * WITHHOLDING_TAX_RATE : null;
  const netPremiumPayable =
    netPremium != null ? netPremium - (nicLevy ?? 0) - (withholdingTax ?? 0) : null;

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`Offer Slip — ${title}`}
      documentTitle="Facultative Offer Slip"
      onPrint={onPrint}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <div className="mb-4">
          <Field label="Date" value={today()} />
        </div>
        <Field label="Cover Type" value={classOfBusiness} />
        <Field label="Original Insured" value={title} />
        <Field label="Policy Number" value={reference} />
        <Field label="Currency" value={currency} />
        {(inceptionDate || expiryDate) && (
          <Field
            label="Insurance Period"
            value={`${fmtDate(inceptionDate ?? '')} – ${fmtDate(expiryDate ?? '')}`}
          />
        )}

        {(businessEntries.length > 0 || offerEntries.length > 0) && (
          <>
            <hr className="border-gray-100 my-1" />
            {businessEntries.map(([key, val]) => {
              const formatted = fmtFieldValue(val);
              return formatted === '—' ? null : (
                <DetailField key={key} inline label={toLabel(key)} value={formatted} />
              );
            })}
            {offerEntries.map(([key, val]) => {
              const formatted = fmtFieldValue(val);
              return formatted === '—' ? null : (
                <DetailField key={key} inline label={toLabel(key)} value={formatted} />
              );
            })}
          </>
        )}

        {(sumInsured != null ||
          rate != null ||
          premium != null ||
          facSumInsured != null ||
          reinsurancePremium != null) && (
          <>
            <hr className="border-gray-100 my-1" />
            <Field
              label="100% Sum Insured"
              value={sumInsured != null ? fmtAmount(sumInsured, currency) : null}
            />
            <Field label="Premium Rate" value={rate != null ? `${rate}%` : null} />
            <Field
              label="100% Gross Premium"
              value={premium != null ? fmtAmount(premium, currency) : null}
            />
            <Field
              label="Offer"
              value={
                facSumInsured != null
                  ? `${fmtAmount(facSumInsured, currency)} (${facOffer}%)`
                  : null
              }
            />
            <Field
              label="Reinsurance Premium"
              value={reinsurancePremium != null ? fmtAmount(reinsurancePremium, currency) : null}
            />
            <Field
              label="Reinsurance Commission"
              value={
                commissions != null
                  ? `${fmtAmount(commissions, currency)} (${(commission ?? 0) + brokerageFee}%)`
                  : null
              }
            />
          </>
        )}

        {netPremium != null && (
          <>
            <hr className="border-gray-100 my-1" />
            <Field label="Net Premium" value={fmtAmount(netPremium, currency)} />
            {nicLevy != null && withholdingTax != null && (
              <>
                <Field
                  label={`NIC Levy (${NIC_LEVY_RATE * 100}%)`}
                  value={fmtAmount(nicLevy, currency)}
                />
                <Field
                  label={`Withholding Tax (${WITHHOLDING_TAX_RATE * 100}%)`}
                  value={fmtAmount(withholdingTax, currency)}
                />
                <Field label="Net Premium Payable" value={fmtAmount(netPremiumPayable, currency)} />
              </>
            )}
          </>
        )}
      </div>
    </DocumentPreviewModal>
  );
}
