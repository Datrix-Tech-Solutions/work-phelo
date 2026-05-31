'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { Icons } from '@/components/atoms/icons';

export type DistributionStatus = 'Pending' | 'Accepted' | 'Declined';

export interface DistributionEntry {
  id: string;
  reinsurerCompany: string;
  shareLine: number;
  status: DistributionStatus;
}

export const INITIAL_DISTRIBUTION_ENTRIES: DistributionEntry[] = [
  { id: '1', reinsurerCompany: 'Swiss Re', shareLine: 0, status: 'Pending' },
  { id: '2', reinsurerCompany: 'Munich Re', shareLine: 0, status: 'Pending' },
  { id: '3', reinsurerCompany: 'Hannover Re', shareLine: 0, status: 'Pending' },
];

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
  onEntriesChange: (entries: DistributionEntry[]) => void;
  facPremium: number;
  onDelete?: (row: DistributionEntry) => void;
}

export function DistributionTable({
  entries,
  onEntriesChange,
  facPremium,
  onDelete,
}: DistributionTableProps) {
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftShare, setDraftShare] = useState('');

  const updateEntry = (id: string, patch: Partial<DistributionEntry>) =>
    onEntriesChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const startEdit = (row: DistributionEntry) => {
    setEditingId(row.id);
    setDraftShare(String(row.shareLine));
  };

  const commitEdit = (id: string) => {
    const parsed = parseFloat(draftShare);
    if (!isNaN(parsed)) {
      updateEntry(id, { shareLine: Math.min(100, Math.max(0, parsed)), status: 'Pending' });
      setRespondedIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
    setEditingId(null);
    setDraftShare('');
  };

  const handleAccept = (id: string) => {
    updateEntry(id, { status: 'Accepted' });
    setRespondedIds((prev) => new Set([...prev, id]));
  };

  const handleDecline = (id: string) => {
    updateEntry(id, { status: 'Declined', shareLine: 0 });
    setRespondedIds((prev) => new Set([...prev, id]));
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
      label: 'Share Line (%)',
      width: '1fr',
      render: (row) =>
        editingId === row.id ? (
          <input
            type="number"
            min={0}
            max={100}
            value={draftShare}
            onChange={(e) => setDraftShare(e.target.value)}
            onBlur={() => commitEdit(row.id)}
            onKeyDown={(e) => e.key === 'Enter' && commitEdit(row.id)}
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
      key: 'premiumShare',
      label: 'Premium Share',
      width: '1.2fr',
      render: (row) => (
        <span className="text-gray-700">{fmtAmount((row.shareLine / 100) * facPremium)}</span>
      ),
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
      width: '110px',
      render: (row) => {
        const responded = respondedIds.has(row.id);
        return (
          <div className="flex items-center gap-2">
            {responded ? (
              <>
                <button
                  type="button"
                  title="Send mail"
                  className="text-blue-500 hover:text-blue-600 transition-colors"
                >
                  <Icons.Mail className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Delete"
                  onClick={() => onDelete?.(row)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <Icons.Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  title="Accept"
                  onClick={() => handleAccept(row.id)}
                  className="text-green-500 hover:text-green-600 transition-colors"
                >
                  <Icons.Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Decline"
                  onClick={() => handleDecline(row.id)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <Icons.X className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Delete"
                  onClick={() => onDelete?.(row)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <Icons.Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={entries}
      emptyMessage="No distribution entries yet"
      currentPage={1}
      totalPages={1}
      onPageChange={() => {}}
      noInternalScroll
    />
  );
}
