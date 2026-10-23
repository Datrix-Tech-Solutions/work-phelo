import type { TenantDocumentProfile } from '@/types/tenant-document-profile';
import type {
  TenantDocumentTemplate,
  TenantDocumentTemplateConfig,
} from '@/types/tenant-document-template';
import { DEFAULT_TEMPLATE, type DocumentTemplate } from './templateConfig';

/** Keys of the editor state that are stored as the template's layout config. */
const CONFIG_KEYS = [
  'showLogo',
  'logoPosition',
  'companyName',
  'identityLines',
  'showCompanyName',
  'companyNamePosition',
  'showQr',
  'qrValue',
  'qrPosition',
  'accent',
  'font',
  'paper',
  'margin',
  'footerLocation',
  'footerAddress',
  'footerTel',
  'showPageNumbers',
  'watermarkMode',
  'watermarkText',
  'watermarkTiled',
  'signatureEnabled',
  'signaturePosition',
  'signatureRules',
] as const satisfies readonly (keyof TenantDocumentTemplateConfig)[];

export function toTemplateConfig(template: DocumentTemplate): TenantDocumentTemplateConfig {
  return Object.fromEntries(
    CONFIG_KEYS.map((key) => [key, template[key]]),
  ) as unknown as TenantDocumentTemplateConfig;
}

/**
 * Editor state for a loaded template. Nothing saved yet → seed the letterhead
 * and footer from the company's document profile so the preview starts useful.
 */
export function toEditorTemplate(
  saved: TenantDocumentTemplate,
  profile: TenantDocumentProfile | undefined,
  previewDoc: DocumentTemplate['previewDoc'],
): DocumentTemplate {
  const config = { ...saved.config };

  if (saved.defaultsApplied && profile) {
    config.companyName = profile.displayName;
    config.identityLines = [
      profile.legalName !== profile.displayName ? profile.legalName : null,
      profile.registrationNumber ? `Reg. No. ${profile.registrationNumber}` : null,
      profile.physicalAddress,
      [profile.phone, profile.email].filter(Boolean).join(' · ') || null,
    ]
      .filter(Boolean)
      .join('\n');
    config.qrValue = profile.website ?? '';
    config.showQr = Boolean(profile.website);
    config.footerLocation = profile.physicalAddress ?? '';
    config.footerAddress = profile.postalAddress ?? '';
    config.footerTel = profile.phone ?? '';
  }

  return {
    ...DEFAULT_TEMPLATE,
    ...config,
    previewDoc,
    ...serverImages(saved, profile),
    signatoryName: profile?.authorizedSignatoryName ?? '',
    signatoryTitle: profile?.authorizedSignatoryTitle ?? '',
  };
}

/** Image fields always reflect what is stored on the server, never local edits. */
export function serverImages(
  saved: TenantDocumentTemplate | undefined,
  profile: TenantDocumentProfile | undefined,
): Pick<DocumentTemplate, 'logo' | 'signatureImage' | 'watermarkImage'> {
  return {
    logo: profile?.logoUrl ?? null,
    signatureImage: profile?.signatureUrl ?? null,
    watermarkImage: saved?.watermarkUrl ?? null,
  };
}

export function hasSignatoryChanges(
  template: DocumentTemplate,
  profile: TenantDocumentProfile | undefined,
): boolean {
  return (
    template.signatoryName.trim() !== (profile?.authorizedSignatoryName ?? '') ||
    template.signatoryTitle.trim() !== (profile?.authorizedSignatoryTitle ?? '')
  );
}
