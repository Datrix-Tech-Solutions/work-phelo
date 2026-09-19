import { exportToCsv } from '@/lib/exportCsv';
import {
  formatCents,
  formatPercent,
  variancePercent,
  type StatementClassification,
} from '@/lib/accounting/profitAndLoss';

export type Figures = { current: number; previous: number };

/** A plain line inside a section that isn't a ledger account (e.g. current period profit). */
export type ExtraRow = { label: string; current: number; previous: number };

export type ExportSection = {
  title: string;
  classifications: StatementClassification[];
  totalLabel: string;
  totals: Figures;
  extraRows?: ExtraRow[];
  /** Styles the section total like a closing line (e.g. Total Assets). */
  emphasizeTotal?: boolean;
};

export type ExportClosingRow = {
  label: string;
  figures: Figures;
  tone: 'positive' | 'negative' | 'neutral';
};

export type StatementExport = {
  title: string;
  companyName: string;
  /** Base currency code; empty when accounting has no base currency configured yet. */
  currency: string;
  /** Lines under the title: the period or as-at date, comparison, filters. */
  metaLines: string[];
  /** Headings for the two amount columns when comparing. */
  columnLabels: { current: string; previous: string };
  sections: ExportSection[];
  closing: ExportClosingRow[];
  compare: boolean;
  /** File name without extension. */
  filename: string;
};

type RowKind =
  | 'section'
  | 'classification'
  | 'group'
  | 'line'
  | 'extra'
  | 'group-total'
  | 'classification-total'
  | 'section-total'
  | 'closing';

type Row = {
  kind: RowKind;
  code?: string;
  label: string;
  figures?: Figures;
  tone?: ExportClosingRow['tone'];
};

const INDENT: Record<RowKind, number> = {
  section: 0,
  classification: 0,
  group: 1,
  line: 2,
  extra: 1,
  'group-total': 1,
  'classification-total': 0,
  'section-total': 0,
  closing: 0,
};

/** Flattens the statement into the same top-to-bottom rows the screen shows. */
function buildRows(input: StatementExport): Row[] {
  const rows: Row[] = [];
  for (const section of input.sections) {
    rows.push({ kind: 'section', label: section.title });
    for (const classification of section.classifications) {
      rows.push({ kind: 'classification', label: classification.name });
      for (const group of classification.groups) {
        rows.push({ kind: 'group', label: group.name });
        for (const line of group.lines) {
          rows.push({
            kind: 'line',
            code: line.account.code,
            label: line.account.name,
            figures: line,
          });
        }
        rows.push({ kind: 'group-total', label: `Total ${group.name}`, figures: group });
      }
      rows.push({
        kind: 'classification-total',
        label: `Total ${classification.name}`,
        figures: classification,
      });
    }
    for (const extra of section.extraRows ?? []) {
      rows.push({ kind: 'extra', label: extra.label, figures: extra });
    }
    rows.push(
      section.emphasizeTotal
        ? {
            kind: 'closing',
            label: section.totalLabel,
            figures: section.totals,
            tone: 'neutral',
          }
        : { kind: 'section-total', label: section.totalLabel, figures: section.totals },
    );
  }
  for (const closing of input.closing) {
    rows.push({
      kind: 'closing',
      label: closing.label,
      figures: closing.figures,
      tone: closing.tone,
    });
  }
  return rows;
}

const decimal = (cents: number) => (cents / 100).toFixed(2);

const amountHeads = (input: StatementExport) =>
  input.compare
    ? [input.columnLabels.current, input.columnLabels.previous, 'Variance', 'Var %']
    : [input.currency || 'Amount'];

/** Numbers are written as plain decimals so Excel reads them as numbers, not text. */
export function exportStatementCsv(input: StatementExport) {
  const columns = [
    'Code',
    'Account',
    ...(input.compare
      ? [input.columnLabels.current, input.columnLabels.previous, 'Variance', 'Variance %']
      : [input.currency ? `Amount (${input.currency})` : 'Amount']),
  ];

  const body = buildRows(input).map((row) => {
    const label = `${'  '.repeat(INDENT[row.kind])}${row.label}`;
    const { figures } = row;
    if (!figures) return [row.code ?? '', label];
    if (!input.compare) return [row.code ?? '', label, decimal(figures.current)];
    const percent = variancePercent(figures.current, figures.previous);
    return [
      row.code ?? '',
      label,
      decimal(figures.current),
      decimal(figures.previous),
      decimal(figures.current - figures.previous),
      percent === null ? '' : percent.toFixed(1),
    ];
  });

  exportToCsv(
    input.filename,
    [input.companyName || input.title],
    [
      ...(input.companyName ? [[input.title]] : []),
      ...input.metaLines.map((line) => [line]),
      [],
      columns,
      ...body,
    ],
  );
}

export async function exportStatementPdf(input: StatementExport) {
  const { default: jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({
    orientation: input.compare ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });
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
  doc.text(input.title, centre, y, { align: 'center' });
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
  const head = ['', ...amountHeads(input)];
  const body = rows.map((row) => {
    const label = row.code ? `${row.code}   ${row.label}` : row.label;
    const { figures } = row;
    if (!figures) return [label, ...amountHeads(input).map(() => '')];
    if (!input.compare) return [label, formatCents(figures.current)];
    return [
      label,
      formatCents(figures.current),
      formatCents(figures.previous),
      formatCents(figures.current - figures.previous),
      formatPercent(variancePercent(figures.current, figures.previous)),
    ];
  });

  const numberColumns = input.compare ? { 1: 34, 2: 34, 3: 34, 4: 22 } : { 1: 40 };

  autoTable(doc, {
    startY: y + 3,
    head: [head],
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
    columnStyles: Object.fromEntries(
      Object.entries(numberColumns).map(([index, width]) => [
        index,
        { cellWidth: width, halign: 'right' as const },
      ]),
    ),
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
        case 'section-total':
          cell.styles.fontStyle = 'bold';
          cell.styles.fillColor = [243, 244, 246];
          break;
        case 'classification':
        case 'classification-total':
          cell.styles.fontStyle = 'bold';
          break;
        case 'group':
          cell.styles.fontStyle = 'bold';
          cell.styles.textColor = [75, 85, 99];
          break;
        case 'group-total':
          cell.styles.textColor = [107, 114, 128];
          break;
        case 'closing':
          cell.styles.fontStyle = 'bold';
          cell.styles.fontSize = 10.5;
          if (source.tone === 'positive') cell.styles.textColor = [4, 120, 87];
          else if (source.tone === 'negative') cell.styles.textColor = [185, 28, 28];
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
