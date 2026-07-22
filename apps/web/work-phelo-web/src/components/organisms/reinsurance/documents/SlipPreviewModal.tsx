'use client';

import { DetailField } from '@/components/atoms/DetailField';
import { Facultative } from '@/types/reinsurance';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { useReinsurers, useRiskTypes } from '@/hooks';
import { useReinsuranceCharges } from '@/hooks/reinsurance/useReinsuranceCharges';
import { isForeignCedant, selectChargeRate } from '@/lib/reinsuranceTax';
import { placementDetailEntries } from '@/lib/reinsurance/placementFormDetails';
import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

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
  counterpartyId?: string;
  /** Overrides placement.facultativeOffer — e.g. the capacity left over after
   *  other participants have already taken their share. */
  facultativeOfferOverride?: number;
  onPrint: () => void;
  onClose: () => void;
}

export function SlipPreviewModal({
  isOpen,
  placement,
  brokerageFee,
  counterpartyId,
  facultativeOfferOverride,
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
    policyNumber,
    inceptionDate,
    expiryDate,
    businessDetails,
    offerDetails,
    riskTypeId,
    description,
  } = placement;

  const { data: reinsurers = [] } = useReinsurers();
  const { data: riskTypes = [] } = useRiskTypes();
  const { data: charges } = useReinsuranceCharges();
  const riskTypeName = riskTypes.find((rt) => rt.id === riskTypeId)?.name ?? null;
  const reinsurer = reinsurers.find((r) => r.id === counterpartyId);
  const foreignReinsurer = isForeignCedant(reinsurer);
  const nicLevyRate = selectChargeRate(charges, 'NIC_LEVY', currency);
  const withholdingTaxRate = selectChargeRate(charges, 'WITHHOLDING_TAX', currency);

  const businessEntries = placementDetailEntries(businessDetails);
  const offerEntries = placementDetailEntries(offerDetails);

  const facOffer = facultativeOfferOverride ?? facultativeOffer ?? 0;
  const facSumInsured = sumInsured != null ? (facOffer / 100) * sumInsured : null;
  const reinsurancePremium = premium != null ? (facOffer / 100) * premium : null;
  const commissions =
    reinsurancePremium != null
      ? (((commission ?? 0) + brokerageFee) / 100) * reinsurancePremium
      : null;
  const netPremium =
    reinsurancePremium != null && commissions != null ? reinsurancePremium - commissions : null;
  const nicLevy =
    foreignReinsurer && reinsurancePremium != null
      ? reinsurancePremium * (nicLevyRate / 100)
      : null;
  const withholdingTax =
    foreignReinsurer && reinsurancePremium != null
      ? reinsurancePremium * (withholdingTaxRate / 100)
      : null;
  const netPremiumPayable =
    netPremium != null ? netPremium - (nicLevy ?? 0) - (withholdingTax ?? 0) : null;

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`Offer Slip — ${title}`}
      documentTitle="Facultative Offer Slip"
      fileName={buildDocumentFileName(
        'Offer Slip',
        displayPolicyNumber(policyNumber),
        riskTypeName,
        title,
        reinsurer?.name,
      )}
      onPrint={onPrint}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <div className="mb-4">
          <Field label="Date" value={today()} />
        </div>
        <Field label="Cover Type" value={classOfBusiness} />
        <Field label="Original Insured" value={title} />
        <Field label="Policy Number" value={displayPolicyNumber(policyNumber)} />
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
            {businessEntries.map((entry) => {
              const formatted = fmtFieldValue(entry.value);
              return formatted === '—' ? null : (
                <DetailField key={entry.key} inline label={entry.label} value={formatted} />
              );
            })}
            {offerEntries.map((entry) => {
              const formatted = fmtFieldValue(entry.value);
              return formatted === '—' ? null : (
                <DetailField key={entry.key} inline label={entry.label} value={formatted} />
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
            {nicLevy != null && withholdingTax != null && (
              <>
                <Field label={`NIC Levy (${nicLevyRate}%)`} value={fmtAmount(nicLevy, currency)} />
                <Field
                  label={`Withholding Tax (${withholdingTaxRate}%)`}
                  value={fmtAmount(withholdingTax, currency)}
                />
              </>
            )}
          </>
        )}

        {netPremiumPayable != null && (
          <>
            <hr className="border-gray-100 my-1" />

            <Field label="Net Premium" value={fmtAmount(netPremiumPayable, currency)} />
          </>
        )}
        {description && (
          <>
            <hr className="border-gray-100 my-1" />
            <p className="text-xs font-semibold text-gray-400 tracking-wide">Kindly Refer:</p>
            <div
              className="text-sm text-gray-700"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          </>
        )}
      </div>
    </DocumentPreviewModal>
  );
}
