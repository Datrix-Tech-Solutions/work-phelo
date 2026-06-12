import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorePdfInput {
  tenantId: string;
  placementId: string;
  documentId: string;
  version: number;
  documentNumber: string;
  body: Buffer;
  checksum: string;
  contentType: string;
}

export interface StoredPdfResult {
  storageProvider: 'S3';
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface SignedDocumentUrlResult {
  url: string;
  expiresAt: Date;
  mimeType: string;
  fileName: string;
}

interface S3DocumentStorageConfig {
  bucket: string;
  region: string;
  prefix: string;
  endpoint?: string;
  forcePathStyle: boolean;
  signedUrlTtlSeconds: number;
}

@Injectable()
export class S3DocumentStorageService {
  private client?: S3Client;

  async storePdf(input: StorePdfInput): Promise<StoredPdfResult> {
    const config = this.config();
    const objectKey = this.objectKey(config.prefix, input);
    const fileName = `${input.documentNumber}.pdf`;

    await this.s3(config).send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: {
          checksum: input.checksum,
          tenantId: input.tenantId,
          placementId: input.placementId,
          documentId: input.documentId,
        },
      }),
    );

    return {
      storageProvider: 'S3',
      objectKey,
      fileName,
      mimeType: input.contentType,
      sizeBytes: input.body.byteLength,
    };
  }

  async signedDownloadUrl(input: {
    objectKey: string;
    mimeType: string;
    fileName: string;
  }): Promise<SignedDocumentUrlResult> {
    const config = this.config();
    const expiresAt = new Date(Date.now() + config.signedUrlTtlSeconds * 1000);
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: input.objectKey,
      ResponseContentType: input.mimeType,
      ResponseContentDisposition: `inline; filename="${input.fileName}"`,
    });

    const url = await getSignedUrl(this.s3(config), command, {
      expiresIn: config.signedUrlTtlSeconds,
    });

    return {
      url,
      expiresAt,
      mimeType: input.mimeType,
      fileName: input.fileName,
    };
  }

  private s3(config: S3DocumentStorageConfig): S3Client {
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

  private config(): S3DocumentStorageConfig {
    const provider = this.env('REINSURANCE_DOCUMENT_STORAGE_PROVIDER', 's3');
    if (provider.toLowerCase() !== 's3') {
      throw new InternalServerErrorException(
        'Reinsurance document storage provider is not configured for S3',
      );
    }

    const bucket = this.env('REINSURANCE_DOCUMENT_S3_BUCKET');
    const region = this.env('REINSURANCE_DOCUMENT_S3_REGION');
    if (!bucket || !region) {
      throw new InternalServerErrorException(
        'Reinsurance document S3 bucket/region configuration is missing',
      );
    }

    return {
      bucket,
      region,
      prefix: this.env('REINSURANCE_DOCUMENT_S3_PREFIX', 'reinsurance'),
      endpoint: this.env('REINSURANCE_DOCUMENT_S3_ENDPOINT'),
      forcePathStyle:
        this.env('REINSURANCE_DOCUMENT_S3_FORCE_PATH_STYLE', 'false')
          .toLowerCase()
          .trim() === 'true',
      signedUrlTtlSeconds: this.positiveInt(
        this.env('REINSURANCE_DOCUMENT_SIGNED_URL_TTL_SECONDS', '300'),
        300,
      ),
    };
  }

  private objectKey(prefix: string, input: StorePdfInput): string {
    return [
      this.cleanPrefix(prefix),
      'tenants',
      input.tenantId,
      'placements',
      input.placementId,
      'documents',
      input.documentId,
      `v${input.version}`,
      `${input.documentNumber}.pdf`,
    ]
      .filter(Boolean)
      .join('/');
  }

  private cleanPrefix(prefix: string): string {
    return prefix.trim().replace(/^\/+|\/+$/g, '');
  }

  private positiveInt(value: string, fallback: number): number {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private env(key: string, fallback = ''): string {
    return process.env[key]?.trim() ?? fallback;
  }
}
