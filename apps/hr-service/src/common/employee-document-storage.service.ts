import { randomUUID } from 'crypto';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v2 as cloudinary } from 'cloudinary';

const CLOUDINARY_OBJECT_KEY_PREFIX = 'cloudinary';
const CLOUDINARY_RESOURCE_TYPES = ['image', 'raw'] as const;
type CloudinaryResourceType = (typeof CLOUDINARY_RESOURCE_TYPES)[number];
const CLOUDINARY_DELIVERY_TYPE = 'authenticated';
const DEFAULT_SIGNED_URL_TTL_SECONDS = 120;
const MAX_SIGNED_URL_TTL_SECONDS = 900;

export interface StoreEmployeeDocumentInput {
  tenantId: string;
  employeeId: string;
  body: Buffer;
  contentType: string;
  originalFileName: string;
}

export interface StoredEmployeeDocument {
  objectKey: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
}

export interface SignedEmployeeDocument {
  readUrl: string;
  expiresAt: string;
}

/**
 * Write-capable counterpart to AvatarUrlResolverService: stores and deletes
 * private "company document" objects, sharing the same AUTH_TENANT_ASSET_* /
 * CLOUDINARY_* env vars and bucket/account as auth-service's
 * TenantAssetStorageService — no separate config needed.
 */
@Injectable()
export class EmployeeDocumentStorageService {
  private readonly logger = new Logger(EmployeeDocumentStorageService.name);
  private s3Client?: S3Client;
  private cloudinaryConfigured = false;

  async store(
    input: StoreEmployeeDocumentInput,
  ): Promise<StoredEmployeeDocument> {
    return this.env('AUTH_TENANT_ASSET_STORAGE_PROVIDER', 's3')
      .trim()
      .toLowerCase() === 'cloudinary'
      ? this.storeCloudinary(input)
      : this.storeS3(input);
  }

  async createSignedReadUrl(input: {
    objectKey: string;
    mimeType?: string;
    fileName?: string;
  }): Promise<SignedEmployeeDocument> {
    return input.objectKey.startsWith(`${CLOUDINARY_OBJECT_KEY_PREFIX}:`)
      ? this.signedUrlCloudinary(input)
      : this.signedUrlS3(input);
  }

  async delete(objectKey: string): Promise<void> {
    if (objectKey.startsWith(`${CLOUDINARY_OBJECT_KEY_PREFIX}:`)) {
      await this.deleteCloudinary(objectKey);
    } else {
      await this.deleteS3(objectKey);
    }
  }

  // ── S3 ───────────────────────────────────────────────────────────────────

  private async storeS3(
    input: StoreEmployeeDocumentInput,
  ): Promise<StoredEmployeeDocument> {
    const bucket = this.requireEnv('AUTH_TENANT_ASSET_S3_BUCKET');
    const fileName = this.safeFileName(input.originalFileName);
    const objectKey = [
      this.cleanPrefix(
        this.env('AUTH_TENANT_ASSET_S3_PREFIX', 'tenant-assets'),
      ),
      'tenants',
      input.tenantId,
      'employee-document',
      'employees',
      input.employeeId,
      `${randomUUID()}-${fileName}`,
    ]
      .filter(Boolean)
      .join('/');

    await this.s3().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: { tenantId: input.tenantId, employeeId: input.employeeId },
      }),
    );

    return {
      objectKey,
      mimeType: input.contentType,
      fileName,
      sizeBytes: input.body.byteLength,
    };
  }

  private async signedUrlS3(input: {
    objectKey: string;
    mimeType?: string;
    fileName?: string;
  }): Promise<SignedEmployeeDocument> {
    const bucket = this.requireEnv('AUTH_TENANT_ASSET_S3_BUCKET');
    const expiresIn = this.signedUrlTtlSeconds();
    const readUrl = await getSignedUrl(
      this.s3(),
      new GetObjectCommand({
        Bucket: bucket,
        Key: input.objectKey,
        ...(input.mimeType ? { ResponseContentType: input.mimeType } : {}),
        ...(input.fileName
          ? {
              ResponseContentDisposition: `inline; filename="${this.safeFileName(input.fileName)}"`,
            }
          : {}),
      }),
      { expiresIn },
    );
    return {
      readUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  private async deleteS3(objectKey: string): Promise<void> {
    const bucket = this.requireEnv('AUTH_TENANT_ASSET_S3_BUCKET');
    await this.s3().send(
      new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }),
    );
  }

  private s3(): S3Client {
    if (!this.s3Client) {
      const region = this.env('AUTH_TENANT_ASSET_S3_REGION');
      const endpoint = this.env('AUTH_TENANT_ASSET_S3_ENDPOINT');
      const forcePathStyle =
        this.env('AUTH_TENANT_ASSET_S3_FORCE_PATH_STYLE', 'false')
          .trim()
          .toLowerCase() === 'true';
      this.s3Client = new S3Client({
        region,
        forcePathStyle,
        ...(endpoint ? { endpoint } : {}),
      });
    }
    return this.s3Client;
  }

  // ── Cloudinary ───────────────────────────────────────────────────────────

  private async storeCloudinary(
    input: StoreEmployeeDocumentInput,
  ): Promise<StoredEmployeeDocument> {
    this.configureCloudinary();
    const fileName = this.safeFileName(input.originalFileName);
    // Non-image files (PDF, Word, Excel, ...) must go in as Cloudinary's
    // 'raw' resource type — 'image' rejects/mangles anything that isn't a
    // picture.
    const resourceType: CloudinaryResourceType = input.contentType.startsWith(
      'image/',
    )
      ? 'image'
      : 'raw';

    const upload = await new Promise<{ public_id?: string }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: resourceType,
            type: CLOUDINARY_DELIVERY_TYPE,
            folder: this.cloudinaryFolder(input.tenantId, input.employeeId),
            public_id: randomUUID(),
            overwrite: false,
            unique_filename: false,
            use_filename: false,
            filename_override: fileName,
          },
          (error, result) => {
            if (error) {
              reject(
                new Error(
                  error instanceof Error
                    ? error.message
                    : 'Cloudinary upload failed',
                ),
              );
              return;
            }
            if (!result) {
              reject(
                new InternalServerErrorException(
                  'Cloudinary upload returned no result',
                ),
              );
              return;
            }
            resolve(result);
          },
        );
        stream.end(input.body);
      },
    );

    if (!upload.public_id) {
      throw new InternalServerErrorException(
        'Cloudinary did not return a public ID',
      );
    }

    return {
      objectKey: [
        CLOUDINARY_OBJECT_KEY_PREFIX,
        resourceType,
        CLOUDINARY_DELIVERY_TYPE,
        upload.public_id,
      ].join(':'),
      mimeType: input.contentType,
      fileName,
      sizeBytes: input.body.byteLength,
    };
  }

  private async signedUrlCloudinary(input: {
    objectKey: string;
    mimeType?: string;
    fileName?: string;
  }): Promise<SignedEmployeeDocument> {
    this.configureCloudinary();
    const { resourceType, publicId } = this.parseCloudinaryObjectKey(
      input.objectKey,
    );
    const expiresIn = this.signedUrlTtlSeconds();
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const extension = input.fileName?.split('.').pop()?.trim().toLowerCase();
    const readUrl = cloudinary.utils.private_download_url(
      publicId,
      extension && /^[a-z0-9]+$/.test(extension) ? extension : 'bin',
      {
        resource_type: resourceType,
        type: CLOUDINARY_DELIVERY_TYPE,
        expires_at: Math.floor(expiresAt.getTime() / 1000),
        attachment: false,
      },
    );
    return { readUrl, expiresAt: expiresAt.toISOString() };
  }

  private async deleteCloudinary(objectKey: string): Promise<void> {
    this.configureCloudinary();
    const { resourceType, publicId } = this.parseCloudinaryObjectKey(objectKey);
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: CLOUDINARY_DELIVERY_TYPE,
      invalidate: true,
    });
  }

  private parseCloudinaryObjectKey(objectKey: string): {
    resourceType: CloudinaryResourceType;
    publicId: string;
  } {
    const parts = objectKey.split(':');
    const resourceType = parts[1] as CloudinaryResourceType;
    if (
      parts.length < 4 ||
      parts[0] !== CLOUDINARY_OBJECT_KEY_PREFIX ||
      !CLOUDINARY_RESOURCE_TYPES.includes(resourceType) ||
      parts[2] !== CLOUDINARY_DELIVERY_TYPE
    ) {
      throw new InternalServerErrorException(
        'Employee document reference is invalid',
      );
    }
    return { resourceType, publicId: parts.slice(3).join(':') };
  }

  private configureCloudinary(): void {
    if (this.cloudinaryConfigured) return;
    cloudinary.config({
      cloud_name: this.env('CLOUDINARY_CLOUD_NAME'),
      api_key: this.env('CLOUDINARY_API_KEY'),
      api_secret: this.env('CLOUDINARY_API_SECRET'),
      secure: true,
    });
    this.cloudinaryConfigured = true;
  }

  private cloudinaryFolder(tenantId: string, employeeId: string): string {
    return [
      this.cleanPrefix(
        this.env('AUTH_TENANT_ASSET_CLOUDINARY_ROOT_FOLDER', ''),
      ),
      this.cleanPrefix(
        this.env('AUTH_TENANT_ASSET_S3_PREFIX', 'tenant-assets'),
      ),
      'tenants',
      tenantId,
      'employee-document',
      'employees',
      employeeId,
    ]
      .filter(Boolean)
      .join('/');
  }

  // ── Shared ───────────────────────────────────────────────────────────────

  private signedUrlTtlSeconds(): number {
    const parsed = Number(
      this.env(
        'AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS',
        String(DEFAULT_SIGNED_URL_TTL_SECONDS),
      ),
    );
    if (!Number.isSafeInteger(parsed) || parsed <= 0)
      return DEFAULT_SIGNED_URL_TTL_SECONDS;
    return Math.min(parsed, MAX_SIGNED_URL_TTL_SECONDS);
  }

  private safeFileName(fileName: string): string {
    const cleaned = fileName
      .trim()
      .replace(/[^\w.\- ]+/g, '_')
      .replace(/\s+/g, '-')
      .slice(0, 160);
    return cleaned || 'document';
  }

  private cleanPrefix(prefix: string): string {
    return prefix.trim().replace(/^\/+|\/+$/g, '');
  }

  private env(name: string, fallback = ''): string {
    return process.env[name]?.trim() || fallback;
  }

  private requireEnv(name: string): string {
    const value = this.env(name);
    if (!value) {
      throw new InternalServerErrorException(`${name} is not configured`);
    }
    return value;
  }
}
