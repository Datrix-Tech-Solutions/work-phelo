'use client';

import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DetailField } from '@/components/atoms/DetailField';
import { Facultative } from '@/types/reinsurance';

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number, currency: string) {
  return `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    riskType,
    insured,
    policyNumber,
    periodFrom,
    periodTo,
    offerDate,
  } = placement;

  const reinsurancePremium = (facultativeOffer / 100) * premium;
  const offer = (facultativeOffer / 100) * sumInsured;
  const commissions = ((commission + brokerageFee) / 100) * reinsurancePremium;
  const netPremium = reinsurancePremium - commissions;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Offer Slip — ${insured}`}
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
        <DetailField horizontal label="Date" value={fmtDate(offerDate)} />
        <DetailField horizontal label="Cover Type" value={riskType} />
        <DetailField horizontal label="Original Insured" value={insured} />
        <DetailField horizontal label="Policy Number" value={policyNumber} />
        <DetailField horizontal label="Currency" value={currency} />
        <DetailField
          horizontal
          label="Insurance Period"
          value={`${fmtDate(periodFrom)} – ${fmtDate(periodTo)}`}
        />

        <hr className="border-gray-100 my-1" />

        <DetailField horizontal label="Sum Insured" value={fmtAmount(sumInsured, currency)} />
        <DetailField horizontal label="Premium Rate" value={`${rate}%`} />
        <DetailField
          horizontal
          label="Original Gross Premium"
          value={fmtAmount(premium, currency)}
        />
        <DetailField horizontal label="Offer" value={fmtAmount(offer, currency)} />
        <DetailField
          horizontal
          label="Reinsurance Premium"
          value={fmtAmount(reinsurancePremium, currency)}
        />
        <DetailField
          horizontal
          label="Commission"
          value={`${fmtAmount(commissions, currency)} (${commission}% + ${brokerageFee}%)`}
        />

        <hr className="border-gray-100 my-1" />

        <DetailField horizontal label="Net Premium" value={fmtAmount(netPremium, currency)} />
      </div>
    </Modal>
  );
}
