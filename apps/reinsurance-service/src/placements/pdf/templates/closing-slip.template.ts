import { PlacementDocumentType } from '../../../../prisma/generated/client';
import {
  brokerDocumentCss,
  renderBrokerFooter,
  renderBrokerHeader,
  renderBrokerWatermark,
} from './broker-document.template';

export interface PlacementDocumentTemplateContext {
  documentNumber: string;
  title: string;
  generatedAt: Date | string | null;
  qrCodeDataUrl?: string;
}

interface ClosingSlipPayload {
  documentType?: string;
  closing?: Record<string, unknown>;
  endorsementClosing?: Record<string, unknown>;
  branding?: Record<string, unknown>;
}

export function toDisplayString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return JSON.stringify(value) ?? '';
}

export function escapeHtml(value: unknown): string {
  return toDisplayString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

export function getNested(
  source: Record<string, unknown> | null,
  path: string[],
): unknown {
  return path.reduce<unknown>((current, key) => {
    const record = getRecord(current);
    return record ? record[key] : undefined;
  }, source);
}

export function text(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return escapeHtml(value);
}

export function dateText(value: unknown): string {
  if (!value) return '—';
  const parsed = new Date(toDisplayString(value));
  if (Number.isNaN(parsed.getTime())) return text(value);
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function moneyText(value: unknown, currency: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  const amount = Number.isFinite(numeric)
    ? numeric.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : toDisplayString(value);
  return `${text(currency, '').trim()} ${escapeHtml(amount)}`.trim();
}

export function percentText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `${text(value)}%`;
  return `${numeric.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })}%`;
}

export function detail(label: string, value: string): string {
  return `
    <div class="detail">
      <dt>${escapeHtml(label)}</dt>
      <dd>${value}</dd>
    </div>
  `;
}

export function moneyRow(
  label: string,
  value: unknown,
  currency: unknown,
): string {
  return `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td>${moneyText(value, currency)}</td>
    </tr>
  `;
}

export function renderClosingSlipTemplate(
  payload: ClosingSlipPayload,
  context: PlacementDocumentTemplateContext,
): string {
  const closing =
    getRecord(payload.closing) ?? getRecord(payload.endorsementClosing);
  const participant = getRecord(closing?.participant);
  const counterparty =
    getRecord(participant?.counterparty) ??
    getRecord(getNested(closing, ['endorsementParticipant', 'counterparty']));
  const placement = getRecord(closing?.placement);
  const cedant = getRecord(placement?.cedant);
  const branding = getRecord(payload.branding);
  const currency = closing?.currency ?? placement?.currency;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(context.title)}</title>
    <style>
      @page { size: A4; margin: 22mm 18mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Helvetica Neue", Arial, sans-serif;
        color: #111827;
        background: #ffffff;
        font-size: 12px;
        line-height: 1.45;
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 24px;
        border-bottom: 2px solid #111827;
        padding-bottom: 16px;
        margin-bottom: 24px;
      }
      .brand h1 {
        margin: 0;
        font-size: 20px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .brand p,
      .meta p {
        margin: 4px 0 0;
        color: #4b5563;
      }
      .meta {
        text-align: right;
        min-width: 180px;
      }
      .meta strong {
        display: block;
        font-size: 13px;
        color: #111827;
      }
      .section {
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 16px;
      }
      .section h2 {
        margin: 0 0 12px;
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #374151;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px 20px;
      }
      .detail dt {
        color: #6b7280;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .detail dd {
        margin: 3px 0 0;
        font-weight: 700;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        border-bottom: 1px solid #f3f4f6;
        padding: 10px 0;
      }
      th {
        color: #4b5563;
        font-weight: 600;
        text-align: left;
      }
      td {
        font-weight: 700;
        text-align: right;
      }
      .total th,
      .total td {
        border-bottom: 0;
        color: #047857;
        font-size: 14px;
      }
      footer {
        margin-top: 28px;
        padding-top: 14px;
        border-top: 1px solid #e5e7eb;
        color: #6b7280;
        font-size: 10px;
      }
      .letter-recipient { margin-bottom: 14px; line-height: 1.55; }
      .letter-copy { margin: 0 0 16px; text-align: justify; }
      .letter-signoff { margin-top: 24px; }
      .signature-line { width: 220px; margin-top: 48px; border-top: 1px solid #172033; padding-top: 6px; }
      ${brokerDocumentCss}
    </style>
  </head>
  <body>
    <main class="document-shell">
    ${renderBrokerWatermark(branding)}
    ${renderBrokerHeader(
      'Closing Slip',
      `Closing ${toDisplayString(closing?.closingNumber || context.documentNumber)}`,
      context,
      branding,
    )}

    <div class="letter-recipient">
      <strong>The Managing Director</strong><br />
      ${text(counterparty?.name)}<br />
      ${text(counterparty?.address ?? counterparty?.country, '')}
    </div>
    <p>Dear Sir / Madam,</p>
    <p class="letter-copy">
      We refer to the facultative risk detailed below and confirm the line placed with your
      company. Kindly acknowledge this closing and issue your guarantee in accordance with
      the agreed terms.
    </p>

    <section class="section">
      <h2>Placement Details</h2>
      <div class="grid">
        ${detail('Placement Reference', text(placement?.reference ?? closing?.placementId))}
        ${detail('Policy Number', text(placement?.policyNumber))}
        ${detail('Risk', text(placement?.classOfBusiness ?? placement?.title))}
        ${detail('Cedant', text(cedant?.name))}
        ${detail('Currency', text(currency))}
        ${detail('Closing Status', text(closing?.status))}
        ${detail(
          'Insurance Period',
          `${dateText(placement?.inceptionDate)} - ${dateText(placement?.expiryDate)}`,
        )}
      </div>
    </section>

    <section class="section">
      <h2>Reinsurer / Counterparty</h2>
      <div class="grid">
        ${detail('Company', text(counterparty?.name))}
        ${detail('Registration Number', text(counterparty?.registrationNumber))}
        ${detail('Email', text(counterparty?.email))}
        ${detail('Phone', text(counterparty?.phone))}
      </div>
    </section>

    <section class="section">
      <h2>Participation</h2>
      <div class="grid">
        ${detail('Share Percent', percentText(closing?.sharePercent))}
        ${detail('Signed Line Percent', percentText(closing?.signedLinePercent))}
        ${detail('Issued Date', dateText(closing?.issuedAt))}
        ${detail('Confirmed Date', dateText(closing?.confirmedAt))}
      </div>
    </section>

    <section class="section">
      <h2>Financial Snapshot</h2>
      <table>
        <tbody>
          ${moneyRow('Sum Insured', closing?.sumInsuredSnapshot, currency)}
          ${moneyRow('Gross Premium', closing?.grossPremium ?? closing?.premiumSnapshot, currency)}
          <tr>
            <th>Commission (${percentText(closing?.commissionPercent)})</th>
            <td>${moneyText(closing?.commissionAmount, currency)}</td>
          </tr>
          <tr>
            <th>Brokerage (${percentText(closing?.brokeragePercent)})</th>
            <td>${moneyText(closing?.brokerageAmount, currency)}</td>
          </tr>
          <tr class="total">
            <th>Net Premium</th>
            <td>${moneyText(closing?.netPremium, currency)}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <div class="letter-signoff">
      <p>Thank you.</p>
      <p>Yours faithfully,</p>
      <div class="signature-line">For Broker / WorkPhelo</div>
    </div>
    ${renderBrokerFooter(context, branding)}
    </main>
  </body>
</html>`;
}

export function isClosingSlipPayload(
  payload: unknown,
): payload is ClosingSlipPayload {
  const record = getRecord(payload);
  return (
    record?.documentType === PlacementDocumentType.CLOSING_SLIP &&
    (getRecord(record.closing) !== null ||
      getRecord(record.endorsementClosing) !== null)
  );
}
