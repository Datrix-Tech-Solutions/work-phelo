import { InternalServerErrorException } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { TenantAssetStorageService } from './tenant-asset-storage.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

const ENV_KEYS = [
  'AUTH_TENANT_ASSET_STORAGE_PROVIDER',
  'AUTH_TENANT_ASSET_S3_BUCKET',
  'AUTH_TENANT_ASSET_S3_REGION',
  'AUTH_TENANT_ASSET_S3_PREFIX',
  'AUTH_TENANT_ASSET_S3_ENDPOINT',
  'AUTH_TENANT_ASSET_S3_FORCE_PATH_STYLE',
  'AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS',
] as const;

describe('TenantAssetStorageService', () => {
  const originalEnv = new Map(
    ENV_KEYS.map((key) => [key, process.env[key]] as const),
  );

  afterEach(() => {
    for (const [key, value] of originalEnv) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('uploads assets to a tenant-scoped private object key', async () => {
    process.env.AUTH_TENANT_ASSET_STORAGE_PROVIDER = 's3';
    process.env.AUTH_TENANT_ASSET_S3_BUCKET = 'private-workphelo-assets';
    process.env.AUTH_TENANT_ASSET_S3_REGION = 'eu-west-1';
    process.env.AUTH_TENANT_ASSET_S3_PREFIX = 'tenant-assets';

    const service = new TenantAssetStorageService();
    const send = jest
      .fn<Promise<Record<string, never>>, [PutObjectCommand]>()
      .mockResolvedValue({});
    (
      service as unknown as {
        client: { send: typeof send };
      }
    ).client = { send };

    const result = await service.store({
      tenantId: 'tenant-1',
      assetType: 'logo',
      body: Buffer.from('logo'),
      contentType: 'image/png',
      originalFileName: 'company logo.png',
    });

    const command = send.mock.calls[0][0];
    expect(command.input).toMatchObject({
      Bucket: 'private-workphelo-assets',
      Key: expect.stringMatching(
        /^tenant-assets\/tenants\/tenant-1\/document-profile\/logo\/.+-company-logo\.png$/,
      ) as string,
      ContentType: 'image/png',
      Metadata: {
        tenantId: 'tenant-1',
        assetType: 'logo',
      },
    });
    expect(command.input).not.toHaveProperty('ACL');
    expect(result.objectKey).toContain(
      'tenant-assets/tenants/tenant-1/document-profile/logo/',
    );
    expect(result).not.toHaveProperty('url');
  });

  it('uploads branding assets to the branding namespace', async () => {
    process.env.AUTH_TENANT_ASSET_STORAGE_PROVIDER = 's3';
    process.env.AUTH_TENANT_ASSET_S3_BUCKET = 'private-workphelo-assets';
    process.env.AUTH_TENANT_ASSET_S3_REGION = 'eu-west-1';
    process.env.AUTH_TENANT_ASSET_S3_PREFIX = 'tenant-assets';

    const service = new TenantAssetStorageService();
    const send = jest
      .fn<Promise<Record<string, never>>, [PutObjectCommand]>()
      .mockResolvedValue({});
    (
      service as unknown as {
        client: { send: typeof send };
      }
    ).client = { send };

    const result = await service.storeBrandingAsset({
      tenantId: 'tenant-1',
      assetType: 'app-logo',
      body: Buffer.from('logo'),
      contentType: 'image/png',
      originalFileName: 'company logo.png',
    });

    const command = send.mock.calls[0][0];
    expect(command.input).toMatchObject({
      Bucket: 'private-workphelo-assets',
      Key: expect.stringMatching(
        /^tenant-assets\/tenants\/tenant-1\/branding\/app-logo\/.+-company-logo\.png$/,
      ) as string,
      ContentType: 'image/png',
      Metadata: {
        tenantId: 'tenant-1',
        assetType: 'app-logo',
      },
    });
    expect(result.objectKey).toContain(
      'tenant-assets/tenants/tenant-1/branding/app-logo/',
    );
  });

  it('fails clearly when private storage is not configured', async () => {
    delete process.env.AUTH_TENANT_ASSET_S3_BUCKET;
    delete process.env.AUTH_TENANT_ASSET_S3_REGION;

    await expect(
      new TenantAssetStorageService().store({
        tenantId: 'tenant-1',
        assetType: 'signature',
        body: Buffer.from('signature'),
        contentType: 'image/png',
        originalFileName: 'signature.png',
      }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('creates a short-lived signed read URL for a stored asset', async () => {
    process.env.AUTH_TENANT_ASSET_STORAGE_PROVIDER = 's3';
    process.env.AUTH_TENANT_ASSET_S3_BUCKET = 'private-workphelo-assets';
    process.env.AUTH_TENANT_ASSET_S3_REGION = 'eu-west-1';
    process.env.AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS = '180';
    jest
      .mocked(getSignedUrl)
      .mockResolvedValue('https://storage.example/signed-logo');

    const now = jest.spyOn(Date, 'now').mockReturnValue(1_782_980_400_000);
    const service = new TenantAssetStorageService();
    const client = { send: jest.fn() };
    (
      service as unknown as {
        client: typeof client;
      }
    ).client = client;

    const result = await service.createSignedReadUrl({
      objectKey: 'tenant-assets/tenants/tenant-1/logo.png',
      mimeType: 'image/png',
      fileName: 'company logo.png',
    });

    expect(getSignedUrl).toHaveBeenCalledWith(
      client,
      expect.any(GetObjectCommand),
      { expiresIn: 180 },
    );
    const command = jest.mocked(getSignedUrl).mock
      .calls[0][1] as GetObjectCommand;
    expect(command.input).toMatchObject({
      Bucket: 'private-workphelo-assets',
      Key: 'tenant-assets/tenants/tenant-1/logo.png',
      ResponseContentType: 'image/png',
      ResponseContentDisposition: 'inline; filename="company-logo.png"',
    });
    expect(result).toEqual({
      readUrl: 'https://storage.example/signed-logo',
      expiresAt: '2026-07-02T08:23:00.000Z',
    });
    now.mockRestore();
  });
});
