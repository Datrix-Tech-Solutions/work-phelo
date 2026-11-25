import type {
  PreviewDoc,
  SignaturePosition,
  SlotPosition,
  WatermarkMode,
} from '@/components/molecules/settings/document-template/templateConfig';
import type { TenantDocumentProfile } from '@/types/tenant-document-profile';

/** The parts of the document profile that appear on a document. */
export type DocumentIdentity = Pick<
  TenantDocumentProfile,
  | 'displayName'
  | 'legalName'
  | 'registrationNumber'
  | 'physicalAddress'
  | 'postalAddress'
  | 'phone'
  | 'email'
  | 'website'
  | 'logoUrl'
  | 'signatureUrl'
  | 'authorizedSignatoryName'
  | 'authorizedSignatoryTitle'
>;

/** Layout settings persisted for a tenant's generated documents. */
export interface TenantDocumentTemplateConfig {
  showLogo: boolean;
  logoPosition: SlotPosition;
  companyName: string;
  identityLines: string;
  showCompanyName: boolean;
  companyNamePosition: SlotPosition;
  showQr: boolean;
  qrValue: string;
  qrPosition: SlotPosition;
  accent: string;
  font: 'sans' | 'serif';
  paper: 'a4' | 'letter';
  margin: 'comfortable' | 'compact';
  footerLocation: string;
  footerAddress: string;
  footerTel: string;
  showPageNumbers: boolean;
  watermarkMode: WatermarkMode;
  watermarkText: string;
  watermarkTiled: boolean;
  signatureEnabled: boolean;
  signaturePosition: SignaturePosition;
  signatureRules: Record<PreviewDoc, boolean>;
}

export interface TenantDocumentTemplate {
  id: string | null;
  tenantId: string;
  config: TenantDocumentTemplateConfig;
  watermarkFileName: string | null;
  watermarkMimeType: string | null;
  watermarkSizeBytes: number | null;
  /** Short-lived signed URL for the watermark image. */
  watermarkUrl: string | null;
  /** 0 until the first save. */
  version: number;
  defaultsApplied: boolean;
  updatedAt: string | null;
}

/** The read-only template and company identity used to render a real document. */
export interface TenantDocumentRender {
  template: Pick<TenantDocumentTemplate, 'config' | 'version' | 'defaultsApplied' | 'watermarkUrl'>;
  profile: DocumentIdentity;
}

export interface UpsertTenantDocumentTemplatePayload {
  config: TenantDocumentTemplateConfig;
  expectedVersion?: number;
}
