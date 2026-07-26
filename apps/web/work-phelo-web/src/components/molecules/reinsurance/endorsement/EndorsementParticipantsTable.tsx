'use client';

import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';
import { TableButton } from '@/components/atoms/TableButton';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import {
  EndorsementParticipantClosing,
  PlacementDocument,
  PlacementEndorsementParticipant,
  PlacementNote,
} from '@/types/reinsurance';
import { EndorsementParticipantRow } from './types';

interface EndorsementParticipantsTableProps {
  rows: EndorsementParticipantRow[];
  endorsementParticipants: PlacementEndorsementParticipant[];
  acceptedCounterpartyIds: Set<string>;
  confirmedClosingByEndorsementParticipantId: Record<string, EndorsementParticipantClosing>;
  findEndorsementCreditNote: (closingId: string) => PlacementNote | undefined;
  findCertificateDocument: (closingId: string) => PlacementDocument | undefined;
  busyEPIds: Set<string>;
  mailedIds: Set<string>;
  revisedShares: Record<string, string>;
  onRevisedShareChange: (counterpartyId: string, value: string) => void;
  onAddParticipant: () => void;
  onPreviewMarketDocument: (row: EndorsementParticipantRow) => void;
  onMailReinsurer: (counterpartyId: string) => void;
  onAccept: (row: EndorsementParticipantRow) => void;
  onReject: (row: EndorsementParticipantRow) => void;
  onValidate: (row: EndorsementParticipantRow) => void;
  onViewClosing: (closing: EndorsementParticipantClosing) => void;
  onViewCreditNote: (note: PlacementNote) => void;
  onViewCertificate: (document: PlacementDocument) => void;
}

export function EndorsementParticipantsTable({
  rows,
  endorsementParticipants,
  acceptedCounterpartyIds,
  confirmedClosingByEndorsementParticipantId,
  findEndorsementCreditNote,
  findCertificateDocument,
  busyEPIds,
  mailedIds,
  revisedShares,
  onRevisedShareChange,
  onAddParticipant,
  onPreviewMarketDocument,
  onMailReinsurer,
  onAccept,
  onReject,
  onValidate,
  onViewClosing,
  onViewCreditNote,
  onViewCertificate,
}: EndorsementParticipantsTableProps) {
  const columns: Column<EndorsementParticipantRow>[] = [
    {
      key: 'reinsurerName',
      label: 'Reinsurer',
      width: 'minmax(200px, 1fr)',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-gray-900">{row.reinsurerName}</span>
          <Badge label={row.isNew ? 'Added' : 'Revised'} variant="neutral" />
        </div>
      ),
    },
    {
      key: 'originalShare',
      label: 'Original',
      width: '150px',
      render: (row) => (
        <span className="text-gray-700">{row.isNew ? '—' : `${row.originalShare}%`}</span>
      ),
    },
    {
      key: 'counterpartyId',
      label: 'Revised',
      width: '150px',
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
            value={revisedShares[row.counterpartyId] ?? String(row.offeredShare)}
            onChange={(e) => onRevisedShareChange(row.counterpartyId, e.target.value)}
            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:border-brand"
          />
        );
      },
    },
    {
      key: 'netPremium' as unknown as keyof EndorsementParticipantRow,
      label: 'Net Premium',
      width: 'minmax(150px, 1fr)',
      render: (row) => {
        const confirmedClosing = row.participantId
          ? confirmedClosingByEndorsementParticipantId[row.participantId]
          : undefined;
        if (!confirmedClosing) {
          return <span className="text-xs text-gray-400">Pending Validation</span>;
        }
        const netPremium =
          confirmedClosing.netPremium === null ? null : Number(confirmedClosing.netPremium);
        return (
          <span className="text-gray-700">
            {confirmedClosing.currency ? `${confirmedClosing.currency} ` : ''}
            {netPremium !== null && Number.isFinite(netPremium)
              ? netPremium.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : '—'}
          </span>
        );
      },
    },
    {
      key: 'response' as unknown as keyof EndorsementParticipantRow,
      label: 'Response',
      width: '150px',
      render: (row) => {
        const endorsementParticipant = endorsementParticipants.find(
          (item) => item.id === row.participantId || item.counterpartyId === row.counterpartyId,
        );
        if (endorsementParticipant?.status === 'DECLINED') {
          return <Badge label="Declined" variant="danger" />;
        }
        if (
          endorsementParticipant?.status === 'ACCEPTED' ||
          endorsementParticipant?.status === 'CLOSED'
        ) {
          return <Badge label="Accepted" variant="success" />;
        }
        if (endorsementParticipant?.status === 'OFFER_SENT') {
          return <Badge label="Sent" variant="warning" />;
        }
        return <span className="text-xs text-gray-400">Pending</span>;
      },
    },
    {
      key: 'id' as keyof EndorsementParticipantRow,
      label: 'Actions',
      width: 'minmax(200px, 1fr)',
      render: (row) => {
        const endorsementParticipant = endorsementParticipants.find(
          (item) => item.id === row.participantId || item.counterpartyId === row.counterpartyId,
        );
        const isAccepted =
          endorsementParticipant?.status === 'ACCEPTED' ||
          endorsementParticipant?.status === 'CLOSED';
        const isDeclined = endorsementParticipant?.status === 'DECLINED';
        const isValidated = row.participantId
          ? Boolean(confirmedClosingByEndorsementParticipantId[row.participantId])
          : false;
        const confirmedClosing = row.participantId
          ? confirmedClosingByEndorsementParticipantId[row.participantId]
          : undefined;
        const creditNote = confirmedClosing ? findEndorsementCreditNote(confirmedClosing.id) : null;
        const certificateDocument = confirmedClosing
          ? findCertificateDocument(confirmedClosing.id)
          : null;
        const isBusy = busyEPIds.has(row.counterpartyId);
        const mailed = mailedIds.has(row.counterpartyId);

        if (confirmedClosing) {
          return (
            <div className="flex flex-wrap items-center gap-2">
              <TableButton variant="gray" onClick={() => onViewClosing(confirmedClosing)}>
                View Closing
              </TableButton>
              {creditNote && (
                <TableButton variant="gray" onClick={() => onViewCreditNote(creditNote)}>
                  Credit Note
                </TableButton>
              )}
              {certificateDocument && (
                <TableButton variant="blue" onClick={() => onViewCertificate(certificateDocument)}>
                  Certificate
                </TableButton>
              )}
            </div>
          );
        }

        if (row.isNew) {
          const responded = isAccepted || isDeclined;
          return (
            <div className="flex items-center gap-2">
              <TableButton variant="gray" onClick={() => onPreviewMarketDocument(row)}>
                Offer Slip
              </TableButton>
              <button
                type="button"
                title="Share"
                onClick={() => onMailReinsurer(row.counterpartyId)}
                className="text-green-500 hover:text-green-700 transition-colors"
              >
                <Icons.Mail className="w-4 h-4" />
              </button>
              {mailed && !responded && (
                <button
                  type="button"
                  title={isBusy ? 'Accepting...' : 'Accept'}
                  onClick={() => {
                    if (!isBusy) onAccept(row);
                  }}
                  disabled={isBusy}
                  className={`text-green-500 hover:text-green-600 transition-colors ${isBusy ? 'opacity-50 cursor-wait' : ''}`}
                >
                  <Icons.Check className="w-4 h-4" />
                </button>
              )}
              {mailed && !responded && (
                <button
                  type="button"
                  title="Reject"
                  onClick={() => onReject(row)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <Icons.X className="w-4 h-4" />
                </button>
              )}
              {isDeclined && <Badge label="Declined" variant="danger" />}
              {isAccepted &&
                (isValidated ? (
                  <Badge label="Confirmed" variant="success" />
                ) : (
                  <TableButton
                    isLoading={isBusy}
                    tooltip="Validate endorsement closing"
                    onClick={() => {
                      if (!isBusy) onValidate(row);
                    }}
                  >
                    Validate
                  </TableButton>
                ))}
            </div>
          );
        }

        if (isAccepted) {
          return (
            <div className="flex items-center gap-2">
              <TableButton variant="gray" onClick={() => onPreviewMarketDocument(row)}>
                Revised Offer
              </TableButton>
              {isValidated ? (
                <Badge label="Confirmed" variant="success" />
              ) : (
                <TableButton
                  isLoading={isBusy}
                  tooltip="Validate endorsement closing"
                  onClick={() => {
                    if (!isBusy) onValidate(row);
                  }}
                >
                  Validate
                </TableButton>
              )}
            </div>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <TableButton variant="gray" onClick={() => onPreviewMarketDocument(row)}>
              Revised Offer
            </TableButton>
            <button
              type="button"
              title="Send Endorsement Email"
              onClick={() => onMailReinsurer(row.counterpartyId)}
              className="text-green-500 hover:text-green-700 transition-colors"
            >
              <Icons.Mail className="w-4 h-4" />
            </button>
            {isDeclined && <Badge label="Declined" variant="danger" />}
            {mailed && (
              <button
                type="button"
                title={isBusy ? 'Accepting...' : 'Accept'}
                onClick={() => {
                  if (!isBusy) onAccept(row);
                }}
                disabled={isBusy}
                className={`text-green-500 hover:text-green-600 transition-colors ${isBusy ? 'opacity-50 cursor-wait' : ''}`}
              >
                <Icons.Check className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Market / Reinsurers
          </p>
          <p className="text-xs text-gray-400">
            One row follows each reinsurer from offer through confirmed endorsement closing.
          </p>
        </div>
        <Button size="sm" onClick={onAddParticipant}>
          Add Endorsement Participant
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="No endorsement reinsurers recorded"
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
      />
    </section>
  );
}
