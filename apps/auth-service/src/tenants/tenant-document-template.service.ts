import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TenantDocumentTemplate } from '../../prisma/generated/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DOCUMENT_TEMPLATE_DOCUMENT_KEYS,
  DocumentTemplateConfigDto,
  TenantDocumentTemplateResponseDto,
  UpsertTenantDocumentTemplateDto,
} from './dto/tenant-document-template.dto';
import { TenantAssetStorageService } from './tenant-asset-storage.service';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);
const WATERMARK_MAX_BYTES = 2 * 1024 * 1024;

export const DEFAULT_DOCUMENT_TEMPLATE_CONFIG: DocumentTemplateConfigDto = {
  showLogo: true,
  logoPosition: 'start',
  companyName: '',
  identityLines: '',
  showCompanyName: true,
  companyNamePosition: 'middle',
  showQr: false,
  qrValue: '',
  qrPosition: 'end',
  accent: '#1e3a8a',
  font: 'sans',
  paper: 'a4',
  margin: 'comfortable',
  footerLocation: '',
  footerAddress: '',
  footerTel: '',
  showPageNumbers: true,
  watermarkMode: 'none',
  watermarkText: 'DRAFT',
  watermarkTiled: false,
  signatureEnabled: false,
  signaturePosition: 'left',
  signatureRules: Object.fromEntries(
    DOCUMENT_TEMPLATE_DOCUMENT_KEYS.map((key) => [key, false]),
  ) as DocumentTemplateConfigDto['signatureRules'],
};

@Injectable()
export class TenantDocumentTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: TenantAssetStorageService,
    private readonly audit: AuditService,
  ) {}

  async get(tenantId: string): Promise<TenantDocumentTemplateResponseDto> {
    await this.assertTenantExists(tenantId);
    const template = await this.prisma.tenantDocumentTemplate.findUnique({
      where: { tenantId },
    });
    return this.toResponse(tenantId, template);
  }

  async upsert(
    tenantId: string,
    actorUserId: string,
    dto: UpsertTenantDocumentTemplateDto,
  ): Promise<TenantDocumentTemplateResponseDto> {
    await this.assertTenantExists(tenantId);
    const config = this.normaliseConfig(dto.config);
    const existing = await this.prisma.tenantDocumentTemplate.findUnique({
      where: { tenantId },
      select: { version: true },
    });
    this.assertExpectedVersion(dto.expectedVersion, existing?.version ?? 0);

    const json = config as unknown as Prisma.InputJsonValue;
    let saved: TenantDocumentTemplate;
    if (!existing) {
      try {
        saved = await this.prisma.tenantDocumentTemplate.create({
          data: {
            tenantId,
            config: json,
            version: 1,
            createdByUserId: actorUserId,
            updatedByUserId: actorUserId,
          },
        });
      } catch (error) {
        // Lost a create race with another save for the same tenant.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            'The document template was changed by someone else. Reload and try again.',
          );
        }
        throw error;
      }
    } else {
      // The version in the where clause makes the check-and-write atomic.
      const result = await this.prisma.tenantDocumentTemplate.updateMany({
        where: { tenantId, version: existing.version },
        data: {
          config: json,
          version: { increment: 1 },
          updatedByUserId: actorUserId,
        },
      });
      if (result.count === 0) {
        throw new ConflictException(
          'The document template was changed by someone else. Reload and try again.',
        );
      }
      saved = await this.findOrThrow(tenantId);
    }

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: existing ? 'UPDATE' : 'CREATE',
      resource: 'tenant-document-template',
      resourceId: tenantId,
      changes: { after: { version: saved.version } },
    });
    return this.toResponse(tenantId, saved);
  }

  async uploadWatermark(
    tenantId: string,
    actorUserId: string,
    file: Express.Multer.File | undefined,
  ): Promise<TenantDocumentTemplateResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    this.validateWatermark(file);
    const uploaded = file as Express.Multer.File;

    const previous = await this.prisma.tenantDocumentTemplate.findUnique({
      where: { tenantId },
      select: { watermarkObjectKey: true },
    });
    const stored = await this.storage.store({
      tenantId,
      tenantSlug: tenant.slug,
      assetType: 'watermark',
      body: uploaded.buffer,
      contentType: uploaded.mimetype,
      originalFileName: uploaded.originalname,
    });
    const assetData = {
      watermarkObjectKey: stored.objectKey,
      watermarkMimeType: stored.mimeType,
      watermarkFileName: stored.fileName,
      watermarkSizeBytes: stored.sizeBytes,
    };

    const saved = await this.prisma.tenantDocumentTemplate.upsert({
      where: { tenantId },
      create: {
        tenantId,
        config:
          DEFAULT_DOCUMENT_TEMPLATE_CONFIG as unknown as Prisma.InputJsonValue,
        ...assetData,
        version: 1,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
      },
      update: {
        ...assetData,
        version: { increment: 1 },
        updatedByUserId: actorUserId,
      },
    });
    await this.deleteQuietly(previous?.watermarkObjectKey);
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'UPDATE',
      resource: 'tenant-document-template',
      resourceId: tenantId,
      changes: {
        after: {
          assetType: 'watermark',
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
        },
      },
    });
    return this.toResponse(tenantId, saved);
  }

  async removeWatermark(
    tenantId: string,
    actorUserId: string,
  ): Promise<TenantDocumentTemplateResponseDto> {
    await this.assertTenantExists(tenantId);
    const existing = await this.prisma.tenantDocumentTemplate.findUnique({
      where: { tenantId },
    });
    if (!existing?.watermarkObjectKey) {
      return this.toResponse(tenantId, existing);
    }

    const saved = await this.prisma.tenantDocumentTemplate.update({
      where: { tenantId },
      data: {
        watermarkObjectKey: null,
        watermarkMimeType: null,
        watermarkFileName: null,
        watermarkSizeBytes: null,
        version: { increment: 1 },
        updatedByUserId: actorUserId,
      },
    });
    await this.deleteQuietly(existing.watermarkObjectKey);
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'UPDATE',
      resource: 'tenant-document-template',
      resourceId: tenantId,
      changes: { after: { assetType: 'watermark', removed: true } },
    });
    return this.toResponse(tenantId, saved);
  }

  private async findOrThrow(tenantId: string): Promise<TenantDocumentTemplate> {
    const template = await this.prisma.tenantDocumentTemplate.findUnique({
      where: { tenantId },
    });
    if (!template) throw new NotFoundException('Document template not found');
    return template;
  }

  private async assertTenantExists(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
  }

  private assertExpectedVersion(
    expected: number | undefined,
    current: number,
  ): void {
    if (expected !== undefined && expected !== current) {
      throw new ConflictException(
        'The document template was changed by someone else. Reload and try again.',
      );
    }
  }

  /** Trim free text and make sure every known document key has a boolean rule. */
  private normaliseConfig(
    config: DocumentTemplateConfigDto,
  ): DocumentTemplateConfigDto {
    const rules = config.signatureRules as Record<string, unknown>;
    const unknownKey = Object.keys(rules).find(
      (key) =>
        !(DOCUMENT_TEMPLATE_DOCUMENT_KEYS as readonly string[]).includes(key),
    );
    if (unknownKey) {
      throw new BadRequestException(
        `Unknown document type in signatureRules: ${unknownKey}`,
      );
    }
    const signatureRules = Object.fromEntries(
      DOCUMENT_TEMPLATE_DOCUMENT_KEYS.map((key) => {
        const value = rules[key];
        if (value !== undefined && typeof value !== 'boolean') {
          throw new BadRequestException(
            `signatureRules.${key} must be a boolean`,
          );
        }
        return [key, value ?? false];
      }),
    ) as DocumentTemplateConfigDto['signatureRules'];

    return {
      ...config,
      companyName: config.companyName.trim(),
      identityLines: config.identityLines.trim(),
      qrValue: config.qrValue.trim(),
      footerLocation: config.footerLocation.trim(),
      footerAddress: config.footerAddress.trim(),
      footerTel: config.footerTel.trim(),
      watermarkText: config.watermarkText.trim(),
      signatureRules,
    };
  }

  private validateWatermark(file: Express.Multer.File | undefined): void {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Watermark image is required.');
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Image must be PNG, JPEG or WEBP.');
    }
    if (!this.matchesImageSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException(
        'Image content does not match its declared MIME type.',
      );
    }
    if (
      file.size > WATERMARK_MAX_BYTES ||
      file.buffer.byteLength > WATERMARK_MAX_BYTES
    ) {
      throw new BadRequestException(
        `Watermark image exceeds the ${WATERMARK_MAX_BYTES / 1024 / 1024} MB limit.`,
      );
    }
  }

  private matchesImageSignature(buffer: Buffer, mimeType: string): boolean {
    if (mimeType === 'image/png') {
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    if (mimeType === 'image/jpeg') {
      return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    }
    if (mimeType === 'image/webp') {
      return (
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    }
    return false;
  }

  /** The replaced object is only clean-up; a failed delete must not fail the save. */
  private async deleteQuietly(objectKey: string | null | undefined) {
    if (!objectKey) return;
    try {
      await this.storage.delete(objectKey);
    } catch {
      // Orphaned object — harmless, the record no longer references it.
    }
  }

  private async toResponse(
    tenantId: string,
    template: TenantDocumentTemplate | null,
  ): Promise<TenantDocumentTemplateResponseDto> {
    let watermarkUrl: string | null = null;
    if (
      template?.watermarkObjectKey &&
      template.watermarkMimeType &&
      template.watermarkFileName
    ) {
      watermarkUrl = (
        await this.storage.createSignedReadUrl({
          objectKey: template.watermarkObjectKey,
          mimeType: template.watermarkMimeType,
          fileName: template.watermarkFileName,
        })
      ).readUrl;
    }
    return {
      id: template?.id ?? null,
      tenantId,
      config: template
        ? {
            ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG,
            ...(template.config as unknown as Partial<DocumentTemplateConfigDto>),
          }
        : DEFAULT_DOCUMENT_TEMPLATE_CONFIG,
      watermarkFileName: template?.watermarkFileName ?? null,
      watermarkMimeType: template?.watermarkMimeType ?? null,
      watermarkSizeBytes: template?.watermarkSizeBytes ?? null,
      watermarkUrl,
      version: template?.version ?? 0,
      defaultsApplied: !template,
      updatedAt: template?.updatedAt ?? null,
    };
  }
}
