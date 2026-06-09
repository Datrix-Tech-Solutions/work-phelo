'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { Icons } from '@/components/atoms/icons';
import { MailPreviewModal } from '@/components/organisms/reinsurance/MailPreviewModal';
import { Facultative } from '@/types/reinsurance';
import { SlipPreviewModal } from '@/components/organisms/reinsurance/documents/SlipPreviewModal';

export type DistributionStatus = 'Pending' | 'Accepted' | 'Declined';

export interface DistributionEntry {
  id: string; // participant record ID
  counterpartyId: string;
  reinsurerCompany: string;
  emails: string[];
  shareLine: number;
  brokerageFee: number;
  status: DistributionStatus;
}

const STATUS_VARIANT: Record<DistributionStatus, 'warning' | 'success' | 'danger'> = {
  Pending: 'warning',
  Accepted: 'success',
  Declined: 'danger',
};

function fmtAmount(val: number) {
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface DistributionTableProps {
  entries: DistributionEntry[];
  premium: number;
  placement: Facultative;
  hasActiveEndorsement?: boolean;
  confirmedCounterpartyIds?: Set<string>;
  onShareCommit: (row: DistributionEntry, share: number) => void;
  onBrokerageCommit: (row: DistributionEntry, brokerage: number) => void;
  onMailSent: (row: DistributionEntry) => void;
  onAccept: (row: DistributionEntry) => void;
  onDecline: (row: DistributionEntry) => void;
  onDelete?: (row: DistributionEntry) => void;
}

export function DistributionTable({
  entries,
  premium,
  placement,
  hasActiveEndorsement = false,
  confirmedCounterpartyIds,
  onShareCommit,
  onBrokerageCommit,
  onMailSent,
  onAccept,
  onDecline,
  onDelete,
}: DistributionTableProps) {
  const [mailedIds, setMailedIds] = useState<Set<string>>(new Set());
  const [reconfirmedIds, setReconfirmedIds] = useState<Set<string>>(new Set());
  const [mailPreviewId, setMailPreviewId] = useState<string | null>(null);
  const [slipPreviewId, setSlipPreviewId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftShare, setDraftShare] = useState('');
  const [editingBrokerageId, setEditingBrokerageId] = useState<string | null>(null);
  const [draftBrokerage, setDraftBrokerage] = useState('');

  const startEdit = (row: DistributionEntry) => {
    setEditingId(row.id);
    setDraftShare(String(row.shareLine));
  };

  const commitEdit = (row: DistributionEntry) => {
    const parsed = parseFloat(draftShare);
    if (!isNaN(parsed)) {
      onShareCommit(row, Math.min(100, Math.max(0, parsed)));
    }
    setEditingId(null);
    setDraftShare('');
  };

  const startEditBrokerage = (row: DistributionEntry) => {
    setEditingBrokerageId(row.id);
    setDraftBrokerage(String(row.brokerageFee));
  };

  const commitBrokerage = (row: DistributionEntry) => {
    const parsed = parseFloat(draftBrokerage);
    if (!isNaN(parsed)) onBrokerageCommit(row, Math.min(100, Math.max(0, parsed)));
    setEditingBrokerageId(null);
    setDraftBrokerage('');
  };

  const handleSend = () => {
    if (!mailPreviewId) return;
    const row = entries.find((e) => e.id === mailPreviewId);
    if (row) onMailSent(row);
    setMailedIds((prev) => new Set([...prev, mailPreviewId]));
    setMailPreviewId(null);
  };

  const handleAccept = (row: DistributionEntry) => {
    onAccept(row);
    setReconfirmedIds((prev) => new Set([...prev, row.id]));
    setMailedIds((prev) => {
      const n = new Set(prev);
      n.delete(row.id);
      return n;
    });
  };

  const handleDecline = (row: DistributionEntry) => {
    onDecline(row);
    setMailedIds((prev) => {
      const n = new Set(prev);
      n.delete(row.id);
      return n;
    });
  };

  const columns: Column<DistributionEntry>[] = [
    {
      key: 'reinsurerCompany',
      label: 'Reinsurer Company',
      width: '1.8fr',
      render: (row) => <span className="font-medium text-gray-900">{row.reinsurerCompany}</span>,
    },
    {
      key: 'shareLine',
      label: 'Participant Share (%)',
      width: '1fr',
      render: (row) =>
        editingId === row.id ? (
          <input
            type="number"
            min={0}
            max={100}
            value={draftShare}
            onChange={(e) => setDraftShare(e.target.value)}
            onBlur={() => commitEdit(row)}
            onKeyDown={(e) => e.key === 'Enter' && commitEdit(row)}
            autoFocus
            className="w-20 px-2 py-1 text-sm border border-brand ring-1 ring-brand/20 rounded-input bg-white focus:outline-none text-gray-900"
          />
        ) : (
          <button
            type="button"
            onClick={() => startEdit(row)}
            className="w-20 flex items-center justify-between px-2 py-1 text-sm border border-gray-300 rounded-input bg-white text-gray-700 hover:border-brand transition-colors"
          >
            <span>{row.shareLine}%</span>
            <Icons.Pencil className="w-3 h-3 text-gray-400 shrink-0" />
          </button>
        ),
    },
    {
      key: 'brokerageFee',
      label: 'Brokerage Fee (%)',
      width: '1fr',
      render: (row) =>
        editingBrokerageId === row.id ? (
          <input
            type="number"
            min={0}
            max={100}
            value={draftBrokerage}
            onChange={(e) => setDraftBrokerage(e.target.value)}
            onBlur={() => commitBrokerage(row)}
            onKeyDown={(e) => e.key === 'Enter' && commitBrokerage(row)}
            autoFocus
            className="w-20 px-2 py-1 text-sm border border-brand ring-1 ring-brand/20 rounded-input bg-white focus:outline-none text-gray-900"
          />
        ) : (
          <button
            type="button"
            onClick={() => startEditBrokerage(row)}
            className="w-20 flex items-center justify-between px-2 py-1 text-sm border border-gray-300 rounded-input bg-white text-gray-700 hover:border-brand transition-colors"
          >
            <span>{row.brokerageFee}%</span>
            <Icons.Pencil className="w-3 h-3 text-gray-400 shrink-0" />
          </button>
        ),
    },
    {
      key: 'premiumShare',
      label: 'Premium Share',
      width: '1.2fr',
      render: (row) => (
        <span className="text-gray-700">{fmtAmount((row.shareLine / 100) * premium)}</span>
      ),
    },
    {
      key: 'brokerageAmount',
      label: 'Brokerage Amount',
      width: '1.2fr',
      render: (row) => {
        const premiumShare = (row.shareLine / 100) * premium;
        return (
          <span className="text-gray-700">
            {fmtAmount((row.brokerageFee / 100) * premiumShare)}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      width: '110px',
      render: (row) => <Badge label={row.status} variant={STATUS_VARIANT[row.status]} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '150px',
      render: (row) => {
        const mailed = mailedIds.has(row.id);
        // Server state (persists across navigation) takes priority; session state gives instant feedback
        const hasReconfirmed =
          confirmedCounterpartyIds?.has(row.counterpartyId) ?? reconfirmedIds.has(row.id);
        const responded = row.status === 'Declined' || row.status === 'Accepted';
        // In endorsement mode, accepted participants re-confirm (no decline allowed)
        const isReconfirming = hasActiveEndorsement && row.status === 'Accepted' && !hasReconfirmed;
        const showAccept = isReconfirming || (mailed && !responded);
        const showDecline = !isReconfirming && mailed && !responded;
        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Preview Slip"
              onClick={() => setSlipPreviewId(row.id)}
              className="text-blue-500 hover:text-blue-600 transition-colors"
            >
              <Icons.Eye className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Send mail"
              onClick={() => setMailPreviewId(row.id)}
              className="text-green-500 hover:text-green-700 transition-colors"
            >
              <Icons.Mail className="w-4 h-4" />
            </button>
            {showAccept && (
              <button
                type="button"
                title="Accept"
                onClick={() => handleAccept(row)}
                className="text-green-500 hover:text-green-600 transition-colors"
              >
                <Icons.Check className="w-4 h-4" />
              </button>
            )}
            {showDecline && (
              <button
                type="button"
                title="Decline"
                onClick={() => handleDecline(row)}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <Icons.X className="w-4 h-4" />
              </button>
            )}
            {!responded && (
              <button
                type="button"
                title="Delete"
                onClick={() => onDelete?.(row)}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <Icons.Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const mailPreviewEntry = entries.find((e) => e.id === mailPreviewId);
  const slipPreviewEntry = entries.find((e) => e.id === slipPreviewId);

  return (
    <>
      <DataTable
        columns={columns}
        data={entries}
        emptyMessage="No distribution entries yet"
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
      />

      <MailPreviewModal
        key={mailPreviewId ?? ''}
        isOpen={!!mailPreviewId}
        placement={placement}
        brokerageFee={mailPreviewEntry?.brokerageFee ?? 0}
        recipients={mailPreviewEntry?.emails ?? []}
        onSend={handleSend}
        onClose={() => setMailPreviewId(null)}
      />

      <SlipPreviewModal
        isOpen={!!slipPreviewId}
        placement={placement}
        brokerageFee={slipPreviewEntry?.brokerageFee ?? 0}
        onPrint={() => setSlipPreviewId(null)}
        onClose={() => setSlipPreviewId(null)}
      />
    </>
  );
}
