'use client';

import { useState } from 'react';
import { DataTable } from '@/components/organisms/shared/DataTable';
import type { Column, RowAction } from '@/components/organisms/shared/DataTable';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { PlacementNotePreviewModal } from '@/components/organisms/reinsurance/documents/PlacementNotePreviewModal';
import { PlacementNote, PlacementNoteStatus, PlacementNoteType } from '@/types/reinsurance';

interface NoteRow {
  id: string;
  note: PlacementNote;
}

interface ReinsuranceNotesTableProps {
  notes: PlacementNote[];
  isLoading?: boolean;
  isError?: boolean;
  emptyMessage?: string;
  onIssue: (noteId: string) => void;
  onVoid: (input: { noteId: string; voidReason: string }) => void;
  isVoidPending?: boolean;
}

function parseAmount(val: string | number | null | undefined) {
  if (val == null) return 0;
  const amount = typeof val === 'number' ? val : parseFloat(val);
  return Number.isFinite(amount) ? amount : 0;
}

function fmtAmount(val: number, currency: string | null) {
  return `${currency ?? ''} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

function fmtDate(val: string | null) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function noteTypeLabel(type: PlacementNoteType) {
  switch (type) {
    case 'DEBIT_NOTE':
      return 'Debit Note';
    case 'CREDIT_NOTE':
      return 'Credit Note';
    case 'ENDORSEMENT_DEBIT_NOTE':
      return 'Endorsement Debit Note';
    case 'ENDORSEMENT_CREDIT_NOTE':
      return 'Endorsement Credit Note';
    default:
      return type;
  }
}

function noteStatusClass(status: PlacementNoteStatus) {
  switch (status) {
    case 'ISSUED':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'VOID':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200';
  }
}

export function ReinsuranceNotesTable({
  notes,
  isLoading,
  isError,
  emptyMessage = 'No notes yet',
  onIssue,
  onVoid,
  isVoidPending,
}: ReinsuranceNotesTableProps) {
  const [voidTarget, setVoidTarget] = useState<PlacementNote | null>(null);
  const [previewTarget, setPreviewTarget] = useState<PlacementNote | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const noteRows: NoteRow[] = notes.map((note) => ({ id: note.id, note }));

  const columns: Column<NoteRow>[] = [
    {
      key: 'noteNumber',
      label: 'Note No.',
      width: '1fr',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-gray-900">{row.note.noteNumber}</span>
          <span className="w-fit rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-green-700">
            Backend saved
          </span>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      width: '1fr',
      render: (row) => <span className="text-gray-700">{noteTypeLabel(row.note.type)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '1fr',
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${noteStatusClass(
            row.note.status,
          )}`}
        >
          {row.note.status}
        </span>
      ),
    },
    {
      key: 'issueDate',
      label: 'Issue Date',
      width: '1fr',
      render: (row) => (
        <span className="text-gray-700">{fmtDate(row.note.issuedAt ?? row.note.noteDate)}</span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      width: '1fr',
      render: (row) => (
        <span className="text-gray-700">
          {fmtAmount(parseAmount(row.note.grossAmount), row.note.currency)}
        </span>
      ),
    },
    {
      key: 'counterparty',
      label: 'Counterparty',
      width: '1.5fr',
      render: (row) => <span className="text-gray-700">{row.note.counterparty.name}</span>,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={noteRows}
        isLoading={isLoading}
        emptyMessage={isError ? 'Unable to load notes' : emptyMessage}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
        rowActions={(row) => {
          const actions: RowAction[] = [
            {
              label: 'Preview',
              onClick: () => setPreviewTarget(row.note),
            },
          ];
          if (row.note.status === 'DRAFT') {
            actions.push({
              label: 'Issue',
              onClick: () => onIssue(row.note.id),
            });
          }
          if (row.note.status !== 'VOID') {
            actions.push({
              label: 'Void',
              danger: true,
              onClick: () => {
                setVoidTarget(row.note);
                setVoidReason('');
              },
            });
          }
          return actions;
        }}
      />

      <Modal
        isOpen={!!voidTarget}
        onClose={() => {
          setVoidTarget(null);
          setVoidReason('');
        }}
        title="Void note"
        description="Provide a reason before voiding this note. Voided notes remain available for audit."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setVoidTarget(null);
                setVoidReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isVoidPending}
              onClick={() => {
                if (!voidTarget) return;
                onVoid({ noteId: voidTarget.id, voidReason: voidReason.trim() });
                setVoidTarget(null);
                setVoidReason('');
              }}
              disabled={!voidReason.trim()}
            >
              Void Note
            </Button>
          </>
        }
      >
        <textarea
          value={voidReason}
          onChange={(event) => setVoidReason(event.target.value)}
          placeholder="Reason for voiding this note"
          className="mt-4 min-h-28 w-full rounded-input border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-gray-400"
        />
      </Modal>

      {previewTarget && (
        <PlacementNotePreviewModal
          isOpen
          note={previewTarget}
          onPrint={() => setPreviewTarget(null)}
          onClose={() => setPreviewTarget(null)}
        />
      )}
    </>
  );
}
