'use client';

import {
  formatDocumentAmount,
  formatDocumentDate,
  type TradeDocumentData,
} from '@/lib/accounting/documents';

const ACCENT = '#3b4a7a';
/** The item table always shows at least this many rows so a short bill still reads as a form. */
const MIN_TABLE_ROWS = 10;
const COMPACT_MIN_TABLE_ROWS = 4;

const WATERMARK_TEXT: Partial<Record<TradeDocumentData['status'], string>> = {
  DRAFT: 'DRAFT',
  REVERSED: 'REVERSED',
};

/** A4 bill for a real transaction. The company letterhead is intentionally absent — the
 *  document template supplies it. Text scales with the sheet width through a container
 *  query. */
export function BillDocument({ data }: { data: TradeDocumentData }) {
  const watermark = WATERMARK_TEXT[data.status];

  return (
    <div
      className="relative mx-auto w-full max-w-[794px] rounded-lg border border-gray-200 bg-white shadow-sm @container"
      style={{ aspectRatio: '1 / 1.4142' }}
    >
      {watermark && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <span
            className="select-none font-black tracking-widest text-gray-900/10"
            style={{ transform: 'rotate(-30deg)', fontSize: '18cqw' }}
          >
            {watermark}
          </span>
        </div>
      )}

      <div
        className="relative z-10 h-full"
        style={{
          padding: 'clamp(16px, 6%, 48px)',
          color: '#111827',
          fontSize: 'clamp(8px, 2cqw, 16px)',
        }}
      >
        <BillDocumentBody data={data} />
      </div>
    </div>
  );
}

/** The bill's content only — no sheet, padding or letterhead — so it can sit inside the
 *  document template's paper (between its letterhead and footer) as well as inside the
 *  standalone sheet above. Sizes are in em, so it follows whatever font size it's given.
 *  `compact` trims the table filler and text size for the template studio's smaller area. */
export function BillDocumentBody({
  data,
  compact = false,
}: {
  data: TradeDocumentData;
  compact?: boolean;
}) {
  const fillerRows = Math.max(
    0,
    (compact ? COMPACT_MIN_TABLE_ROWS : MIN_TABLE_ROWS) - data.lines.length,
  );

  return (
    <div
      className={`flex flex-col ${compact ? '' : 'h-full'}`}
      style={compact ? { fontSize: '0.78em' } : undefined}
    >
      {/* Title and document details */}
      <div className="flex items-start justify-between gap-[2em]">
        <h1 className="text-[2.8em] font-bold leading-none tracking-wide" style={{ color: ACCENT }}>
          BILL
        </h1>
        <table className="text-[0.9em]">
          <tbody>
            <MetaRow label="DATE" value={formatDocumentDate(data.date)} />
            <MetaRow label="BILL #" value={data.documentNumber} />
            <MetaRow label={`${data.party.roleLabel.toUpperCase()} ID`} value={data.party.code} />
          </tbody>
        </table>
      </div>

      {/* Bill from — the vendor who issued the bill */}
      <div className="mt-[2em] w-[55%]">
        <div
          className="px-[0.6em] py-[0.25em] text-[0.95em] font-bold text-white"
          style={{ backgroundColor: ACCENT }}
        >
          BILL FROM:
        </div>
        <div className="flex flex-col gap-[0.15em] px-[0.6em] pt-[0.5em] text-[0.95em]">
          <span className="font-semibold">{data.party.name}</span>
          {data.party.address && <span>{data.party.address}</span>}
          {(data.party.contactName || data.party.phone) && (
            <span>{[data.party.contactName, data.party.phone].filter(Boolean).join(' · ')}</span>
          )}
        </div>
      </div>

      {/* Items */}
      <table className="mt-[2em] w-full table-fixed border-collapse border border-gray-800 text-[0.9em]">
        <colgroup>
          <col style={{ width: '12%' }} />
          <col style={{ width: '44%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '16%' }} />
        </colgroup>
        <thead>
          <tr style={{ backgroundColor: ACCENT }} className="text-white">
            <th className="px-[0.5em] py-[0.35em] text-left font-bold">ITEM #</th>
            <th className="px-[0.5em] py-[0.35em] text-left font-bold">ITEM NAME</th>
            <th className="px-[0.5em] py-[0.35em] text-right font-bold">QTY</th>
            <th className="px-[0.5em] py-[0.35em] text-right font-bold">UNIT PRICE</th>
            <th className="px-[0.5em] py-[0.35em] text-right font-bold">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line) => (
            <tr key={line.itemNumber}>
              <Cell>{line.itemNumber}</Cell>
              <Cell>{line.name}</Cell>
              <Cell align="right">{line.quantity}</Cell>
              <Cell align="right">{formatDocumentAmount(line.unitPrice)}</Cell>
              <Cell align="right" shaded>
                {formatDocumentAmount(line.total)}
              </Cell>
            </tr>
          ))}
          {Array.from({ length: fillerRows }).map((_, index) => (
            <tr key={`filler-${index}`}>
              <Cell>&nbsp;</Cell>
              <Cell />
              <Cell />
              <Cell />
              <Cell shaded />
            </tr>
          ))}
        </tbody>
      </table>

      {/* Comments and totals */}
      <div className="mt-[1.2em] flex items-start justify-between gap-[2em]">
        <div className="w-[52%] border border-gray-300">
          <div className="bg-gray-200 px-[0.6em] py-[0.25em] text-[0.85em] font-semibold text-gray-700">
            Other Comments or Special Instructions
          </div>
          <div className="flex h-[5em] items-start justify-between gap-[1em] px-[0.6em] py-[0.5em] text-[0.9em] font-bold">
            <span>TOTAL PAYMENT DUE</span>
            <span>{formatDocumentDate(data.dueDate)}</span>
          </div>
        </div>

        <table className="w-[40%] text-[0.85em]">
          <tbody>
            <TotalRow label="SUBTOTAL" value={formatDocumentAmount(data.subtotal)} />
            <TotalRow label="TAX" value={formatDocumentAmount(data.tax)} />
            <tr className="border-t-2 border-gray-900 font-bold">
              <td className="py-[0.3em]">TOTAL</td>
              <td className="bg-gray-200 py-[0.3em] pr-[0.5em] text-right">
                {data.currency} {formatDocumentAmount(data.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {!compact && (
        <div className="mt-auto pt-[2em]">
          <BillDocumentFooterNote />
        </div>
      )}
    </div>
  );
}

/** The bill's closing line. In the template studio the paper pins it to the footer line;
 *  on the standalone sheet the body places it at the bottom itself. */
export function BillDocumentFooterNote() {
  return (
    <p className="text-center text-[0.8em] font-semibold italic" style={{ color: ACCENT }}>
      Thank You For Your Business!
    </p>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="pr-[0.8em] text-right font-semibold text-gray-700">{label}</td>
      <td className="min-w-[9em] border border-gray-300 px-[0.5em] py-[0.15em] text-center">
        {value}
      </td>
    </tr>
  );
}

function Cell({
  children,
  align = 'left',
  shaded = false,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  shaded?: boolean;
}) {
  return (
    <td
      className={`h-[1.9em] border-x border-gray-300 border-b border-b-gray-200 px-[0.5em] ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${shaded ? 'bg-gray-100' : ''} truncate`}
    >
      {children}
    </td>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="py-[0.25em] text-gray-700">{label}</td>
      <td className="bg-gray-100 py-[0.25em] pr-[0.5em] text-right">{value}</td>
    </tr>
  );
}
