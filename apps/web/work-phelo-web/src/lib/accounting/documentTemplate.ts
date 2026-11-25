import { toEditorTemplate } from '@/components/molecules/settings/document-template/templateMapping';
import type { DocumentTemplate } from '@/components/molecules/settings/document-template/templateConfig';
import type { TenantDocumentRender } from '@/types/tenant-document-template';
import type { AccountingTradeDocumentStatus } from '@/types/accounting';

/** A document that isn't final says so across the page, whatever the template's watermark. */
const STATUS_WATERMARK: Partial<Record<AccountingTradeDocumentStatus, string>> = {
  DRAFT: 'DRAFT',
  REVERSED: 'REVERSED',
  REJECTED: 'REJECTED',
  VOIDED: 'VOIDED',
};

/**
 * The saved template as a real document uses it: images come from our own origin (so the
 * PDF can capture them) and the studio's placeholders for missing details are left out.
 * `version` busts the image cache after a re-upload.
 */
export function buildDocumentTemplate(
  render: TenantDocumentRender,
  {
    tenantId,
    status,
    version,
  }: { tenantId: string; status?: AccountingTradeDocumentStatus; version: number },
): DocumentTemplate {
  const template = toEditorTemplate(render.template, render.profile, 'invoice');
  const image = (asset: 'logo' | 'signature' | 'watermark', stored: string | null) =>
    stored
      ? `/api/documents/template-asset?tenantId=${encodeURIComponent(
          tenantId,
        )}&asset=${asset}&v=${version}`
      : null;
  const logo = image('logo', template.logo);
  const statusText = status && STATUS_WATERMARK[status];

  return {
    ...template,
    logo,
    signatureImage: image('signature', template.signatureImage),
    watermarkImage: image('watermark', template.watermarkImage),
    showLogo: template.showLogo && Boolean(logo),
    companyName: template.companyName || render.profile.displayName,
    showQr: template.showQr && Boolean(template.qrValue),
    ...(statusText
      ? { watermarkMode: 'text' as const, watermarkText: statusText, watermarkTiled: false }
      : {}),
  };
}
