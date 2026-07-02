import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PublicTenantBrandingResponseDto,
  TenantBrandingResponseDto,
  UpdateTenantBrandingDto,
} from './dto/tenant-branding.dto';

const HEX_COLOR_PATTERN = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export const WORKPHELO_BRANDING_DEFAULTS = {
  primaryColor: '#0D2244',
  secondaryColor: '#85B7EB',
  accentColor: '#1E3A8A',
  sidebarColor: '#0D2244',
  emailHeaderColor: '#0D2244',
  documentHeaderColor: '#0D2244',
} as const;

const tenantBrandingInclude = {
  branding: true,
} as const;

type TenantWithBranding = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  branding?: {
    logoObjectKey: string | null;
    logoDisplayUrl: string | null;
    faviconObjectKey: string | null;
    faviconDisplayUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    accentColor: string | null;
    sidebarColor: string | null;
    emailHeaderColor: string | null;
    documentHeaderColor: string | null;
    updatedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

type BrandingData = Record<string, string | null>;

@Injectable()
export class TenantBrandingService {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenantId(tenantId: string): Promise<TenantBrandingResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: tenantBrandingInclude,
    });

    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.toPrivateResponse(tenant as TenantWithBranding);
  }

  async findPublicBySlug(
    slug: string,
  ): Promise<PublicTenantBrandingResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      include: tenantBrandingInclude,
    });

    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.toPublicResponse(tenant as TenantWithBranding);
  }

  async update(
    tenantId: string,
    dto: UpdateTenantBrandingDto,
    actorUserId: string,
  ): Promise<TenantBrandingResponseDto> {
    this.validateColors(dto);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: tenantBrandingInclude,
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    const data = this.buildUpdateData(dto, tenant.branding ?? null);

    await this.prisma.tenantBranding.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...data,
        updatedByUserId: actorUserId,
      },
      update: {
        ...data,
        updatedByUserId: actorUserId,
      },
    });

    return this.findByTenantId(tenantId);
  }

  private validateColors(dto: UpdateTenantBrandingDto): void {
    const colorFields = [
      'primaryColor',
      'secondaryColor',
      'accentColor',
      'sidebarColor',
      'emailHeaderColor',
      'documentHeaderColor',
    ] as const;

    for (const field of colorFields) {
      const value = dto[field];
      if (value == null) continue;
      if (!HEX_COLOR_PATTERN.test(value)) {
        throw new BadRequestException(
          `${field} must be a hex color value such as #0D2244`,
        );
      }
    }
  }

  private buildUpdateData(
    dto: UpdateTenantBrandingDto,
    existing: TenantWithBranding['branding'],
  ): BrandingData {
    const data: BrandingData = {};
    this.assignIfProvided(data, dto, 'logoObjectKey');
    this.assignIfProvided(data, dto, 'faviconObjectKey');
    this.assignIfProvided(data, dto, 'primaryColor');
    this.assignIfProvided(data, dto, 'secondaryColor');
    this.assignIfProvided(data, dto, 'accentColor');
    this.assignIfProvided(data, dto, 'sidebarColor');
    this.assignIfProvided(data, dto, 'emailHeaderColor');
    this.assignIfProvided(data, dto, 'documentHeaderColor');

    const logoObjectKey =
      dto.logoObjectKey !== undefined
        ? dto.logoObjectKey
        : (existing?.logoObjectKey ?? null);
    const faviconObjectKey =
      dto.faviconObjectKey !== undefined
        ? dto.faviconObjectKey
        : (existing?.faviconObjectKey ?? null);

    if (logoObjectKey) {
      data.logoDisplayUrl = null;
    } else {
      this.assignIfProvided(data, dto, 'logoDisplayUrl');
    }

    if (faviconObjectKey) {
      data.faviconDisplayUrl = null;
    } else {
      this.assignIfProvided(data, dto, 'faviconDisplayUrl');
    }

    return data;
  }

  private assignIfProvided(
    target: BrandingData,
    source: UpdateTenantBrandingDto,
    key: keyof UpdateTenantBrandingDto,
  ): void {
    if (source[key] !== undefined) {
      target[key] = source[key] ?? null;
    }
  }

  private toPrivateResponse(
    tenant: TenantWithBranding,
  ): TenantBrandingResponseDto {
    const branding = tenant.branding ?? null;
    return {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      logoObjectKey: branding?.logoObjectKey ?? null,
      logoDisplayUrl: branding?.logoObjectKey
        ? null
        : (branding?.logoDisplayUrl ?? tenant.logoUrl ?? null),
      faviconObjectKey: branding?.faviconObjectKey ?? null,
      faviconDisplayUrl: branding?.faviconObjectKey
        ? null
        : (branding?.faviconDisplayUrl ?? null),
      primaryColor:
        branding?.primaryColor ?? WORKPHELO_BRANDING_DEFAULTS.primaryColor,
      secondaryColor:
        branding?.secondaryColor ?? WORKPHELO_BRANDING_DEFAULTS.secondaryColor,
      accentColor:
        branding?.accentColor ?? WORKPHELO_BRANDING_DEFAULTS.accentColor,
      sidebarColor:
        branding?.sidebarColor ?? WORKPHELO_BRANDING_DEFAULTS.sidebarColor,
      emailHeaderColor:
        branding?.emailHeaderColor ??
        WORKPHELO_BRANDING_DEFAULTS.emailHeaderColor,
      documentHeaderColor:
        branding?.documentHeaderColor ??
        WORKPHELO_BRANDING_DEFAULTS.documentHeaderColor,
      updatedByUserId: branding?.updatedByUserId ?? null,
      createdAt: branding?.createdAt ?? null,
      updatedAt: branding?.updatedAt ?? null,
      defaultsApplied: !branding,
    };
  }

  private toPublicResponse(
    tenant: TenantWithBranding,
  ): PublicTenantBrandingResponseDto {
    const response = this.toPrivateResponse(tenant);
    return {
      tenantSlug: response.tenantSlug,
      tenantName: response.tenantName,
      logoDisplayUrl: response.logoDisplayUrl,
      faviconDisplayUrl: response.faviconDisplayUrl,
      primaryColor: response.primaryColor,
      secondaryColor: response.secondaryColor,
      accentColor: response.accentColor,
      sidebarColor: response.sidebarColor,
      emailHeaderColor: response.emailHeaderColor,
      documentHeaderColor: response.documentHeaderColor,
      defaultsApplied: response.defaultsApplied,
    };
  }
}
