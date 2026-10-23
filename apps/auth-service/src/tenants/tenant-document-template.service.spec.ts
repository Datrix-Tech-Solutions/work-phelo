import { BadRequestException, ConflictException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentTemplateConfigDto } from './dto/tenant-document-template.dto';
import { TenantAssetStorageService } from './tenant-asset-storage.service';
import {
  DEFAULT_DOCUMENT_TEMPLATE_CONFIG,
  TenantDocumentTemplateService,
} from './tenant-document-template.service';

const TENANT_ID = 'tenant-1';

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: 'template-1',
    tenantId: TENANT_ID,
    config: DEFAULT_DOCUMENT_TEMPLATE_CONFIG,
    watermarkObjectKey: null,
    watermarkMimeType: null,
    watermarkFileName: null,
    watermarkSizeBytes: null,
    version: 3,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

describe('TenantDocumentTemplateService', () => {
  let prisma: {
    tenant: { findUnique: jest.Mock };
    tenantDocumentTemplate: {
      findUnique: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let storage: {
    store: jest.Mock;
    createSignedReadUrl: jest.Mock;
    delete: jest.Mock;
  };
  let audit: { log: jest.Mock };
  let service: TenantDocumentTemplateService;

  beforeEach(() => {
    prisma = {
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: TENANT_ID, slug: 'acme' }),
      },
      tenantDocumentTemplate: {
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
    };
    storage = {
      store: jest.fn(),
      createSignedReadUrl: jest
        .fn()
        .mockResolvedValue({ readUrl: 'https://signed' }),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new TenantDocumentTemplateService(
      prisma as unknown as PrismaService,
      storage as unknown as TenantAssetStorageService,
      audit as unknown as AuditService,
    );
  });

  it('returns defaults at version 0 when nothing is saved', async () => {
    prisma.tenantDocumentTemplate.findUnique.mockResolvedValue(null);

    const result = await service.get(TENANT_ID);

    expect(result.version).toBe(0);
    expect(result.defaultsApplied).toBe(true);
    expect(result.config).toEqual(DEFAULT_DOCUMENT_TEMPLATE_CONFIG);
  });

  it('creates the template on first save', async () => {
    prisma.tenantDocumentTemplate.findUnique.mockResolvedValue(null);
    prisma.tenantDocumentTemplate.create.mockResolvedValue(
      record({ version: 1 }),
    );

    const result = await service.upsert(TENANT_ID, 'user-1', {
      config: { ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG, companyName: '  Acme  ' },
      expectedVersion: 0,
    });

    expect(result.version).toBe(1);
    const data = prisma.tenantDocumentTemplate.create.mock.calls[0][0].data;
    expect(data.config.companyName).toBe('Acme');
  });

  it('rejects a save made over a newer version', async () => {
    prisma.tenantDocumentTemplate.findUnique.mockResolvedValue({ version: 4 });

    await expect(
      service.upsert(TENANT_ID, 'user-1', {
        config: DEFAULT_DOCUMENT_TEMPLATE_CONFIG,
        expectedVersion: 3,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.tenantDocumentTemplate.updateMany).not.toHaveBeenCalled();
  });

  it('rejects when another save lands between the read and the write', async () => {
    prisma.tenantDocumentTemplate.findUnique.mockResolvedValue({ version: 3 });
    prisma.tenantDocumentTemplate.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.upsert(TENANT_ID, 'user-1', {
        config: DEFAULT_DOCUMENT_TEMPLATE_CONFIG,
        expectedVersion: 3,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects unknown document types in signatureRules', async () => {
    const config = {
      ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG,
      signatureRules: { nonsense: true },
    } as unknown as DocumentTemplateConfigDto;

    await expect(
      service.upsert(TENANT_ID, 'user-1', { config }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a watermark whose bytes do not match its MIME type', async () => {
    const file = {
      buffer: Buffer.from('not a png'),
      mimetype: 'image/png',
      size: 9,
      originalname: 'mark.png',
    } as Express.Multer.File;

    await expect(
      service.uploadWatermark(TENANT_ID, 'user-1', file),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.store).not.toHaveBeenCalled();
  });

  it('stores a watermark and deletes the one it replaces', async () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(8),
    ]);
    prisma.tenantDocumentTemplate.findUnique.mockResolvedValue({
      watermarkObjectKey: 'old-key',
    });
    storage.store.mockResolvedValue({
      objectKey: 'new-key',
      mimeType: 'image/png',
      fileName: 'mark.png',
      sizeBytes: png.byteLength,
    });
    prisma.tenantDocumentTemplate.upsert.mockResolvedValue(
      record({
        watermarkObjectKey: 'new-key',
        watermarkMimeType: 'image/png',
        watermarkFileName: 'mark.png',
        watermarkSizeBytes: png.byteLength,
      }),
    );

    const result = await service.uploadWatermark(TENANT_ID, 'user-1', {
      buffer: png,
      mimetype: 'image/png',
      size: png.byteLength,
      originalname: 'mark.png',
    } as Express.Multer.File);

    expect(result.watermarkUrl).toBe('https://signed');
    expect(storage.delete).toHaveBeenCalledWith('old-key');
  });
});
