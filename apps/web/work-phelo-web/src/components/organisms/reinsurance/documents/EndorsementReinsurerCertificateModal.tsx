'use client';

import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { Facultative, PlacementEndorsement } from '@/types/reinsurance';

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

function fmtDiffAmount(prev: number, curr: number, currency: string | null) {
  const diff = curr - prev;
  if (diff === 0) return '—';
  const sign = diff > 0 ? '+' : '';
  return `${sign}${fmtAmount(diff, currency)}`;
}

function fmtDiffPercent(prev: number, curr: number) {
  const diff = curr - prev;
  if (diff === 0) return '—';
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(2)}%`;
}

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

type FieldType = 'amount' | 'percent' | 'date' | 'text';

const CHANGE_FIELDS: { key: string; label: string; type: FieldType }[] = [
  { key: 'title', label: 'Insured', type: 'text' },
  { key: 'sumInsured', label: 'Sum Insured', type: 'amount' },
  { key: 'premium', label: 'Premium', type: 'amount' },
  { key: 'rate', label: 'Rate (%)', type: 'percent' },
  { key: 'facultativeOffer', label: 'Fac Offer %', type: 'percent' },
  { key: 'commission', label: 'Commission (%)', type: 'percent' },
  { key: 'currency', label: 'Currency', type: 'text' },
  { key: 'inceptionDate', label: 'Inception Date', type: 'date' },
  { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
  { key: 'classOfBusiness', label: 'Class of Business', type: 'text' },
];

function renderFieldVal(val: unknown, type: FieldType, currency: string | null): string {
  if (val == null || val === '') return '—';
  if (type === 'amount') return fmtAmount(toNum(val), currency);
  if (type === 'percent') return `${toNum(val)}%`;
  if (type === 'date') return fmtDate(String(val));
  return String(val);
}

function renderFieldDiff(
  prev: unknown,
  curr: unknown,
  type: FieldType,
  currency: string | null,
): string {
  if (type === 'amount') return fmtDiffAmount(toNum(prev), toNum(curr), currency);
  if (type === 'percent') return fmtDiffPercent(toNum(prev), toNum(curr));
  return '—';
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-6 first:mt-0">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
        {children}
      </p>
      <div className="border-t border-gray-300" />
    </div>
  );
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

  const originalParticipants = getSnapshotParticipants(endorsement.originalSnapshot);
  const originalParticipant = originalParticipants.find((p) => p.counterpartyId === counterpartyId);

  // Previous values
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

  // Revised values
  const currency = placement.currency;
  const yourPremium = (sharePercent / 100) * (placement.premium ?? 0);
  const yourSumInsured = (sharePercent / 100) * (placement.sumInsured ?? 0);
  const commissionAmt = (((placement.commission ?? 0) + brokerageFee) / 100) * yourPremium;
  const netPremium = yourPremium - commissionAmt;

  // Financial impact (deltas)
  const additionalPremium = yourPremium - prevYourPremium;
  const additionalCommission = commissionAmt - prevCommissionAmt;
  const netAmountPayable = netPremium - prevNetPremium;

  const changedFields = proposed
    ? CHANGE_FIELDS.filter(({ key }) => {
        const prev = originalPlacement[key];
        const curr = proposed[key];
        return curr !== undefined && String(prev ?? '') !== String(curr ?? '');
      })
    : [];

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`Endorsement Certificate — ${endorsement.endorsementNumber}`}
      documentTitle="Endorsement Certificate"
      onPrint={onPrint}
      onClose={onClose}
    >
      {/* POLICY INFORMATION */}
      <SectionHeading>Policy Information</SectionHeading>
      <table className="w-full text-sm border-collapse mb-2">
        <tbody>
          {[
            { label: 'Cedant', value: placement.cedant.name },
            { label: 'Reinsurer', value: reinsurerName },
            { label: 'Insured', value: fmtVal(placement.title) },
            { label: 'Slip No.', value: fmtVal(placement.reference) },
            { label: 'Endorsement No.', value: endorsement.endorsementNumber },
            { label: 'Effective Date', value: fmtDate(endorsement.effectiveDate) },
            { label: 'Currency', value: fmtVal(placement.currency) },
            { label: 'Class of Business', value: fmtVal(placement.classOfBusiness) },
          ].map((row) => (
            <tr key={row.label} className="border-b border-gray-50 last:border-0">
              <td className="py-1.5 pr-4 text-gray-500 w-2/5">{row.label}</td>
              <td className="py-1.5 pl-4 text-gray-900 font-medium">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ENDORSEMENT SUMMARY */}
      <SectionHeading>Endorsement Summary</SectionHeading>
      <div className="text-sm mb-2 space-y-2">
        <div>
          <span className="text-gray-500">Reason:</span>
          <p className="text-gray-900 font-medium mt-0.5">{fmtVal(endorsement.reason)}</p>
        </div>
        <div>
          <span className="text-gray-500">Effective From:</span>
          <p className="text-gray-900 font-medium mt-0.5">{fmtDate(endorsement.effectiveDate)}</p>
        </div>
      </div>

      {/* CHANGES TO ORIGINAL POLICY */}
      <SectionHeading>Changes to Original Policy</SectionHeading>
      {changedFields.length === 0 ? (
        <p className="text-sm text-gray-400 italic mb-2">No parameter changes recorded.</p>
      ) : (
        <table className="w-full text-sm border-collapse mb-2">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-1.5 pr-4 text-left text-xs font-semibold text-gray-500 w-1/4" />
              <th className="py-1.5 px-4 text-left text-xs font-semibold text-gray-500 w-1/4">
                Previous
              </th>
              <th className="py-1.5 px-4 text-left text-xs font-semibold text-gray-500 w-1/4">
                Revised
              </th>
              <th className="py-1.5 pl-4 text-left text-xs font-semibold text-gray-500 w-1/4">
                Difference
              </th>
            </tr>
          </thead>
          <tbody>
            {changedFields.map(({ key, label, type }) => (
              <tr key={key} className="border-b border-gray-50 last:border-0">
                <td className="py-1.5 pr-4 text-gray-500">{label}</td>
                <td className="py-1.5 px-4 text-gray-700">
                  {renderFieldVal(originalPlacement[key], type, prevCurrency)}
                </td>
                <td className="py-1.5 px-4 text-gray-900">
                  {renderFieldVal(proposed![key], type, currency)}
                </td>
                <td className="py-1.5 pl-4 text-gray-900 font-medium">
                  {renderFieldDiff(originalPlacement[key], proposed![key], type, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* REINSURER PARTICIPATION */}
      <SectionHeading>Reinsurer Participation</SectionHeading>
      <table className="w-full text-sm border-collapse mb-2">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-1.5 pr-4 text-left text-xs font-semibold text-gray-500 w-1/3" />
            <th className="py-1.5 px-4 text-left text-xs font-semibold text-gray-500 w-1/3">
              Previous
            </th>
            <th className="py-1.5 pl-4 text-left text-xs font-semibold text-gray-500 w-1/3">
              Revised
            </th>
          </tr>
        </thead>
        <tbody>
          {[
            {
              label: 'Participation %',
              previous: prevShare ? `${prevShare}%` : 'no change',
              revised: `${sharePercent}%`,
              bold: false,
            },
            {
              label: 'Share SI',
              previous: fmtAmount(prevYourSumInsured || null, prevCurrency),
              revised: fmtAmount(yourSumInsured, currency),
              bold: false,
            },
            {
              label: 'Gross Premium',
              previous: fmtAmount(prevYourPremium || null, prevCurrency),
              revised: fmtAmount(yourPremium, currency),
              bold: false,
            },
            {
              label: 'Commission',
              previous: fmtAmount(prevCommissionAmt || null, prevCurrency),
              revised: fmtAmount(commissionAmt, currency),
              bold: false,
            },
            {
              label: 'Net Premium',
              previous: fmtAmount(prevNetPremium || null, prevCurrency),
              revised: fmtAmount(netPremium, currency),
              bold: true,
            },
          ].map((row) => (
            <tr key={row.label} className="border-b border-gray-50 last:border-0">
              <td
                className={`py-1.5 pr-4 ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
              >
                {row.label}
              </td>
              <td
                className={`py-1.5 px-4 ${row.bold ? 'font-semibold text-gray-600' : 'text-gray-700'}`}
              >
                {row.previous}
              </td>
              <td
                className={`py-1.5 pl-4 ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-900'}`}
              >
                {row.revised}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* FINANCIAL IMPACT */}
      <SectionHeading>Financial Impact</SectionHeading>
      <table className="w-full text-sm border-collapse mb-2">
        <tbody>
          {[
            {
              label: additionalPremium >= 0 ? 'Additional Premium Due' : 'Return Premium',
              value: fmtAmount(Math.abs(additionalPremium), currency),
            },
            {
              label: additionalCommission >= 0 ? 'Additional Commission' : 'Return Commission',
              value: fmtAmount(Math.abs(additionalCommission), currency),
            },
            {
              label: netAmountPayable >= 0 ? 'Net Amount Payable' : 'Net Amount Returnable',
              value: fmtAmount(Math.abs(netAmountPayable), currency),
              bold: true,
            },
          ].map((row) => (
            <tr key={row.label} className="border-b border-gray-50 last:border-0">
              <td
                className={`py-1.5 pr-4 ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
              >
                {row.label}
              </td>
              <td
                className={`py-1.5 pl-4 text-right ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-900'}`}
              >
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* SPECIAL CONDITIONS */}
      <SectionHeading>Special Conditions</SectionHeading>
      <ul className="text-sm text-gray-700 space-y-1 list-none mb-2">
        <li>• All other terms remain unchanged.</li>
        <li>• This endorsement forms part of the original facultative slip.</li>
      </ul>
    </DocumentPreviewModal>
  );
}
