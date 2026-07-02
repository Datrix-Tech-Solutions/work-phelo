'use client';

import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { PlacementNote, PlacementNoteType } from '@/types/reinsurance';

interface PlacementNotePreviewModalProps {
  isOpen: boolean;
  note: PlacementNote;
  onPrint: () => void;
  onClose: () => void;
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

function fmtDate(val: string | null | undefined) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: string | number | null | undefined, currency: string | null | undefined) {
  if (val == null) return '—';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (!Number.isFinite(n)) return '—';
  return `${currency ?? ''} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

function TableRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr className="border-b border-gray-100 last:border-b-0">
      <td className={`py-2 px-4 w-1/2 ${bold ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
        {label}
      </td>
      <td
        className={`py-2 px-4 text-right ${bold ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}
      >
        {value}
      </td>
    </tr>
  );
}

export function PlacementNotePreviewModal({
  isOpen,
  note,
  onPrint,
  onClose,
}: PlacementNotePreviewModalProps) {
  const documentTitle = noteTypeLabel(note.type);

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`${documentTitle} — ${note.noteNumber}`}
      documentTitle={documentTitle}
      onPrint={onPrint}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4 text-sm">
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
          Backend-backed note record. Lifecycle status: {note.status}. PDF generation/storage is not
          part of this preview action.
        </div>

        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs text-gray-400 uppercase tracking-wide">Note No.</span>
            <p className="font-semibold text-gray-900">{note.noteNumber}</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Date</span>
            <p className="font-semibold text-gray-900">{fmtDate(note.issuedAt ?? note.noteDate)}</p>
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Counterparty</span>
          <p className="font-semibold text-gray-900">{note.counterparty.name}</p>
          {note.counterparty.registrationNumber && (
            <p className="text-gray-500">{note.counterparty.registrationNumber}</p>
          )}
        </div>

        <table className="w-full border-collapse border border-gray-200 overflow-hidden text-sm">
          <tbody>
            <tr className="bg-blue-900">
              <td
                colSpan={2}
                className="py-2 px-4 text-center text-xs font-semibold text-gray-100 uppercase tracking-wide border-b border-blue-900"
              >
                Note Details
              </td>
            </tr>
            <TableRow label="Type" value={documentTitle} />
            <TableRow label="Direction" value={note.direction.replace(/_/g, ' ')} />
            <TableRow label="Status" value={note.status} />
            <TableRow
              label="Closing"
              value={note.closing?.closingNumber ?? note.endorsementClosing?.closingNumber ?? '—'}
            />
            <TableRow label="Currency" value={note.currency} />

            <tr className="bg-blue-900">
              <td
                colSpan={2}
                className="py-2 px-4 text-center text-xs font-semibold text-gray-100 uppercase tracking-wide border-y border-blue-900"
              >
                Amounts
              </td>
            </tr>
            <TableRow label="Gross Amount" value={fmtAmount(note.grossAmount, note.currency)} />
            <TableRow label="Commission" value={fmtAmount(note.commissionAmount, note.currency)} />
            <TableRow label="Brokerage" value={fmtAmount(note.brokerageAmount, note.currency)} />
            <TableRow label="NIC Levy" value={fmtAmount(note.nicLevyAmount, note.currency)} />
            <TableRow
              label="Withholding Tax"
              value={fmtAmount(note.withholdingTaxAmount, note.currency)}
            />
            <TableRow label="Net Amount" value={fmtAmount(note.netAmount, note.currency)} bold />
          </tbody>
        </table>
      </div>
    </DocumentPreviewModal>
  );
}
