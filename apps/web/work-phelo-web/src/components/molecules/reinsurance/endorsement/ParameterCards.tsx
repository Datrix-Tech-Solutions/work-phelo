'use client';

import { fmtDate, fmtVal } from './formatters';
import { cardClass } from '@/lib/utils';
import { useThemeStore } from '@/store/theme.store';
import { placementDetailEntries } from '@/lib/reinsurance/placementFormDetails';

const PARAM_FIELDS: { key: string; label: string }[] = [
  { key: 'policyNumber', label: 'Policy Number' },
  { key: 'reference', label: 'Reference' },
  { key: 'title', label: 'Insured' },
  { key: 'sumInsured', label: 'Sum Insured' },
  { key: 'rate', label: 'Rate (%)' },
  { key: 'premium', label: 'Premium' },
  { key: 'facultativeOffer', label: 'Fac. Offer (%)' },
  { key: 'commission', label: 'Commission (%)' },
  { key: 'currency', label: 'Currency' },
  { key: 'inceptionDate', label: 'Inception Date' },
  { key: 'expiryDate', label: 'Expiry Date' },
];

const DATE_KEYS = new Set(['inceptionDate', 'expiryDate']);

// Risk/offer detail fields (schema-driven risk details + custom "extra" fields) aren't flat
// scalars on the snapshot — they live nested under businessDetails/offerDetails, so they need
// their own extraction/diff pass alongside PARAM_FIELDS.
function detailEntryMap(
  record: Record<string, unknown>,
): Map<string, { label: string; value: unknown }> {
  const businessDetails = (record.businessDetails ?? null) as Record<string, unknown> | null;
  const offerDetails = (record.offerDetails ?? null) as Record<string, unknown> | null;
  const map = new Map<string, { label: string; value: unknown }>();
  for (const entry of [
    ...placementDetailEntries(businessDetails),
    ...placementDetailEntries(offerDetails),
  ]) {
    map.set(entry.key, { label: entry.label, value: entry.value });
  }
  return map;
}

export function ParameterCards({
  original,
  proposed,
}: {
  original: Record<string, unknown>;
  proposed: Record<string, unknown>;
}) {
  const isDark = useThemeStore((s) => s.theme === 'dark');
  const changedFields = PARAM_FIELDS.filter(({ key }) => {
    const b = proposed[key];
    return b !== undefined && String(original[key] ?? '') !== String(b ?? '');
  });

  const originalDetails = detailEntryMap(original);
  const proposedDetails = detailEntryMap(proposed);
  const changedDetailFields = Array.from(
    new Set([...originalDetails.keys(), ...proposedDetails.keys()]),
  )
    .map((key) => ({
      key,
      label: (proposedDetails.get(key) ?? originalDetails.get(key))!.label,
    }))
    .filter(
      ({ key }) =>
        String(originalDetails.get(key)?.value ?? '') !==
        String(proposedDetails.get(key)?.value ?? ''),
    );

  const allChanged = [...changedFields, ...changedDetailFields];

  if (allChanged.length === 0) {
    return <p className="text-xs text-gray-400 italic">No parameter changes recorded.</p>;
  }

  const revisedLabelColor = isDark ? '#4ade80' : '#16a34a';
  const revisedValueColor = isDark ? '#86efac' : '#15803d';

  const originalValue = (key: string) =>
    originalDetails.has(key) ? originalDetails.get(key)!.value : original[key];
  const proposedValue = (key: string) =>
    proposedDetails.has(key) ? proposedDetails.get(key)!.value : proposed[key];

  return (
    <div className="flex gap-4">
      <div className={cardClass('flex-1 flex flex-col gap-3 p-4')}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Previous Parameters
        </p>
        <div className="flex flex-col gap-2">
          {allChanged.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500 shrink-0">{label}</span>
              <span className="text-xs font-medium text-gray-700 text-right">
                {DATE_KEYS.has(key)
                  ? fmtDate(originalValue(key) as string)
                  : fmtVal(originalValue(key))}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-green-500/30 bg-green-500/10 p-4 flex flex-col gap-3">
        <p
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: revisedLabelColor }}
        >
          Revised Parameters
        </p>
        <div className="flex flex-col gap-2">
          {allChanged.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500 shrink-0">{label}</span>
              <span className="text-xs font-medium text-right" style={{ color: revisedValueColor }}>
                {DATE_KEYS.has(key)
                  ? fmtDate(proposedValue(key) as string)
                  : fmtVal(proposedValue(key))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
