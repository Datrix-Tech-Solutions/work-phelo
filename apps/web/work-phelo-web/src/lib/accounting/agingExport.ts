import type { DocumentTemplate } from '@/components/molecules/settings/document-template/templateConfig';
import { createReportPdf } from '@/lib/documents/reportPdf';
import { exportToCsv } from '@/lib/exportCsv';
import {
  AGING_BUCKET_KEYS,
  AGING_BUCKET_LABELS,
  bucketShare,
  type AgingCurrencyBlock,
} from '@/lib/accounting/aging';
import { formatCents, formatDate, formatPercent, toCents } from '@/lib/accounting/profitAndLoss';

export type AgingExport = {
  title: string;
  companyName: string;
  /** Lines under the title: the as-at date, the ageing basis, any search applied. */
  metaLines: string[];
  /** "Customer" or "Vendor". */
  partyLabel: string;
  blocks: AgingCurrencyBlock[];
  /** File name without extension. */
  filename: string;
};

type RowKind = 'currency' | 'party' | 'document' | 'total' | 'share';
type Row = {
  kind: RowKind;
  label: string;
  /** Six cents values (five buckets, then the total); absent on heading rows. */
  amounts?: number[];
  shares?: Array<number | null>;
  document?: { number: string; date: string; due: string; days: number };
};

const isoDate = (value: string) => formatDate(value.slice(0, 10));

/** Flattens the report into the same top-to-bottom rows the screen shows, expanded in full. */
function buildRows(input: AgingExport): Row[] {
  const rows: Row[] = [];
  for (const block of input.blocks) {
    rows.push({ kind: 'currency', label: `${input.partyLabel} · ${block.currency}` });
    for (const party of block.parties) {
      rows.push({
        kind: 'party',
        label: `${party.code}   ${party.name}`,
        amounts: [...AGING_BUCKET_KEYS.map((key) => party.buckets[key]), party.total],
      });
      for (const document of party.documents) {
        const outstanding = toCents(document.outstandingAmount);
        rows.push({
          kind: 'document',
          label: document.documentNumber,
          amounts: [
            ...AGING_BUCKET_KEYS.map((key) => (document.bucket === key ? outstanding : 0)),
            outstanding,
          ],
          document: {
            number: document.documentNumber,
            date: isoDate(document.documentDate),
            due: document.dueDate ? isoDate(document.dueDate) : '',
            days: document.daysOverdue,
          },
        });
      }
    }
    rows.push({
      kind: 'total',
      label: `Total ${block.currency}`,
      amounts: [...AGING_BUCKET_KEYS.map((key) => block.totals.buckets[key]), block.totals.total],
    });
    rows.push({
      kind: 'share',
      label: '% of total',
      shares: [
        ...AGING_BUCKET_KEYS.map((key) =>
          bucketShare(block.totals.buckets[key], block.totals.total),
        ),
        block.totals.total === 0 ? null : 100,
      ],
    });
  }
  return rows;
}

const decimal = (cents: number) => (cents / 100).toFixed(2);
const BUCKET_HEADS = [...AGING_BUCKET_KEYS.map((key) => AGING_BUCKET_LABELS[key]), 'Total'];

/** Numbers are written as plain decimals so Excel reads them as numbers, not text. */
export function exportAgingCsv(input: AgingExport) {
  const columns = [input.partyLabel, 'Document', 'Document date', 'Due date', ...BUCKET_HEADS];

  const body = buildRows(input).map((row) => {
    if (row.kind === 'currency') return [row.label];
    if (row.kind === 'share') {
      return [
        row.label,
        '',
        '',
        '',
        ...(row.shares ?? []).map((value) => (value === null ? '' : value.toFixed(1))),
      ];
    }
    // On a document line only the bucket it falls in is filled, so the sheet reads like the screen.
    const amounts = (row.amounts ?? []).map((cents, index) =>
      row.kind === 'document' && cents === 0 && index < AGING_BUCKET_KEYS.length
        ? ''
        : decimal(cents),
    );
    if (row.kind === 'document' && row.document) {
      return ['', row.document.number, row.document.date, row.document.due, ...amounts];
    }
    return [row.label, '', '', '', ...amounts];
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

export async function exportAgingPdf(input: AgingExport, template: DocumentTemplate | null) {
  const { doc, autoTable, font, margin, heading, save } = await createReportPdf({
    orientation: 'landscape',
    template,
  });
  const startY = heading(input.title, input.metaLines, input.companyName);

  const rows = buildRows(input);
  const blank = BUCKET_HEADS.map(() => '');
  const body = rows.map((row) => {
    if (row.kind === 'currency') return [row.label, ...blank];
    if (row.kind === 'share') {
      return [row.label, ...(row.shares ?? []).map((value) => formatPercent(value))];
    }
    const cells = (row.amounts ?? []).map((cents, index) =>
      row.kind === 'document' && cents === 0 && index < AGING_BUCKET_KEYS.length
        ? ''
        : cents === 0
          ? '—'
          : formatCents(cents),
    );
    if (row.kind === 'document' && row.document) {
      const { number, date, due, days } = row.document;
      const text = `${number} · Dated ${date} · ${due ? `Due ${due}` : 'No due date'}${days > 0 ? ` · ${days}d overdue` : ''}`;
      return [text, ...cells];
    }
    return [row.label, ...cells];
  });

  autoTable(doc, {
    startY,
    head: [[input.partyLabel, ...BUCKET_HEADS]],
    body,
    theme: 'plain',
    margin,
    styles: { font, fontSize: 8.5, cellPadding: { top: 1.2, bottom: 1.2, left: 2, right: 2 } },
    headStyles: {
      fontStyle: 'bold',
      fillColor: [243, 244, 246],
      textColor: [90, 90, 90],
      halign: 'right',
    },
    columnStyles: Object.fromEntries(
      BUCKET_HEADS.map((_, index) => [index + 1, { cellWidth: 28, halign: 'right' as const }]),
    ),
    didParseCell: ({ section, row, column, cell }) => {
      if (section === 'head' && column.index === 0) cell.styles.halign = 'left';
      if (section !== 'body') return;
      const source = rows[row.index];
      if (column.index === 0) cell.styles.halign = 'left';
      switch (source.kind) {
        case 'currency':
          cell.styles.fontStyle = 'bold';
          cell.styles.fillColor = [243, 244, 246];
          break;
        case 'party':
          cell.styles.fontStyle = 'bold';
          break;
        case 'document':
          cell.styles.fontSize = 7.5;
          cell.styles.textColor = [107, 114, 128];
          if (column.index === 0) {
            cell.styles.cellPadding = { top: 0.8, bottom: 0.8, left: 8, right: 2 };
          }
          break;
        case 'total':
          cell.styles.fontStyle = 'bold';
          cell.styles.fontSize = 9.5;
          break;
        case 'share':
          cell.styles.textColor = [107, 114, 128];
          break;
      }
      // Over-90 amounts stand out in red, the column that signals bad debt.
      if (
        column.index === AGING_BUCKET_KEYS.length &&
        (source.kind === 'party' || source.kind === 'total') &&
        (source.amounts?.[AGING_BUCKET_KEYS.length - 1] ?? 0) > 0
      ) {
        cell.styles.textColor = [185, 28, 28];
      }
    },
  });

  save(input.filename);
}
