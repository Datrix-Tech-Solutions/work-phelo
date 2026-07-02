import { randomUUID } from 'crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type TenantDocumentAssetType = 'logo' | 'signature';

export interface StoreTenantDocumentAssetInput {
  tenantId: string;
  assetType: TenantDocumentAssetType;
  body: Buffer;
  contentType: string;
  originalFileName: string;
}

export interface StoredTenantDocumentAsset {
  objectKey: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
}

export interface SignedTenantDocumentAsset {
  readUrl: string;
  expiresAt: string;
}

interface TenantAssetStorageConfig {
  bucket: string;
  region: string;
  prefix: string;
  endpoint?: string;
  forcePathStyle: boolean;
}

@Injectable()
export class TenantAssetStorageService {
  private client?: S3Client;

  async store(
    input: StoreTenantDocumentAssetInput,
  ): Promise<StoredTenantDocumentAsset> {
    const config = this.config();
    const fileName = this.safeFileName(input.originalFileName);
    const objectKey = [
      this.cleanPrefix(config.prefix),
      'tenants',
      input.tenantId,
      'document-profile',
      input.assetType,
      `${randomUUID()}-${fileName}`,
    ]
      .filter(Boolean)
      .join('/');

    await this.s3(config).send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: {
          tenantId: input.tenantId,
          assetType: input.assetType,
        },
      }),
    );

    return {
      objectKey,
      mimeType: input.contentType,
      fileName,
      sizeBytes: input.body.byteLength,
    };
  }

  async createSignedReadUrl(input: {
    objectKey: string;
    mimeType: string;
    fileName: string;
  }): Promise<SignedTenantDocumentAsset> {
    const config = this.config();
    const expiresIn = this.signedUrlTtlSeconds();
    const readUrl = await getSignedUrl(
      this.s3(config),
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: input.objectKey,
        ResponseContentType: input.mimeType,
        ResponseContentDisposition: `inline; filename="${this.safeFileName(input.fileName)}"`,
      }),
      { expiresIn },
    );

    return {
      readUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  private s3(config: TenantAssetStorageConfig): S3Client {
    if (!this.client) {
      const clientConfig: S3ClientConfig = {
        region: config.region,
        forcePathStyle: config.forcePathStyle,
        ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      };
      this.client = new S3Client(clientConfig);
    }
    return this.client;
  }

  private config(): TenantAssetStorageConfig {
    const provider = this.env('AUTH_TENANT_ASSET_STORAGE_PROVIDER', 's3');
    if (provider.toLowerCase() !== 's3') {
      throw new InternalServerErrorException(
        'Tenant asset storage provider is not configured for S3',
      );
    }

    const bucket = this.env('AUTH_TENANT_ASSET_S3_BUCKET');
    const region = this.env('AUTH_TENANT_ASSET_S3_REGION');
    if (!bucket || !region) {
      throw new InternalServerErrorException(
        'Tenant asset S3 bucket/region configuration is missing',
      );
    }

    return {
      bucket,
      region,
      prefix: this.env('AUTH_TENANT_ASSET_S3_PREFIX', 'tenant-assets'),
      endpoint: this.env('AUTH_TENANT_ASSET_S3_ENDPOINT'),
      forcePathStyle:
        this.env('AUTH_TENANT_ASSET_S3_FORCE_PATH_STYLE', 'false')
          .trim()
          .toLowerCase() === 'true',
    };
  }

  private safeFileName(fileName: string): string {
    const cleaned = fileName
      .trim()
      .replace(/[^\w.\- ]+/g, '_')
      .replace(/\s+/g, '-')
      .slice(0, 160);
    return cleaned || 'asset';
  }

  private cleanPrefix(prefix: string): string {
    return prefix.trim().replace(/^\/+|\/+$/g, '');
  }

  private signedUrlTtlSeconds(): number {
    const parsed = Number(
      this.env('AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS', '120'),
    );
    if (!Number.isSafeInteger(parsed) || parsed <= 0) return 120;
    return Math.min(parsed, 900);
  }

  private env(name: string, fallback = ''): string {
    return process.env[name]?.trim() || fallback;
  }
}
