import { PlacementDocumentType } from '../../../../prisma/generated/client';
import {
  brokerDocumentCss,
  renderBrokerFooter,
  renderBrokerHeader,
  renderBrokerWatermark,
} from './broker-document.template';
import {
  dateText,
  detail,
  escapeHtml,
  getNested,
  getRecord,
  moneyRow,
  moneyText,
  percentText,
  PlacementDocumentTemplateContext,
  text,
} from './closing-slip.template';

interface EndorsementSlipPayload {
  documentType?: string;
  endorsement?: Record<string, unknown>;
  branding?: Record<string, unknown>;
}

interface EndorsementCertificatePayload {
  documentType?: string;
  endorsementCertificate?: Record<string, unknown>;
  branding?: Record<string, unknown>;
}

const CHANGE_FIELDS: Array<{
  key: string;
  label: string;
  type: 'amount' | 'percent' | 'date' | 'text';
}> = [
  { key: 'title', label: 'Insured', type: 'text' },
  { key: 'sumInsured', label: 'Sum Insured', type: 'amount' },
  { key: 'premium', label: 'Gross Premium', type: 'amount' },
  { key: 'rate', label: 'Rate', type: 'percent' },
  { key: 'facultativeOffer', label: 'Facultative Offer', type: 'percent' },
  { key: 'commission', label: 'Commission', type: 'percent' },
  { key: 'currency', label: 'Currency', type: 'text' },
  { key: 'inceptionDate', label: 'Inception Date', type: 'date' },
  { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
  { key: 'classOfBusiness', label: 'Class of Business', type: 'text' },
];

export function isEndorsementSlipPayload(
  value: unknown,
): value is EndorsementSlipPayload {
  const record = getRecord(value);
  return (
    !!record &&
    record.documentType === PlacementDocumentType.ENDORSEMENT_SLIP &&
    !!getRecord(record.endorsement)
  );
}

export function isEndorsementCertificatePayload(
  value: unknown,
): value is EndorsementCertificatePayload {
  const record = getRecord(value);
  return (
    !!record &&
    record.documentType === PlacementDocumentType.ENDORSEMENT_CERTIFICATE &&
    !!getRecord(record.endorsementCertificate)
  );
}

export function renderEndorsementSlipTemplate(
  payload: EndorsementSlipPayload,
  context: PlacementDocumentTemplateContext,
): string {
  const endorsement = getRecord(payload.endorsement);
  const placement = getRecord(endorsement?.placement);
  const cedant = getRecord(placement?.cedant);
  const closings = arrayOfRecords(endorsement?.closings);
  const participants = arrayOfRecords(endorsement?.participants);
  const notes = arrayOfRecords(endorsement?.notes);
  const original = getSnapshotPlacement(endorsement?.originalSnapshot);
  const proposed = getSnapshotPlacement(endorsement?.proposedSnapshot);
  const currency =
    placement?.currency ?? proposed?.currency ?? original?.currency;
  const confirmedClosings = closings.filter(
    (closing) => closing.status === 'CONFIRMED',
  );
  const totals = sumClosingTotals(confirmedClosings);

  return renderDocumentShell(
    'Endorsement Slip',
    `Endorsement ${text(endorsement?.endorsementNumber)} · ${text(placement?.reference)}`,
    payload.branding,
    context,
    `
      <section class="letter-block">
        <p><strong>Placement:</strong> ${text(placement?.reference)} · ${text(placement?.title)}</p>
        <p><strong>Cedant:</strong> ${text(cedant?.name)}</p>
        <p><strong>Purpose:</strong> This slip records the official endorsed change to the placement. Original placement records remain historical.</p>
      </section>

      <section class="detail-grid">
        ${detail('Endorsement No.', text(endorsement?.endorsementNumber))}
        ${detail('Endorsement Type', text(endorsement?.type))}
        ${detail('Impact Type', text(endorsement?.impactType))}
        ${detail('Status', text(endorsement?.status))}
        ${detail('Effective Date', dateText(endorsement?.effectiveDate))}
        ${detail('Document Version', text(context.documentNumber))}
      </section>

      ${renderTermsTable(original, proposed, currency)}
      ${renderParticipantsTable(participants)}
      ${renderClosingsTable(confirmedClosings)}
      ${renderFinancialSummary(totals, currency, notes)}
      ${renderConditions(endorsement)}
      ${renderSignatureBlock(payload.branding)}
    `,
  );
}

export function renderEndorsementCertificateTemplate(
  payload: EndorsementCertificatePayload,
  context: PlacementDocumentTemplateContext,
): string {
  const closing = getRecord(payload.endorsementCertificate);
  const endorsement = getRecord(closing?.endorsement);
  const placement = getRecord(closing?.placement);
  const cedant = getRecord(placement?.cedant);
  const participant = getRecord(closing?.endorsementParticipant);
  const reinsurer = getRecord(participant?.counterparty);
  const originalParticipant = getRecord(participant?.originalParticipant);
  const original = getSnapshotPlacement(endorsement?.originalSnapshot);
  const proposed = getSnapshotPlacement(endorsement?.proposedSnapshot);
  const currency =
    closing?.currency ?? placement?.currency ?? proposed?.currency;

  return renderDocumentShell(
    'Endorsement Certificate',
    `Certificate for ${text(reinsurer?.name)} · ${text(closing?.closingNumber)}`,
    payload.branding,
    context,
    `
      <section class="letter-block">
        <p><strong>To:</strong> ${text(reinsurer?.name)}</p>
        <p><strong>Cedant:</strong> ${text(cedant?.name)}</p>
        <p>This certificate confirms the reinsurer's endorsed participation recorded under the confirmed endorsement closing below.</p>
      </section>

      <section class="detail-grid">
        ${detail('Placement Reference', text(placement?.reference))}
        ${detail('Endorsement No.', text(endorsement?.endorsementNumber))}
        ${detail('Closing No.', text(closing?.closingNumber))}
        ${detail('Effective Date', dateText(endorsement?.effectiveDate))}
        ${detail('Reinsurer', text(reinsurer?.name))}
        ${detail('Closing Status', text(closing?.status))}
      </section>

      ${renderTermsTable(original, proposed, currency)}

      <section class="section">
        <h2>Confirmed Reinsurer Participation</h2>
        <table class="financial-table">
          <tbody>
            <tr><th>Original Signed Line</th><td>${percentText(originalParticipant?.signedLinePercent ?? originalParticipant?.sharePercent)}</td></tr>
            <tr><th>Confirmed Endorsement Signed Line</th><td>${percentText(closing?.signedLinePercent)}</td></tr>
            <tr><th>Share Percent</th><td>${percentText(closing?.sharePercent)}</td></tr>
            <tr><th>Sum Insured Snapshot</th><td>${moneyText(closing?.sumInsuredSnapshot, currency)}</td></tr>
            <tr><th>Gross Premium Snapshot</th><td>${moneyText(closing?.premiumSnapshot, currency)}</td></tr>
            <tr><th>Commission</th><td>${percentText(closing?.commissionPercent)} · ${moneyText(closing?.commissionAmount, currency)}</td></tr>
            <tr><th>Brokerage</th><td>${percentText(closing?.brokeragePercent)} · ${moneyText(closing?.brokerageAmount, currency)}</td></tr>
            <tr><th>Net Premium</th><td>${moneyText(closing?.netPremium, currency)}</td></tr>
          </tbody>
        </table>
      </section>

      ${renderNotesTable(arrayOfRecords(closing?.notes), currency)}
      ${renderConditions(endorsement)}
      ${renderSignatureBlock(payload.branding)}
    `,
  );
}

function renderDocumentShell(
  title: string,
  subtitle: string,
  branding: unknown,
  context: PlacementDocumentTemplateContext,
  body: string,
): string {
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>${brokerDocumentCss}${endorsementCss}</style>
    </head>
    <body>
      <div class="document-shell">
        ${renderBrokerWatermark(branding)}
        ${renderBrokerHeader(title, subtitle, context, branding)}
        ${body}
        ${renderBrokerFooter(context, branding)}
      </div>
    </body>
  </html>`;
}

function renderTermsTable(
  original: Record<string, unknown> | null,
  proposed: Record<string, unknown> | null,
  currency: unknown,
): string {
  const rows = CHANGE_FIELDS.map((field) => {
    const originalValue = original?.[field.key];
    const proposedValue = proposed?.[field.key] ?? originalValue;
    const changed =
      proposed &&
      proposed[field.key] !== undefined &&
      comparableValue(originalValue) !== comparableValue(proposedValue);
    return `
      <tr class="${changed ? 'changed' : ''}">
        <th>${escapeHtml(field.label)}</th>
        <td>${formatValue(originalValue, field.type, currency)}</td>
        <td>${formatValue(proposedValue, field.type, currency)}</td>
      </tr>
    `;
  }).join('');

  return `
    <section class="section">
      <h2>Original and Revised Terms</h2>
      <table class="terms-table">
        <thead>
          <tr><th>Field</th><th>Original</th><th>Revised</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function renderParticipantsTable(
  participants: Record<string, unknown>[],
): string {
  if (participants.length === 0) return '';
  return `
    <section class="section">
      <h2>Endorsement Participants</h2>
      <table class="terms-table">
        <thead>
          <tr><th>Counterparty</th><th>Status</th><th>Offered Line</th><th>Signed Line</th></tr>
        </thead>
        <tbody>
          ${participants
            .map((participant) => {
              const counterparty = getRecord(participant.counterparty);
              return `
                <tr>
                  <td>${text(counterparty?.name)}</td>
                  <td>${text(participant.status)}</td>
                  <td>${percentText(participant.sharePercent)}</td>
                  <td>${percentText(participant.signedLinePercent)}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderClosingsTable(closings: Record<string, unknown>[]): string {
  if (closings.length === 0) {
    return `
      <section class="section">
        <h2>Confirmed Endorsement Closings</h2>
        <p class="muted">No confirmed endorsement closings are attached to this slip.</p>
      </section>
    `;
  }
  return `
    <section class="section">
      <h2>Confirmed Endorsement Closings</h2>
      <table class="terms-table">
        <thead>
          <tr><th>Closing</th><th>Reinsurer</th><th>Signed Line</th><th>Premium</th><th>Net Premium</th></tr>
        </thead>
        <tbody>
          ${closings
            .map((closing) => {
              const participant = getRecord(closing.endorsementParticipant);
              const counterparty = getRecord(participant?.counterparty);
              return `
                <tr>
                  <td>${text(closing.closingNumber)}</td>
                  <td>${text(counterparty?.name)}</td>
                  <td>${percentText(closing.signedLinePercent)}</td>
                  <td>${moneyText(closing.premiumSnapshot, closing.currency)}</td>
                  <td>${moneyText(closing.netPremium, closing.currency)}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderFinancialSummary(
  totals: {
    premium: number;
    commission: number;
    brokerage: number;
    net: number;
  },
  currency: unknown,
  notes: Record<string, unknown>[],
): string {
  return `
    <section class="section two-column">
      <div>
        <h2>Financial Summary</h2>
        <table class="financial-table">
          <tbody>
            ${moneyRow('Gross Premium', totals.premium, currency)}
            ${moneyRow('Commission', totals.commission, currency)}
            ${moneyRow('Brokerage', totals.brokerage, currency)}
            ${moneyRow('Net Premium', totals.net, currency)}
          </tbody>
        </table>
      </div>
      <div>
        <h2>Related Notes</h2>
        ${renderNotesList(notes, currency)}
      </div>
    </section>
  `;
}

function renderNotesList(
  notes: Record<string, unknown>[],
  currency: unknown,
): string {
  if (notes.length === 0)
    return '<p class="muted">No issued notes attached.</p>';
  return `
    <ul class="note-list">
      ${notes
        .map(
          (note) =>
            `<li><strong>${text(note.noteNumber)}</strong> · ${text(note.type)} · ${text(note.status)} · ${moneyText(note.netAmount, note.currency ?? currency)}</li>`,
        )
        .join('')}
    </ul>
  `;
}

function renderNotesTable(
  notes: Record<string, unknown>[],
  currency: unknown,
): string {
  return `
    <section class="section">
      <h2>Related Endorsement Notes</h2>
      ${renderNotesList(notes, currency)}
    </section>
  `;
}

function renderConditions(endorsement: Record<string, unknown> | null): string {
  const changeSummary = getRecord(endorsement?.changeSummary);
  const clauses = arrayOfRecords(changeSummary?.clauses);
  const warranties = arrayOfRecords(changeSummary?.warranties);
  const customFields =
    arrayOfRecords(
      getNested(getSnapshotPlacement(endorsement?.proposedSnapshot), [
        'businessDetails',
        'customFields',
      ]),
    ) || [];

  return `
    <section class="section">
      <h2>Clauses, Warranties and Conditions</h2>
      ${
        clauses.length || warranties.length || customFields.length
          ? `<ul class="note-list">
              ${clauses.map((item) => `<li>Clause: ${text(item.label ?? item.value ?? item)}</li>`).join('')}
              ${warranties.map((item) => `<li>Warranty: ${text(item.label ?? item.value ?? item)}</li>`).join('')}
              ${customFields.map((item) => `<li>${text(item.label)}: ${text(item.value)}</li>`).join('')}
            </ul>`
          : `<p class="muted">All other terms, clauses and warranties remain as previously agreed unless expressly amended above.</p>`
      }
    </section>
  `;
}

function renderSignatureBlock(branding: unknown): string {
  const record = getRecord(branding);
  const signatoryName =
    record?.authorizedSignatoryName ?? record?.signatoryName;
  const signatoryTitle =
    record?.authorizedSignatoryTitle ??
    record?.signatoryTitle ??
    'Authorised Signatory';
  return `
    <section class="signature-block">
      <div>
        <div class="signature-line"></div>
        <p><strong>${text(signatoryName, 'Authorised Signatory')}</strong></p>
        <p>${text(signatoryTitle)}</p>
      </div>
      <div>
        <div class="signature-line"></div>
        <p><strong>Acknowledgement</strong></p>
        <p>Name / Stamp / Date</p>
      </div>
    </section>
  `;
}

function getSnapshotPlacement(value: unknown): Record<string, unknown> | null {
  const snapshot = getRecord(value);
  const nested = getRecord(snapshot?.placement);
  return nested ?? snapshot;
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!getRecord(item))
    : [];
}

function formatValue(
  value: unknown,
  type: 'amount' | 'percent' | 'date' | 'text',
  currency: unknown,
): string {
  if (type === 'amount') return moneyText(value, currency);
  if (type === 'percent') return percentText(value);
  if (type === 'date') return dateText(value);
  return text(value);
}

function comparableValue(value: unknown): string {
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
  if (typeof value === 'object') return JSON.stringify(value);
  return '';
}

type EndorsementClosingTotals = {
  premium: number;
  commission: number;
  brokerage: number;
  net: number;
};

function sumClosingTotals(
  closings: Record<string, unknown>[],
): EndorsementClosingTotals {
  return closings.reduce<EndorsementClosingTotals>(
    (total, closing) => ({
      premium: total.premium + toNumber(closing.premiumSnapshot),
      commission: total.commission + toNumber(closing.commissionAmount),
      brokerage: total.brokerage + toNumber(closing.brokerageAmount),
      net: total.net + toNumber(closing.netPremium),
    }),
    { premium: 0, commission: 0, brokerage: 0, net: 0 },
  );
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

const endorsementCss = `
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #172033; font-size: 11px; }
  .letter-block { margin: 14px 0 18px; line-height: 1.55; color: #334155; }
  .letter-block p { margin: 4px 0; }
  .detail-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 18px; }
  .detail { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; background: rgba(255,255,255,.84); }
  .detail dt { color: #64748b; font-size: 8px; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 3px; }
  .detail dd { margin: 0; font-weight: 700; color: #172033; }
  .section { margin-top: 18px; break-inside: avoid; }
  .section h2 { margin: 0 0 8px; color: #173f5f; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
  .terms-table, .financial-table { width: 100%; border-collapse: collapse; background: rgba(255,255,255,.9); }
  .terms-table th, .terms-table td, .financial-table th, .financial-table td { border-bottom: 1px solid #e2e8f0; padding: 7px 8px; text-align: left; vertical-align: top; }
  .terms-table thead th { color: #64748b; font-size: 8px; text-transform: uppercase; letter-spacing: .08em; }
  .terms-table tbody th, .financial-table th { color: #475569; width: 30%; }
  .terms-table tr.changed td { font-weight: 700; color: #173f5f; }
  .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .note-list { margin: 0; padding-left: 16px; color: #334155; line-height: 1.5; }
  .muted { color: #64748b; font-style: italic; }
  .signature-block { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 30px; }
  .signature-line { border-bottom: 1px solid #172033; height: 28px; margin-bottom: 6px; }
  .signature-block p { margin: 2px 0; color: #475569; }
`;
