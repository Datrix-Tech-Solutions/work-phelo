import { useState } from 'react';
import { DetailField } from '@/components/atoms/DetailField';
import { Badge } from '@/components/atoms/Badge';
import { Icons } from '@/components/atoms/icons';
import { Facultative, PlacementDisplayStatus, toDisplayStatus } from '@/types/reinsurance';

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

const DISPLAY_STATUS_VARIANT_MAP: Record<
  PlacementDisplayStatus,
  'success' | 'warning' | 'neutral' | 'danger'
> = {
  Open: 'warning',
  Closed: 'success',
  Cancelled: 'danger',
};

interface FacultativeOverviewProps {
  placement: Facultative;
}

export function FacultativeOverview({ placement }: FacultativeOverviewProps) {
  const [collapsed, setCollapsed] = useState(false);

  const facOffer = placement.facultativeOffer ?? 0;
  const facSumInsured =
    placement.sumInsured != null ? placement.sumInsured * (facOffer / 100) : null;
  const facPremium = placement.premium != null ? placement.premium * (facOffer / 100) : null;

  const riskEntries = [
    ...Object.entries(placement.businessDetails ?? {}),
    ...Object.entries(placement.offerDetails ?? {}),
  ];

  const display = toDisplayStatus(placement.status);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Overview</h2>
          <Badge label={display} variant={DISPLAY_STATUS_VARIANT_MAP[display]} />
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label={collapsed ? 'Expand overview' : 'Collapse overview'}
        >
          <Icons.ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
          />
        </button>
      </div>

      {!collapsed && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
          <DetailField label="Class of Risk" value={placement.classOfBusiness ?? '—'} />
          <DetailField label="Policy No." value={placement.reference} />
          <DetailField label="Reinsured" value={placement.cedant.name} />
          <DetailField label="Insured" value={placement.title} />
          <DetailField
            label="Period of Insurance"
            value={`${fmtDate(placement.inceptionDate ?? '')} – ${fmtDate(placement.expiryDate ?? '')}`}
          />
          {riskEntries.map(([key, val]) => (
            <DetailField key={key} label={toLabel(key)} value={fmtFieldValue(val)} />
          ))}
          <DetailField
            label="Rate (%)"
            value={placement.rate != null ? `${placement.rate}%` : '—'}
          />
          <DetailField
            label="Commission (%)"
            value={placement.commission != null ? `${placement.commission}%` : '—'}
          />
          <DetailField label="Fac. Offer (%)" value={`${facOffer}%`} />
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
      )}
    </div>
  );
}
