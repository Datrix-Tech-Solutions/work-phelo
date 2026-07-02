import type { PlacementDocumentTemplateContext } from './closing-slip.template';

function display(value: unknown): string {
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

function escapeHtml(value: unknown): string {
  return display(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, fallback = '—'): string {
  return value === null || value === undefined || value === ''
    ? fallback
    : escapeHtml(value);
}

export const brokerDocumentCss = `
  .document-shell { position: relative; min-height: 250mm; padding-bottom: 22mm; }
  .broker-header {
    display: grid;
    grid-template-columns: 150px 1fr 92px;
    align-items: start;
    gap: 18px;
    border-bottom: 2px solid #173f5f;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  .broker-logo { display: flex; align-items: center; gap: 9px; color: #173f5f; }
  .broker-logo svg { width: 43px; height: 50px; flex: none; }
  .broker-logo-image { width: 130px; height: 58px; object-fit: contain; object-position: left center; }
  .broker-name { font-size: 17px; font-weight: 800; letter-spacing: .02em; }
  .broker-family { color: #64748b; font-size: 8px; letter-spacing: .12em; text-transform: uppercase; }
  .document-title { text-align: center; }
  .document-title h1 {
    margin: 5px 0 4px;
    color: #172033;
    font-size: 20px;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .document-title p { margin: 2px 0; color: #64748b; font-size: 9px; }
  .document-qr { text-align: right; }
  .document-qr img { width: 74px; height: 74px; object-fit: contain; }
  .document-qr span { display: block; color: #64748b; font-size: 7px; text-align: center; }
  .broker-watermark {
    position: fixed;
    z-index: -1;
    left: 50%;
    top: 51%;
    width: 290px;
    height: 335px;
    transform: translate(-50%, -50%);
    opacity: .055;
  }
  .broker-watermark-image {
    position: fixed;
    z-index: -1;
    left: 50%;
    top: 51%;
    width: 360px;
    height: 360px;
    object-fit: contain;
    transform: translate(-50%, -50%);
    opacity: .07;
  }
  .broker-footer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    border-top: 1px solid #cbd5e1;
    padding-top: 8px;
    color: #64748b;
    font-size: 8px;
    text-align: center;
  }
`;

function shieldSvg(className = ''): string {
  return `<svg class="${escapeHtml(className)}" viewBox="0 0 120 140" aria-label="WorkPhelo shield">
    <path d="M60 5 108 24v41c0 34-19 57-48 70C31 122 12 99 12 65V24L60 5Z" fill="#173f5f"/>
    <path d="M60 18 96 32v32c0 25-13 44-36 56-23-12-36-31-36-56V32L60 18Z" fill="#fff"/>
    <path d="m33 50 12 43 15-28 15 28 12-43h-12l-5 20-10-22-10 22-5-20H33Z" fill="#d6a84b"/>
  </svg>`;
}

export function renderBrokerHeader(
  title: string,
  subtitle: string,
  context: PlacementDocumentTemplateContext,
  brandingValue?: unknown,
): string {
  const branding = getRecord(brandingValue);
  const productName = branding?.productName ?? 'WorkPhelo';
  const logoDataUrl =
    typeof branding?.logoDataUrl === 'string' ? branding.logoDataUrl : null;
  const headerColor =
    typeof branding?.documentHeaderColor === 'string'
      ? branding.documentHeaderColor
      : '#173f5f';
  return `
    <header class="broker-header" style="border-color:${escapeHtml(headerColor)}">
      <div class="broker-logo">
        ${logoDataUrl ? `<img class="broker-logo-image" src="${escapeHtml(logoDataUrl)}" alt="${text(productName)} logo" />` : shieldSvg()}
        ${
          logoDataUrl
            ? ''
            : `<div>
          <div class="broker-name">${text(productName)}</div>
          <div class="broker-family">${text(branding?.documentFamily, 'Reinsurance Operations')}</div>
        </div>`
        }
      </div>
      <div class="document-title">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
        <p>${text(context.documentNumber)}</p>
      </div>
      <div class="document-qr">
        ${context.qrCodeDataUrl ? `<img src="${escapeHtml(context.qrCodeDataUrl)}" alt="Document verification QR code" />` : ''}
        <span>Document verification</span>
      </div>
    </header>
  `;
}

export function renderBrokerWatermark(brandingValue?: unknown): string {
  const branding = getRecord(brandingValue);
  const watermarkDataUrl =
    typeof branding?.watermarkDataUrl === 'string'
      ? branding.watermarkDataUrl
      : null;
  return watermarkDataUrl
    ? `<img class="broker-watermark-image" src="${escapeHtml(watermarkDataUrl)}" alt="" />`
    : shieldSvg('broker-watermark');
}

export function renderBrokerFooter(
  context: PlacementDocumentTemplateContext,
  brandingValue?: unknown,
): string {
  const branding = getRecord(brandingValue);
  const address =
    branding?.addressLine ?? branding?.address ?? branding?.location;
  const phone = branding?.telephone ?? branding?.phone;
  const contact = [address, phone]
    .filter(Boolean)
    .map((value) => text(value))
    .join(' · ');
  return `
    <footer class="broker-footer">
      ${contact || 'WorkPhelo · Reinsurance Operations'}
      · ${text(context.documentNumber)}
    </footer>
  `;
}
