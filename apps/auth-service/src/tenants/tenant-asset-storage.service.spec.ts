import { InternalServerErrorException } from '@nestjs/common';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { TenantAssetStorageService } from './tenant-asset-storage.service';

const ENV_KEYS = [
  'AUTH_TENANT_ASSET_STORAGE_PROVIDER',
  'AUTH_TENANT_ASSET_S3_BUCKET',
  'AUTH_TENANT_ASSET_S3_REGION',
  'AUTH_TENANT_ASSET_S3_PREFIX',
  'AUTH_TENANT_ASSET_S3_ENDPOINT',
  'AUTH_TENANT_ASSET_S3_FORCE_PATH_STYLE',
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
});
