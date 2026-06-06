'use client';

import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { Facultative, PlacementEndorsement, ENDORSEMENT_TYPE_LABELS } from '@/types/reinsurance';

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function fmtVal(val: unknown): string {
  if (val == null || val === '') return '—';
  return String(val);
}

function fmtAmount(val: number | null | undefined, currency: string | null) {
  if (val == null) return '—';
  return `${currency ?? ''} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

const PARAM_FIELDS: { key: string; label: string; isDate?: boolean }[] = [
  { key: 'reference', label: 'Policy Number' },
  { key: 'title', label: 'Insured' },
  { key: 'sumInsured', label: 'Sum Insured' },
  { key: 'rate', label: 'Rate (%)' },
  { key: 'premium', label: 'Premium' },
  { key: 'facultativeOffer', label: 'Fac. Offer (%)' },
  { key: 'commission', label: 'Commission (%)' },
  { key: 'currency', label: 'Currency' },
  { key: 'inceptionDate', label: 'Inception Date', isDate: true },
  { key: 'expiryDate', label: 'Expiry Date', isDate: true },
];

function getSnapshotPlacement(snapshot: Record<string, unknown>): Record<string, unknown> {
  if (snapshot.placement && typeof snapshot.placement === 'object') {
    return snapshot.placement as Record<string, unknown>;
  }
  return snapshot;
}

function getSnapshotParticipants(snapshot: Record<string, unknown>): Record<string, unknown>[] {
  const ps = snapshot.participants;
  return Array.isArray(ps) ? (ps as Record<string, unknown>[]) : [];
}

function toNum(val: unknown): number {
  if (val == null) return 0;
  const n = typeof val === 'string' ? parseFloat(val) : Number(val);
  return isNaN(n) ? 0 : n;
}

interface ParticipationRow {
  label: string;
  previous: string;
  revised: string;
  bold?: boolean;
}

interface EndorsementReinsurerCertificateModalProps {
  isOpen: boolean;
  placement: Facultative;
  endorsement: PlacementEndorsement;
  counterpartyId: string;
  reinsurerName: string;
  sharePercent: number;
  brokerageFee: number;
  onPrint: () => void;
  onClose: () => void;
}

export function EndorsementReinsurerCertificateModal({
  isOpen,
  placement,
  endorsement,
  counterpartyId,
  reinsurerName,
  sharePercent,
  brokerageFee,
  onPrint,
  onClose,
}: EndorsementReinsurerCertificateModalProps) {
  const originalPlacement = getSnapshotPlacement(endorsement.originalSnapshot);
  const proposed = endorsement.proposedSnapshot
    ? getSnapshotPlacement(endorsement.proposedSnapshot)
    : null;

  // Original participant data from snapshot
  const originalParticipants = getSnapshotParticipants(endorsement.originalSnapshot);
  const originalParticipant = originalParticipants.find((p) => p.counterpartyId === counterpartyId);

  const changedFields = proposed
    ? PARAM_FIELDS.filter(({ key }) => {
        const b = proposed[key];
        return b !== undefined && String(originalPlacement[key] ?? '') !== String(b ?? '');
      })
    : [];

  // Previous participation (from original snapshot)
  const prevShare = toNum(
    originalParticipant?.signedLinePercent ?? originalParticipant?.sharePercent,
  );
  const prevBrokerage = toNum(originalParticipant?.brokerageFee);
  const prevPremium = toNum(originalPlacement.premium);
  const prevSumInsured = toNum(originalPlacement.sumInsured);
  const prevCommission = toNum(originalPlacement.commission);
  const prevCurrency = String(originalPlacement.currency ?? '');
  const prevYourPremium = (prevShare / 100) * prevPremium;
  const prevYourSumInsured = (prevShare / 100) * prevSumInsured;
  const prevCommissionAmt = ((prevCommission + prevBrokerage) / 100) * prevYourPremium;
  const prevNetPremium = prevYourPremium - prevCommissionAmt;

  // Revised participation (current)
  const currency = placement.currency;
  const yourPremium = (sharePercent / 100) * (placement.premium ?? 0);
  const yourSumInsured = (sharePercent / 100) * (placement.sumInsured ?? 0);
  const commissionAmt = (((placement.commission ?? 0) + brokerageFee) / 100) * yourPremium;
  const netPremium = yourPremium - commissionAmt;

  const participationRows: ParticipationRow[] = [
    {
      label: 'Your Share',
      previous: prevShare ? `${prevShare}%` : '—',
      revised: `${sharePercent}%`,
    },
    {
      label: 'Your Sum Insured',
      previous: fmtAmount(prevYourSumInsured || null, prevCurrency),
      revised: fmtAmount(yourSumInsured, currency),
    },
    {
      label: 'Your Premium',
      previous: fmtAmount(prevYourPremium || null, prevCurrency),
      revised: fmtAmount(yourPremium, currency),
    },
    {
      label: 'Less Commission',
      previous: fmtAmount(prevCommissionAmt || null, prevCurrency),
      revised: fmtAmount(commissionAmt, currency),
    },
    {
      label: 'Net Premium',
      previous: fmtAmount(prevNetPremium || null, prevCurrency),
      revised: fmtAmount(netPremium, currency),
      bold: true,
    },
  ];

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`Endorsement Certificate — ${endorsement.endorsementNumber}`}
      documentTitle="Endorsement Certificate"
      onPrint={onPrint}
      onClose={onClose}
    >
      {/* Date + salutation */}
      <div className="flex flex-col gap-0.5 text-sm mb-4 mt-1">
        <p className="text-gray-500">{fmtDate(new Date().toISOString())}</p>
        <p className="font-medium text-gray-900 mt-2">The Managing Director</p>
        <p className="text-gray-800">{reinsurerName}</p>
      </div>

      {/* Policy details */}
      <table className="w-full text-sm border-collapse mb-5">
        <tbody>
          {[
            { label: 'Cedant', value: placement.cedant.name },
            { label: 'Policy Number', value: placement.reference },
            { label: 'Endorsement Reference', value: endorsement.endorsementNumber },
            { label: 'Endorsement Type', value: ENDORSEMENT_TYPE_LABELS[endorsement.type] },
            { label: 'Effective Date', value: fmtDate(endorsement.effectiveDate) },
            { label: 'Reason', value: endorsement.reason },
          ].map((row) => (
            <tr key={row.label} className="border-b border-gray-50 last:border-0">
              <td className="py-2 pr-4 text-gray-500 w-1/2">{row.label}</td>
              <td className="py-2 pl-4 text-gray-900 font-medium">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Participation: previous vs revised */}
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
        Your Participation
      </p>
      <table className="w-full text-sm border-collapse mb-5">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2 pr-4 text-left text-xs font-semibold text-gray-500 w-1/3" />
            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 w-1/3">
              Previous
            </th>
            <th className="py-2 pl-4 text-left text-xs font-semibold text-gray-500 w-1/3">
              Revised
            </th>
          </tr>
        </thead>
        <tbody>
          {participationRows.map((row) => (
            <tr key={row.label} className="border-b border-gray-50 last:border-0">
              <td
                className={`py-2 pr-4 ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
              >
                {row.label}
              </td>
              <td
                className={`py-2 px-4 ${row.bold ? 'font-semibold text-gray-400' : 'text-gray-400'}`}
              >
                {row.previous}
              </td>
              <td
                className={`py-2 pl-4 ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-900'}`}
              >
                {row.revised}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Changed policy parameters */}
      {changedFields.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Changes to Policy Terms
          </p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 pr-4 text-left text-xs font-semibold text-gray-500 w-1/3">
                  Parameter
                </th>
                <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 w-1/3">
                  Previous
                </th>
                <th className="py-2 pl-4 text-left text-xs font-semibold text-gray-500 w-1/3">
                  Revised
                </th>
              </tr>
            </thead>
            <tbody>
              {changedFields.map(({ key, label, isDate }) => (
                <tr key={key} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 pr-4 text-gray-500">{label}</td>
                  <td className="py-2 px-4 text-gray-400">
                    {isDate
                      ? fmtDate(originalPlacement[key] as string)
                      : fmtVal(originalPlacement[key])}
                  </td>
                  <td className="py-2 pl-4 text-gray-900 font-medium">
                    {isDate ? fmtDate(proposed![key] as string) : fmtVal(proposed![key])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </DocumentPreviewModal>
  );
}
