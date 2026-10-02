'use client';

import type { PayrollItem } from '@/types/hr';
import { PAYROLL_DOCUMENT_DISCLAIMER } from '@/lib/pdfDisclaimer';
import { buildPayslipView, type PayslipRow } from './payslipView';

/** The payslip's content for a printable sheet — no card, border or company header (the
 *  document template's letterhead supplies those). Sizes are in em and match the Bill's, so
 *  the two documents read at the same size; `compact` applies the Bill's smaller base size
 *  for the template studio's paper. */
export function PayslipDocumentBody({
  item,
  accent,
  compact = false,
}: {
  item: PayrollItem;
  accent: string;
  compact?: boolean;
}) {
  const view = buildPayslipView(item);

  return (
    <div className="flex flex-col gap-[1.2em]" style={compact ? { fontSize: '0.78em' } : undefined}>
      <div className="flex items-start justify-between gap-[1.5em]">
        <h1
          className="text-[2.8em] font-bold uppercase leading-none tracking-wide"
          style={{ color: accent }}
        >
          Payslip
        </h1>
        {/* Name / job title, department / employee no. / date — set smaller than the body. */}
        <div className="flex flex-col gap-[0.1em] text-right text-[0.8em] text-gray-600">
          {view.employeeLines.map((line, index) => (
            <span key={index} className={index === 0 ? 'font-semibold text-gray-900' : undefined}>
              {line}
            </span>
          ))}
        </div>
      </div>

      <Section title="Earnings" accent={accent} rows={view.earnings} />
      <Total label="Gross Salary" value={view.grossSalary} />

      <Section title="Deductions" accent={accent} rows={view.deductions} />
      <Total label="Total Deductions" value={view.totalDeductions} />

      <div
        className="flex items-center justify-between px-[0.9em] py-[0.5em] text-[0.95em] font-bold text-white"
        style={{ backgroundColor: accent }}
      >
        <span>Net Salary Disbursed</span>
        <span className="tabular-nums">{view.netSalary}</span>
      </div>
    </div>
  );
}

/** The payslip's two-line closing note — the same wording as the payslip PDF's footer: the
 *  computer-generated notice (with the HR contact when there is one), then the platform
 *  disclaimer. Kept separate from the body so the paper can pin it to the footer line while
 *  the signature follows the body's content. */
export function PayslipDocumentFooterNote({ hrEmail }: { hrEmail?: string }) {
  return (
    <div className="flex flex-col text-center text-[0.55em] italic leading-tight text-gray-400">
      <p>
        This is a computer-generated payslip and does not require a signature.
        {hrEmail ? `  |  For queries contact HR: ${hrEmail}` : ''}
      </p>
      <p>{PAYROLL_DOCUMENT_DISCLAIMER}</p>
    </div>
  );
}

function Section({ title, accent, rows }: { title: string; accent: string; rows: PayslipRow[] }) {
  return (
    <div>
      <p
        className="mb-[0.3em] border-b-2 pb-[0.25em] text-[0.85em] font-bold uppercase tracking-widest"
        style={{ color: accent, borderColor: accent }}
      >
        {title}
      </p>
      {rows.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          className="flex justify-between gap-[1em] border-b border-gray-100 py-[0.4em] text-[0.9em]"
        >
          <span className="text-gray-700">{row.label}</span>
          <span className="tabular-nums text-gray-900">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="-mt-[0.7em] flex justify-between gap-[1em] py-[0.4em] text-[0.9em] font-bold text-gray-900">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
