'use client';

import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { Counterparty, Facultative, PlacementEndorsement } from '@/types/reinsurance';

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

interface EndorsementCertificateModalProps {
  isOpen: boolean;
  placement: Facultative;
  endorsement: PlacementEndorsement;
  cedant?: Counterparty;
  onPrint: () => void;
  onClose: () => void;
}

export function EndorsementCertificateModal({
  isOpen,
  placement,
  endorsement,
  cedant,
  onPrint,
  onClose,
}: EndorsementCertificateModalProps) {
  const originalPlacement = getSnapshotPlacement(endorsement.originalSnapshot);
  const proposed = endorsement.proposedSnapshot
    ? getSnapshotPlacement(endorsement.proposedSnapshot)
    : null;

  const primaryAddress = cedant?.addresses?.find((a) => a.isPrimary) ?? cedant?.addresses?.[0];

  const prevCurrency = String(originalPlacement.currency ?? '');
  const currency = placement.currency;

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
      {/* Letter header */}
      <div className="flex flex-col gap-0.5 text-sm mb-6">
        <p className="text-gray-400 mb-3">{fmtDate(new Date().toISOString())}</p>
        <p className="font-semibold text-gray-900">The Managing Director</p>
        <p className="text-gray-800">{placement.cedant.name}</p>
        {primaryAddress && (
          <>
            <p className="text-gray-600">{primaryAddress.line1}</p>
            {primaryAddress.line2 && <p className="text-gray-600">{primaryAddress.line2}</p>}
            <p className="text-gray-600">{primaryAddress.city}</p>
          </>
        )}
      </div>

      {/* POLICY INFORMATION */}
      <SectionHeading>Policy Information</SectionHeading>
      <table className="w-full text-sm border-collapse mb-2">
        <tbody>
          {[
            { label: 'Cedant', value: placement.cedant.name },
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

      {/* SPECIAL CONDITIONS */}
      <SectionHeading>Special Conditions</SectionHeading>
      <ul className="text-sm text-gray-700 space-y-1 list-none mb-2">
        <li>• All other terms remain unchanged.</li>
        <li>• This endorsement forms part of the original facultative slip.</li>
      </ul>
    </DocumentPreviewModal>
  );
}
