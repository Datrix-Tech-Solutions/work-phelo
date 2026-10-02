import { Injectable, Logger } from '@nestjs/common';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v2 as cloudinary } from 'cloudinary';

const CLOUDINARY_OBJECT_KEY_PREFIX = 'cloudinary';
const CLOUDINARY_RESOURCE_TYPE = 'image';
const CLOUDINARY_DELIVERY_TYPE = 'authenticated';
const DEFAULT_SIGNED_URL_TTL_SECONDS = 120;
const MAX_SIGNED_URL_TTL_SECONDS = 900;

/**
 * Read-only counterpart to auth-service's TenantAssetStorageService: resolves
 * a private avatar object key (synced from auth-service over RabbitMQ) into a
 * short-lived signed URL. Shares the same AUTH_TENANT_ASSET_* / CLOUDINARY_*
 * env vars and bucket/account as auth-service — no separate config needed.
 */
@Injectable()
export class AvatarUrlResolverService {
  private readonly logger = new Logger(AvatarUrlResolverService.name);
  private s3Client?: S3Client;
  private cloudinaryConfigured = false;

  async resolve(objectKey: string | null | undefined): Promise<string | null> {
    if (!objectKey) return null;
    if (/^https?:\/\//i.test(objectKey)) return objectKey;

    try {
      return objectKey.startsWith(`${CLOUDINARY_OBJECT_KEY_PREFIX}:`)
        ? await this.resolveCloudinary(objectKey)
        : await this.resolveS3(objectKey);
    } catch (error) {
      this.logger.warn(
        `Failed to resolve avatar URL for object key ${objectKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async resolveMany(
    objectKeys: Array<string | null | undefined>,
  ): Promise<Array<string | null>> {
    return Promise.all(objectKeys.map((key) => this.resolve(key)));
  }

  private async resolveS3(objectKey: string): Promise<string> {
    const bucket = this.env('AUTH_TENANT_ASSET_S3_BUCKET');
    if (!bucket) {
      throw new Error('AUTH_TENANT_ASSET_S3_BUCKET is not configured');
    }

    return getSignedUrl(
      this.s3(),
      new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
      { expiresIn: this.signedUrlTtlSeconds() },
    );
  }

  private async resolveCloudinary(objectKey: string): Promise<string> {
    this.configureCloudinary();
    const parts = objectKey.split(':');
    if (
      parts.length < 4 ||
      parts[0] !== CLOUDINARY_OBJECT_KEY_PREFIX ||
      parts[1] !== CLOUDINARY_RESOURCE_TYPE ||
      parts[2] !== CLOUDINARY_DELIVERY_TYPE
    ) {
      throw new Error('Invalid cloudinary avatar object key');
    }
    const publicId = parts.slice(3).join(':');
    const expiresAt =
      Math.floor(Date.now() / 1000) + this.signedUrlTtlSeconds();

    // Cloudinary requires a format to build the delivery URL; the object key
    // alone doesn't carry the original extension, so this is a best-effort
    // default. S3 (the default provider) does not have this limitation.
    return cloudinary.utils.private_download_url(publicId, 'jpg', {
      resource_type: CLOUDINARY_RESOURCE_TYPE,
      type: CLOUDINARY_DELIVERY_TYPE,
      expires_at: expiresAt,
      attachment: false,
    });
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

  private signedUrlTtlSeconds(): number {
    const parsed = Number(
      this.env(
        'AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS',
        String(DEFAULT_SIGNED_URL_TTL_SECONDS),
      ),
    );
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      return DEFAULT_SIGNED_URL_TTL_SECONDS;
    }
    return Math.min(parsed, MAX_SIGNED_URL_TTL_SECONDS);
  }

  private env(name: string, fallback = ''): string {
    return process.env[name]?.trim() || fallback;
  }
}
