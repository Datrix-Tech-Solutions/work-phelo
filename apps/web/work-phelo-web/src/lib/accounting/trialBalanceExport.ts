import { exportToCsv } from '@/lib/exportCsv';
import { formatCents } from '@/lib/accounting/profitAndLoss';
import type { TrialCategory } from '@/lib/accounting/trialBalance';

export type TrialBalanceExport = {
  companyName: string;
  /** Base currency code; empty when accounting has no base currency configured yet. */
  currency: string;
  /** Lines under the title: the as-at date and what the figures cover. */
  metaLines: string[];
  categories: TrialCategory[];
  totals: { debit: number; credit: number };
  /** Total debit less total credit, in cents; non-zero means the ledger is out of balance. */
  imbalance: number;
  /** File name without extension. */
  filename: string;
};

type RowKind = 'category' | 'group' | 'line' | 'category-total' | 'total' | 'difference';
type Row = { kind: RowKind; code?: string; label: string; debit?: number; credit?: number };

const TITLE = 'Trial Balance';
const INDENT: Record<RowKind, number> = {
  category: 0,
  group: 1,
  line: 2,
  'category-total': 0,
  total: 0,
  difference: 0,
};

/** Flattens the report into the same top-to-bottom rows the screen shows. */
function buildRows(input: TrialBalanceExport): Row[] {
  const rows: Row[] = [];
  for (const category of input.categories) {
    rows.push({ kind: 'category', label: category.title });
    for (const group of category.groups) {
      rows.push({ kind: 'group', label: group.name });
      for (const line of group.lines) {
        rows.push({
          kind: 'line',
          code: line.account.code,
          label: line.account.name,
          debit: line.debit,
          credit: line.credit,
        });
      }
    }
    rows.push({
      kind: 'category-total',
      label: `Total ${category.title}`,
      debit: category.debit,
      credit: category.credit,
    });
  }
  rows.push({
    kind: 'total',
    label: 'Total',
    debit: input.totals.debit,
    credit: input.totals.credit,
  });
  if (input.imbalance !== 0) {
    rows.push({
      kind: 'difference',
      label: 'Out of balance (debit − credit)',
      debit: input.imbalance,
    });
  }
  return rows;
}

const decimal = (cents: number) => (cents / 100).toFixed(2);

/** Numbers are written as plain decimals so Excel reads them as numbers, not text. */
export function exportTrialBalanceCsv(input: TrialBalanceExport) {
  const suffix = input.currency ? ` (${input.currency})` : '';
  const body = buildRows(input).map((row) => {
    const label = `${'  '.repeat(INDENT[row.kind])}${row.label}`;
    if (row.debit === undefined) return [row.code ?? '', label];
    // Account lines leave the unused side blank, so the sheet shows debit OR credit.
    const blankZero = row.kind === 'line';
    const cell = (cents: number | undefined) =>
      cents === undefined || (blankZero && cents === 0) ? '' : decimal(cents);
    return [row.code ?? '', label, cell(row.debit), cell(row.credit)];
  });

  exportToCsv(
    input.filename,
    [input.companyName || TITLE],
    [
      ...(input.companyName ? [[TITLE]] : []),
      ...input.metaLines.map((line) => [line]),
      [],
      ['Code', 'Account', `Debit${suffix}`, `Credit${suffix}`],
      ...body,
    ],
  );
}

export async function exportTrialBalancePdf(input: TrialBalanceExport) {
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
  doc.setTextColor(0, 0, 0);

  const rows = buildRows(input);
  const suffix = input.currency ? ` (${input.currency})` : '';
  const body = rows.map((row) => {
    const label = row.code ? `${row.code}   ${row.label}` : row.label;
    if (row.debit === undefined) return [label, '', ''];
    const cell = (cents: number | undefined) =>
      cents === undefined || (row.kind === 'line' && cents === 0) ? '—' : formatCents(cents);
    return [label, cell(row.debit), cell(row.credit)];
  });

  autoTable(doc, {
    startY: y + 3,
    head: [['', `Debit${suffix}`, `Credit${suffix}`]],
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
    columnStyles: {
      1: { cellWidth: 38, halign: 'right' },
      2: { cellWidth: 38, halign: 'right' },
    },
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
        case 'category':
          cell.styles.fontStyle = 'bold';
          cell.styles.fillColor = [243, 244, 246];
          break;
        case 'group':
          cell.styles.fontStyle = 'bold';
          cell.styles.textColor = [75, 85, 99];
          break;
        case 'category-total':
          cell.styles.fontStyle = 'bold';
          break;
        case 'total':
          cell.styles.fontStyle = 'bold';
          cell.styles.fontSize = 10.5;
          break;
        case 'difference':
          cell.styles.fontStyle = 'bold';
          cell.styles.textColor = [185, 28, 28];
          break;
      }
      // Blank-looking dashes on account lines fade so the amounts stand out.
      if (source.kind === 'line' && column.index > 0 && cell.text[0] === '—') {
        cell.styles.textColor = [200, 200, 200];
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
