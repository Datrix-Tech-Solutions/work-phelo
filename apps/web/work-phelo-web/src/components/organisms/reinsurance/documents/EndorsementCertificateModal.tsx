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

interface EndorsementCertificateModalProps {
  isOpen: boolean;
  placement: Facultative;
  endorsement: PlacementEndorsement;
  onPrint: () => void;
  onClose: () => void;
}

export function EndorsementCertificateModal({
  isOpen,
  placement,
  endorsement,
  onPrint,
  onClose,
}: EndorsementCertificateModalProps) {
  const original = getSnapshotPlacement(endorsement.originalSnapshot);
  const proposed = endorsement.proposedSnapshot
    ? getSnapshotPlacement(endorsement.proposedSnapshot)
    : null;

  const changedFields = proposed
    ? PARAM_FIELDS.filter(({ key }) => {
        const b = proposed[key];
        return b !== undefined && String(original[key] ?? '') !== String(b ?? '');
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
      {/* Date + salutation */}
      <div className="flex flex-col gap-0.5 text-sm mb-4 mt-1">
        <p className="text-gray-500">{fmtDate(new Date().toISOString())}</p>
        <p className="font-medium text-gray-900 mt-2">The Managing Director</p>
        <p className="text-gray-800">{placement.cedant.name}</p>
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

      {/* Changed parameters */}
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
                    {isDate ? fmtDate(original[key] as string) : fmtVal(original[key])}
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
