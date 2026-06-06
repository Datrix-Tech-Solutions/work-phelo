'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Facultative, PlacementEndorsement, ENDORSEMENT_TYPE_LABELS } from '@/types/reinsurance';
import { usePlacementEndorsements, useReinsurers } from '@/hooks';
import { EndorsementCertificateModal } from '@/components/organisms/reinsurance/documents/EndorsementCertificateModal';
import { EndorsementReinsurerCertificateModal } from '@/components/organisms/reinsurance/documents/EndorsementReinsurerCertificateModal';

interface EndorsementTabProps {
  placement: Facultative;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtVal(val: unknown): string {
  if (val == null || val === '') return '—';
  if (typeof val === 'number') return val.toLocaleString();
  return String(val);
}

const PARAM_FIELDS: { key: string; label: string }[] = [
  { key: 'reference', label: 'Policy Number' },
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

function getSnapshotPlacement(snapshot: Record<string, unknown>): Record<string, unknown> {
  if (snapshot.placement && typeof snapshot.placement === 'object') {
    return snapshot.placement as Record<string, unknown>;
  }
  return snapshot;
}

function ParameterCards({
  original,
  proposed,
}: {
  original: Record<string, unknown>;
  proposed: Record<string, unknown>;
}) {
  const changedFields = PARAM_FIELDS.filter(({ key }) => {
    const b = proposed[key];
    return b !== undefined && String(original[key] ?? '') !== String(b ?? '');
  });

  if (changedFields.length === 0) {
    return <p className="text-xs text-gray-400 italic">No parameter changes recorded.</p>;
  }

  return (
    <div className="flex gap-4">
      <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50 p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Previous Parameters
        </p>
        <div className="flex flex-col gap-2">
          {changedFields.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500 shrink-0">{label}</span>
              <span className="text-xs font-medium text-gray-700 text-right">
                {DATE_KEYS.has(key) ? fmtDate(original[key] as string) : fmtVal(original[key])}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-green-200 bg-green-50/40 p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
          Revised Parameters
        </p>
        <div className="flex flex-col gap-2">
          {changedFields.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500 shrink-0">{label}</span>
              <span className="text-xs font-medium text-green-700 text-right">
                {DATE_KEYS.has(key) ? fmtDate(proposed[key] as string) : fmtVal(proposed[key])}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EndorsementCard({
  endorsement,
  placement,
}: {
  endorsement: PlacementEndorsement;
  placement: Facultative;
}) {
  const [cedantDocOpen, setCedantDocOpen] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('');
  const [reinsurerDocOpen, setReinsurerDocOpen] = useState(false);

  const { data: reinsurers = [] } = useReinsurers();

  const original = getSnapshotPlacement(endorsement.originalSnapshot);
  const proposed = endorsement.proposedSnapshot
    ? getSnapshotPlacement(endorsement.proposedSnapshot)
    : null;

  // Participants who have accepted / closed — these have a closing on the business
  const closingParticipants = placement.participants.filter(
    (p) => p.status === 'ACCEPTED' || p.status === 'CLOSED',
  );

  const reinsurerOptions = closingParticipants.map((p) => {
    const r = reinsurers.find((r) => r.id === p.counterpartyId);
    return { value: p.id, label: r?.name ?? p.counterpartyId };
  });

  const selectedParticipant = closingParticipants.find((p) => p.id === selectedParticipantId);
  const selectedReinsurer = reinsurers.find((r) => r.id === selectedParticipant?.counterpartyId);

  const handleSelectReinsurer = (id: string) => {
    setSelectedParticipantId(id);
    if (id) setReinsurerDocOpen(true);
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-5">
        {/* Header row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-900">
              {endorsement.endorsementNumber}
            </span>
            <Badge label={ENDORSEMENT_TYPE_LABELS[endorsement.type]} variant="neutral" />
            <span className="text-xs text-gray-400">{fmtDate(endorsement.effectiveDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setCedantDocOpen(true)}>
              Cedant Document
            </Button>
            <SearchSelect
              label=""
              placeholder="Reinsurer Document…"
              options={reinsurerOptions}
              value={selectedParticipantId}
              onChange={handleSelectReinsurer}
              size="sm"
            />
          </div>
        </div>

        {/* Reason */}
        {endorsement.reason && (
          <p className="text-sm text-gray-600 border-l-2 border-orange-300 pl-3">
            {endorsement.reason}
          </p>
        )}

        {/* Side-by-side parameter cards (changed fields only) */}
        {proposed && <ParameterCards original={original} proposed={proposed} />}
      </div>

      {/* Cedant document */}
      <EndorsementCertificateModal
        isOpen={cedantDocOpen}
        placement={placement}
        endorsement={endorsement}
        onPrint={() => setCedantDocOpen(false)}
        onClose={() => setCedantDocOpen(false)}
      />

      {/* Reinsurer document */}
      {selectedParticipant && selectedReinsurer && (
        <EndorsementReinsurerCertificateModal
          isOpen={reinsurerDocOpen}
          placement={placement}
          endorsement={endorsement}
          counterpartyId={selectedParticipant.counterpartyId}
          reinsurerName={selectedReinsurer.name}
          sharePercent={parseFloat(
            selectedParticipant.signedLinePercent ?? selectedParticipant.sharePercent ?? '0',
          )}
          brokerageFee={parseFloat(selectedParticipant.brokerageFee ?? '0')}
          onPrint={() => setReinsurerDocOpen(false)}
          onClose={() => setReinsurerDocOpen(false)}
        />
      )}
    </>
  );
}

export function EndorsementTab({ placement }: EndorsementTabProps) {
  const { data: endorsements = [], isLoading } = usePlacementEndorsements(placement.id);

  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-base font-semibold text-gray-900">Policy Endorsement</h3>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading endorsements…</p>
      ) : endorsements.length === 0 ? (
        <p className="text-sm text-gray-400">No endorsements have been made on this policy.</p>
      ) : (
        endorsements.map((e) => (
          <EndorsementCard key={e.id} endorsement={e} placement={placement} />
        ))
      )}
    </div>
  );
}
