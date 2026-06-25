'use client';

import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Icons } from '@/components/atoms/icons';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import {
  Facultative,
  PlacementEndorsement,
  ENDORSEMENT_TYPE_LABELS,
  ENDORSEMENT_STATUS_LABELS,
  ENDORSEMENT_STATUS_VARIANT,
} from '@/types/reinsurance';
import {
  useCedants,
  usePlacementEndorsements,
  usePlacementEndorsementParticipants,
  useCreateEndorsementParticipant,
  useUpdateParticipant,
  useReinsurers,
  useUpdateEndorsementStatus,
  facultativePlacementKey,
} from '@/hooks';
import { EditEndorsementPanel } from '@/components/organisms/reinsurance/panels/EditEndorsementPanel';
import { TableButton } from '@/components/atoms/TableButton';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { EndorsementCertificateModal } from '@/components/organisms/reinsurance/documents/EndorsementCertificateModal';
import { EndorsementReinsurerCertificateModal } from '@/components/organisms/reinsurance/documents/EndorsementReinsurerCertificateModal';

interface EndorsementTabProps {
  placement: Facultative;
}

const SEGMENT_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#84cc16',
  '#f59e0b',
  '#f97316',
  '#ec4899',
  '#06b6d4',
  '#10b981',
];

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

function getSnapshotParticipants(snapshot: Record<string, unknown>): Record<string, unknown>[] {
  const ps = snapshot.participants;
  return Array.isArray(ps) ? (ps as Record<string, unknown>[]) : [];
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

interface EndorsementParticipantRow {
  id: string;
  counterpartyId: string;
  reinsurerName: string;
  originalShare: number;
  brokerageFee: number;
}

function EndorsementCard({
  endorsement,
  placement,
}: {
  endorsement: PlacementEndorsement;
  placement: Facultative;
}) {
  const [cedantDocOpen, setCedantDocOpen] = useState(false);
  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const [participantsExpanded, setParticipantsExpanded] = useState(false);
  const participantsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!participantsExpanded) return;
    const id = setTimeout(() => {
      participantsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 650);
    return () => clearTimeout(id);
  }, [participantsExpanded]);
  const [revisedShares, setRevisedShares] = useState<Record<string, string>>({});
  const [busyEPIds, setBusyEPIds] = useState<Set<string>>(new Set());
  const [tableDocCounterpartyId, setTableDocCounterpartyId] = useState<string | null>(null);

  const { data: reinsurers = [] } = useReinsurers();
  const { data: cedants = [] } = useCedants();
  const fullCedant = cedants.find((c) => c.id === placement.cedant.id);
  const { mutate: updateStatus, isPending: isUpdatingStatus } = useUpdateEndorsementStatus(
    placement.id,
  );
  const { data: endorsementParticipants = [] } = usePlacementEndorsementParticipants(
    placement.id,
    endorsement.id,
  );
  const { mutateAsync: createEndorsementParticipant } = useCreateEndorsementParticipant(
    placement.id,
    endorsement.id,
  );
  const { mutateAsync: updateParticipant } = useUpdateParticipant(placement.id);
  const queryClient = useQueryClient();

  const original = getSnapshotPlacement(endorsement.originalSnapshot);
  const proposed = endorsement.proposedSnapshot
    ? getSnapshotPlacement(endorsement.proposedSnapshot)
    : null;

  const snapshotParticipants = getSnapshotParticipants(endorsement.originalSnapshot).filter(
    (p) => p.role === 'REINSURER' || p.role === 'LEAD_REINSURER' || p.role === 'CO_REINSURER',
  );

  const snapshotFacOffer = parseFloat(String(original.facultativeOffer ?? 0));
  const proposedFacOffer = proposed
    ? parseFloat(String(proposed.facultativeOffer ?? snapshotFacOffer))
    : snapshotFacOffer;
  const addedCapacity = Math.max(0, +(proposedFacOffer - snapshotFacOffer).toFixed(4));

  const exhaustedSnapshotParticipants = snapshotParticipants.filter((p) => {
    const s = String(p.status ?? '');
    return s === 'ACCEPTED' || s === 'CLOSED';
  });

  const snapshotPlacedPct = +exhaustedSnapshotParticipants
    .reduce((sum, p) => sum + parseFloat(String(p.signedLinePercent ?? p.sharePercent ?? '0')), 0)
    .toFixed(4);

  const endorsementBarTotal = +(snapshotPlacedPct + addedCapacity).toFixed(4);

  const snapColorMap = Object.fromEntries(
    snapshotParticipants.map((p, i) => [
      String(p.counterpartyId),
      SEGMENT_COLORS[i % SEGMENT_COLORS.length],
    ]),
  );

  const acceptedCounterpartyIds = new Set(
    endorsementParticipants
      .filter((p) => p.status === 'ACCEPTED' || p.status === 'CLOSED')
      .map((p) => p.counterpartyId),
  );

  const endorsementRows: EndorsementParticipantRow[] = snapshotParticipants.map((p) => {
    const r = reinsurers.find((r) => r.id === p.counterpartyId);
    const cid = String(p.counterpartyId);
    return {
      id: cid,
      counterpartyId: cid,
      reinsurerName: r?.name ?? cid,
      originalShare: parseFloat(String(p.signedLinePercent ?? p.sharePercent ?? '0')),
      brokerageFee: parseFloat(String(p.brokerageFee ?? '0')),
    };
  });

  const handleAcceptEndorsement = async (row: EndorsementParticipantRow) => {
    setBusyEPIds((prev) => new Set([...prev, row.counterpartyId]));
    try {
      const revised = parseFloat(revisedShares[row.counterpartyId] ?? String(row.originalShare));
      const share = isNaN(revised) ? row.originalShare : revised;

      const originalParticipant = placement.participants.find(
        (p) => p.counterpartyId === row.counterpartyId,
      );

      await createEndorsementParticipant({
        counterpartyId: row.counterpartyId,
        originalParticipantId: originalParticipant?.id,
        sharePercent: share,
        signedLinePercent: share,
        status: 'ACCEPTED',
      });

      if (originalParticipant) {
        await updateParticipant({
          participantId: originalParticipant.id,
          signedLinePercent: share,
        });
      }

      await queryClient.invalidateQueries({ queryKey: facultativePlacementKey(placement.id) });
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    } finally {
      setBusyEPIds((prev) => {
        const n = new Set(prev);
        n.delete(row.counterpartyId);
        return n;
      });
    }
  };

  const epColumns: Column<EndorsementParticipantRow>[] = [
    {
      key: 'reinsurerName',
      label: 'Reinsurer',
      width: '2fr',
      render: (row) => <span className="font-medium text-gray-900">{row.reinsurerName}</span>,
    },
    {
      key: 'originalShare',
      label: 'Original Share (%)',
      width: '1fr',
      render: (row) => <span className="text-gray-700">{row.originalShare}%</span>,
    },
    {
      key: 'brokerageFee',
      label: 'Brokerage (%)',
      width: '1fr',
      render: (row) => <span className="text-gray-700">{row.brokerageFee}%</span>,
    },
    {
      key: 'counterpartyId',
      label: 'Revised (%)',
      width: '1fr',
      render: (row) => {
        const isAccepted = acceptedCounterpartyIds.has(row.counterpartyId);
        if (isAccepted) {
          const ep = endorsementParticipants.find((p) => p.counterpartyId === row.counterpartyId);
          return (
            <span className="text-gray-700">
              {parseFloat(ep?.signedLinePercent ?? ep?.sharePercent ?? String(row.originalShare))}%
            </span>
          );
        }
        return (
          <input
            type="number"
            min={0}
            max={100}
            value={revisedShares[row.counterpartyId] ?? String(row.originalShare)}
            onChange={(e) =>
              setRevisedShares((prev) => ({
                ...prev,
                [row.counterpartyId]: e.target.value,
              }))
            }
            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:border-brand"
          />
        );
      },
    },
    {
      key: 'netPremium' as unknown as keyof EndorsementParticipantRow,
      label: 'Net Premium',
      width: '1.2fr',
      render: (row) => {
        const ep = endorsementParticipants.find((p) => p.counterpartyId === row.counterpartyId);
        const effectiveShare = acceptedCounterpartyIds.has(row.counterpartyId)
          ? parseFloat(ep?.signedLinePercent ?? ep?.sharePercent ?? String(row.originalShare))
          : parseFloat(revisedShares[row.counterpartyId] ?? String(row.originalShare));
        const premium = placement.premium ?? 0;
        const netPremium = (effectiveShare / 100) * premium;
        return (
          <span className="text-gray-700">
            {placement.currency ? `${placement.currency} ` : ''}
            {netPremium.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        );
      },
    },
    {
      key: 'id' as keyof EndorsementParticipantRow,
      label: 'Actions',
      width: '130px',
      render: (row) => {
        const isAccepted = acceptedCounterpartyIds.has(row.counterpartyId);
        const isBusy = busyEPIds.has(row.counterpartyId);
        if (isAccepted) {
          return (
            <TableButton
              variant="blue"
              onClick={() => setTableDocCounterpartyId(row.counterpartyId)}
            >
              View Document
            </TableButton>
          );
        }
        return (
          <TableButton isLoading={isBusy} onClick={() => handleAcceptEndorsement(row)}>
            Accept
          </TableButton>
        );
      },
    },
  ];

  const tableDocEP = endorsementParticipants.find(
    (p) => p.counterpartyId === tableDocCounterpartyId,
  );
  const tableDocReinsurer = reinsurers.find((r) => r.id === tableDocCounterpartyId);
  const tableDocRow = endorsementRows.find((r) => r.counterpartyId === tableDocCounterpartyId);

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
            <Badge
              label={ENDORSEMENT_STATUS_LABELS[endorsement.status]}
              variant={ENDORSEMENT_STATUS_VARIANT[endorsement.status]}
            />
            <span className="text-xs text-gray-400">{fmtDate(endorsement.effectiveDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            {endorsement.status === 'DRAFT' && (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditPanelOpen(true)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  isLoading={isUpdatingStatus}
                  onClick={() => {
                    updateStatus({ endorsementId: endorsement.id, status: 'MARKETING' });
                    setParticipantsExpanded(true);
                  }}
                >
                  Send to Market
                </Button>
              </>
            )}
            {endorsement.status !== 'DRAFT' && (
              <Button size="sm" variant="secondary" onClick={() => setCedantDocOpen(true)}>
                Cedant Document
              </Button>
            )}
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

        {/* Participants toggle */}
        {endorsement.status !== 'DRAFT' && endorsementRows.length > 0 && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setParticipantsExpanded((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 transition-colors w-fit"
            >
              <Icons.ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-600 ${!participantsExpanded ? '-rotate-90' : ''}`}
              />
              Participants at Endorsement ({endorsementRows.length})
            </button>

            <div
              ref={participantsRef}
              className="grid transition-[grid-template-rows] duration-600 ease-in-out"
              style={{ gridTemplateRows: participantsExpanded ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden flex flex-col gap-4">
                {/* Snapshot capacity bar — accepted + added capacity */}
                {endorsementBarTotal > 0 && (
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="flex items-center justify-between text-xs font-medium text-gray-500">
                      <span>Accepted Capacity at Endorsement</span>
                      <span>
                        <span className="text-gray-700">{snapshotPlacedPct}%</span>
                        {addedCapacity > 0 && (
                          <>
                            <span className="text-gray-400"> + {addedCapacity}% new</span>
                            <span className="text-gray-400"> / {endorsementBarTotal}%</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
                      {exhaustedSnapshotParticipants.map((p, i) => {
                        const cid = String(p.counterpartyId);
                        const share = parseFloat(
                          String(p.signedLinePercent ?? p.sharePercent ?? '0'),
                        );
                        return (
                          <div
                            key={i}
                            style={{
                              width: `${(share / endorsementBarTotal) * 100}%`,
                              backgroundColor: snapColorMap[cid],
                            }}
                            className="h-full transition-all duration-500"
                          />
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {exhaustedSnapshotParticipants.map((p) => {
                        const cid = String(p.counterpartyId);
                        const r = reinsurers.find((r) => r.id === cid);
                        const share = parseFloat(
                          String(p.signedLinePercent ?? p.sharePercent ?? '0'),
                        );
                        return (
                          <div key={cid} className="flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: snapColorMap[cid] }}
                            />
                            <span
                              className="text-xs font-medium"
                              style={{ color: snapColorMap[cid] }}
                            >
                              {r?.name ?? cid}
                              <span className="text-gray-400 font-normal"> · {share}%</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <DataTable
                  columns={epColumns}
                  data={endorsementRows}
                  emptyMessage="No participants recorded"
                  currentPage={1}
                  totalPages={1}
                  onPageChange={() => {}}
                  noInternalScroll
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <EditEndorsementPanel
        isOpen={editPanelOpen}
        placement={placement}
        endorsement={endorsement}
        onClose={() => setEditPanelOpen(false)}
      />

      {/* Cedant document */}
      <EndorsementCertificateModal
        isOpen={cedantDocOpen}
        placement={placement}
        endorsement={endorsement}
        cedant={fullCedant}
        onPrint={() => setCedantDocOpen(false)}
        onClose={() => setCedantDocOpen(false)}
      />

      {/* Reinsurer document (via table View Document) */}
      {tableDocCounterpartyId && tableDocReinsurer && tableDocRow && (
        <EndorsementReinsurerCertificateModal
          isOpen={!!tableDocCounterpartyId}
          placement={placement}
          endorsement={endorsement}
          counterpartyId={tableDocCounterpartyId}
          reinsurerName={tableDocReinsurer.name}
          sharePercent={parseFloat(
            tableDocEP?.signedLinePercent ??
              tableDocEP?.sharePercent ??
              String(tableDocRow.originalShare),
          )}
          brokerageFee={tableDocRow.brokerageFee}
          onPrint={() => setTableDocCounterpartyId(null)}
          onClose={() => setTableDocCounterpartyId(null)}
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
