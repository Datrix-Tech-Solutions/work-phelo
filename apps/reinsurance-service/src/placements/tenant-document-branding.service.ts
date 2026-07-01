import { Injectable, Logger } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';

const BRANDING_CACHE_MS = 5 * 60 * 1000;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 2_000;

type PublicTenantBranding = {
  tenantName?: string;
  logoDisplayUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  documentHeaderColor?: string;
};

export type TenantDocumentBrandingSnapshot = {
  productName: string;
  documentFamily: string;
  logoDataUrl: string | null;
  watermarkDataUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  documentHeaderColor: string;
};

@Injectable()
export class TenantDocumentBrandingService {
  private readonly logger = new Logger(TenantDocumentBrandingService.name);
  private readonly cache = new Map<
    string,
    { expiresAt: number; value: TenantDocumentBrandingSnapshot }
  >();

  async resolve(user: RequestUser): Promise<TenantDocumentBrandingSnapshot> {
    const cached = this.cache.get(user.tenantSlug);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const fallback = this.fallback(user.tenantName);
    try {
      const branding = await this.fetchBranding(user.tenantSlug);
      const logoDataUrl = branding.logoDisplayUrl
        ? await this.fetchLogoDataUrl(branding.logoDisplayUrl)
        : null;
      const value: TenantDocumentBrandingSnapshot = {
        productName: branding.tenantName?.trim() || user.tenantName,
        documentFamily: 'Reinsurance Operations',
        logoDataUrl,
        watermarkDataUrl: logoDataUrl,
        primaryColor: branding.primaryColor ?? fallback.primaryColor,
        secondaryColor: branding.secondaryColor ?? fallback.secondaryColor,
        accentColor: branding.accentColor ?? fallback.accentColor,
        documentHeaderColor:
          branding.documentHeaderColor ?? fallback.documentHeaderColor,
      };
      this.cache.set(user.tenantSlug, {
        expiresAt: Date.now() + BRANDING_CACHE_MS,
        value,
      });
      return value;
    } catch (error) {
      this.logger.warn(
        `Tenant branding unavailable for ${user.tenantSlug}; using tenant-safe fallback: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return fallback;
    }
  }

  private async fetchBranding(slug: string): Promise<PublicTenantBranding> {
    const baseUrl =
      process.env.AUTH_SERVICE_INTERNAL_URL?.replace(/\/+$/, '') ??
      (process.env.NODE_ENV === 'production'
        ? 'http://auth-service:4001'
        : 'http://127.0.0.1:5001');
    const response = await fetch(
      `${baseUrl}/tenants/slug/${encodeURIComponent(slug)}/branding`,
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    );
    if (!response.ok) {
      throw new Error(`Auth branding request returned ${response.status}`);
    }
    return (await response.json()) as PublicTenantBranding;
  }

  private async fetchLogoDataUrl(urlValue: string): Promise<string> {
    const url = new URL(urlValue);
    const isLocal =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) {
      throw new Error('Tenant logo must use HTTPS');
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Tenant logo request returned ${response.status}`);
    }
    const contentType = response.headers.get('content-type')?.split(';')[0];
    const allowedTypes = new Set([
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/svg+xml',
    ]);
    if (!contentType || !allowedTypes.has(contentType)) {
      throw new Error('Tenant logo has an unsupported image type');
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_LOGO_BYTES) {
      throw new Error('Tenant logo exceeds the 2 MB document limit');
    }
    return `data:${contentType};base64,${bytes.toString('base64')}`;
  }

  private fallback(tenantName: string): TenantDocumentBrandingSnapshot {
    return {
      productName: tenantName || 'WorkPhelo',
      documentFamily: 'Reinsurance Operations',
      logoDataUrl: null,
      watermarkDataUrl: null,
      primaryColor: '#173f5f',
      secondaryColor: '#85b7eb',
      accentColor: '#d6a84b',
      documentHeaderColor: '#173f5f',
    };
  }
}
