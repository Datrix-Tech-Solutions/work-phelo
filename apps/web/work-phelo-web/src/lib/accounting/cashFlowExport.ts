import { exportToCsv } from '@/lib/exportCsv';
import { formatCents, toCents } from '@/lib/accounting/profitAndLoss';
import type { CashFlowStatementReport } from '@/types/accounting';

export type CashFlowExport = {
  companyName: string;
  /** Base currency code; empty when accounting has no base currency configured yet. */
  currency: string;
  /** Lines under the title: the period and what the figures cover. */
  metaLines: string[];
  report: CashFlowStatementReport;
  /** File name without extension. */
  filename: string;
};

type RowKind = 'section' | 'line' | 'section-total' | 'closing' | 'balance';
type Row = { kind: RowKind; code?: string; label: string; cents?: number };

const TITLE = 'Cash Flow Statement';
const INDENT: Record<RowKind, number> = {
  section: 0,
  line: 1,
  'section-total': 0,
  closing: 0,
  balance: 0,
};

/** Flattens the statement into the same top-to-bottom rows the screen shows. */
function buildRows({ report }: CashFlowExport): Row[] {
  const { operatingActivities, investingActivities, financingActivities } = report;
  const rows: Row[] = [];
  const section = (
    title: string,
    lines: CashFlowStatementReport['investingActivities']['lines'],
    total: string,
    netIncome?: string,
  ) => {
    rows.push({ kind: 'section', label: title });
    if (netIncome !== undefined) {
      rows.push({ kind: 'line', label: 'Net Income', cents: toCents(netIncome) });
    }
    for (const line of lines) {
      rows.push({
        kind: 'line',
        code: line.account.code,
        label: line.account.name,
        cents: toCents(line.amount),
      });
    }
    rows.push({
      kind: 'section-total',
      label: `Net Cash from ${title}`,
      cents: toCents(total),
    });
  };

  section(
    'Operating Activities',
    operatingActivities.adjustments,
    operatingActivities.total,
    operatingActivities.netIncome,
  );
  section('Investing Activities', investingActivities.lines, investingActivities.total);
  section('Financing Activities', financingActivities.lines, financingActivities.total);
  rows.push(
    { kind: 'closing', label: 'Net Change in Cash', cents: toCents(report.netChangeInCash) },
    { kind: 'balance', label: 'Opening Cash Balance', cents: toCents(report.openingCash) },
    { kind: 'closing', label: 'Closing Cash Balance', cents: toCents(report.closingCash) },
  );
  return rows;
}

/** The on-screen reconciliation warning, so a downloaded copy cannot pass as reconciled. */
function reconciliationWarning({ report }: CashFlowExport): string | null {
  const { reconciliation } = report;
  if (reconciliation.isReconciled) return null;
  return `This statement does not reconcile to cash: the three sections come to ${reconciliation.netChangeInCash}, but the cash accounts moved by ${reconciliation.cashMovement} (difference ${reconciliation.difference}).`;
}

const decimal = (cents: number) => (cents / 100).toFixed(2);

/** Numbers are written as plain decimals so Excel reads them as numbers, not text. */
export function exportCashFlowCsv(input: CashFlowExport) {
  const warning = reconciliationWarning(input);
  const body = buildRows(input).map((row) => {
    const label = `${'  '.repeat(INDENT[row.kind])}${row.label}`;
    if (row.cents === undefined) return [row.code ?? '', label];
    return [row.code ?? '', label, decimal(row.cents)];
  });

  exportToCsv(
    input.filename,
    [input.companyName || TITLE],
    [
      ...(input.companyName ? [[TITLE]] : []),
      ...input.metaLines.map((line) => [line]),
      ...(warning ? [[warning]] : []),
      [],
      ['Code', 'Account', input.currency ? `Amount (${input.currency})` : 'Amount'],
      ...body,
    ],
  );
}

export async function exportCashFlowPdf(input: CashFlowExport) {
  const { default: jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centre = pageWidth / 2;

  let y = 16;
  if (input.companyName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(input.companyName, centre, y, { align: 'center' });
    y += 7;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(TITLE, centre, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  for (const line of input.metaLines) {
    doc.text(line, centre, y, { align: 'center' });
    y += 5;
  }
  const warning = reconciliationWarning(input);
  if (warning) {
    const wrapped: string[] = doc.splitTextToSize(warning, pageWidth - 28);
    doc.setTextColor(185, 28, 28);
    doc.text(wrapped, 14, y + 2);
    y += wrapped.length * 5 + 2;
  }
  doc.setTextColor(0, 0, 0);

  const rows = buildRows(input);
  const body = rows.map((row) => [
    row.code ? `${row.code}   ${row.label}` : row.label,
    row.cents === undefined ? '' : formatCents(row.cents),
  ]);

  autoTable(doc, {
    startY: y + 3,
    head: [['', input.currency || 'Amount']],
    body,
    theme: 'plain',
    margin: { left: 14, right: 14, bottom: 16 },
    styles: { fontSize: 9, cellPadding: { top: 1.3, bottom: 1.3, left: 2, right: 2 } },
    headStyles: {
      fontStyle: 'bold',
      fillColor: [243, 244, 246],
      textColor: [90, 90, 90],
      halign: 'right',
    },
    columnStyles: { 1: { cellWidth: 40, halign: 'right' } },
    didParseCell: ({ section, row, column, cell }) => {
      if (section !== 'body') return;
      const source = rows[row.index];
      if (column.index === 0) {
        cell.styles.halign = 'left';
        cell.styles.cellPadding = {
          top: 1.3,
          bottom: 1.3,
          right: 2,
          left: 2 + INDENT[source.kind] * 4,
        };
      }
      switch (source.kind) {
        case 'section':
          cell.styles.fontStyle = 'bold';
          cell.styles.fillColor = [243, 244, 246];
          break;
        case 'section-total':
          cell.styles.fontStyle = 'bold';
          break;
        case 'closing':
          cell.styles.fontStyle = 'bold';
          cell.styles.fontSize = 10.5;
          break;
      }
    },
    didDrawPage: ({ pageNumber }) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`Generated ${new Date().toLocaleString()}`, 14, pageHeight - 8);
      doc.text(`Page ${pageNumber}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    },
  });

  doc.save(`${input.filename}.pdf`);
}
