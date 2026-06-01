import { DetailField } from '@/components/atoms/DetailField';
import { Badge } from '@/components/atoms/Badge';
import { Facultative, FacultativeStatus } from '@/types/reinsurance';

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

const STATUS_VARIANT_MAP: Record<FacultativeStatus, 'success' | 'warning' | 'neutral' | 'danger'> =
  {
    Open: 'success',
    Closed: 'warning',
    Expired: 'neutral',
    Cancelled: 'danger',
  };

interface FacultativeOverviewProps {
  placement: Facultative;
}

export function FacultativeOverview({ placement }: FacultativeOverviewProps) {
  const facSumInsured = placement.sumInsured * (placement.facultativeOffer / 100);
  const facPremium = placement.premium * (placement.facultativeOffer / 100);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Overview</h2>
        <Badge label={placement.status} variant={STATUS_VARIANT_MAP[placement.status]} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
        <DetailField label="Class of Risk" value={placement.riskType} />
        <DetailField label="Policy No." value={placement.policyNumber} />
        <DetailField label="Reinsured" value={placement.insuranceCompany} />
        <DetailField label="Insured" value={placement.insured} />
        <DetailField
          label="Period of Insurance"
          value={`${fmtDate(placement.periodFrom)} – ${fmtDate(placement.periodTo)}`}
        />
        <DetailField label="Rate (%)" value={`${placement.rate}%`} />
        <DetailField label="Commission (%)" value={`${placement.commission}%`} />
        <DetailField label="Fac. Offer (%)" value={`${placement.facultativeOffer}%`} />
        <DetailField label="Premium" value={fmtAmount(placement.premium, placement.currency)} />
        <DetailField
          label="Sum Insured"
          value={fmtAmount(placement.sumInsured, placement.currency)}
        />
        <DetailField
          label="Fac. Sum Insured"
          value={fmtAmount(facSumInsured, placement.currency)}
        />
        <DetailField label="Fac. Premium" value={fmtAmount(facPremium, placement.currency)} />
      </div>
    </div>
  );
}
