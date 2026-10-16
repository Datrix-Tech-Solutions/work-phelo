import { EmployeeDocumentStorageService } from './employee-document-storage.service';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v2 as cloudinary } from 'cloudinary';

const send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://private.example/signed'),
}));
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn().mockResolvedValue({ result: 'ok' }),
    },
    utils: {
      private_download_url: jest
        .fn()
        .mockReturnValue('https://cloudinary.example/signed'),
    },
  },
}));

describe('HR shared private document storage', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      AUTH_TENANT_ASSET_STORAGE_PROVIDER: 's3',
      AUTH_TENANT_ASSET_S3_BUCKET: 'test-private-bucket',
      AUTH_TENANT_ASSET_S3_REGION: 'test-region',
      AUTH_TENANT_ASSET_S3_PREFIX: 'assets',
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: 'test-secret',
      AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS: '120',
    };
  });
  afterEach(() => {
    jest.restoreAllMocks();
    process.env = originalEnv;
  });
  const input = {
    tenantId: 'tenant-1',
    applicationId: 'application-1',
    documentId: 'document-1',
    body: Buffer.from('%PDF-1.7'),
    contentType: 'application/pdf',
    originalFileName: 'CV.pdf',
  };

  it('stores recruitment objects under a generated tenant/application/document path without public ACLs', async () => {
    const result =
      await new EmployeeDocumentStorageService().storeRecruitmentDocument(
        input,
      );
    expect(result.objectKey).toMatch(
      /^assets\/tenants\/tenant-1\/recruitment\/applications\/application-1\/documents\/document-1\/[\da-f-]+-CV.pdf$/,
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: 'test-private-bucket',
          Key: result.objectKey,
          Body: input.body,
        }),
      }),
    );
    expect(send.mock.calls[0][0].input).not.toHaveProperty('ACL');
  });
  it('preserves existing employee object paths', async () => {
    const storage = new EmployeeDocumentStorageService();
    const result = await storage.store({
      tenantId: input.tenantId,
      employeeId: 'employee-1',
      body: input.body,
      contentType: input.contentType,
      originalFileName: input.originalFileName,
    });
    expect(result.objectKey).toContain(
      '/employee-document/employees/employee-1/',
    );
    expect(result.objectKey).not.toContain('/recruitment/');
    expect(send.mock.calls[0][0].input.Metadata).toEqual({
      tenantId: 'tenant-1',
      employeeId: 'employee-1',
    });
    await storage.createSignedReadUrl({
      objectKey: result.objectKey,
      fileName: 'CV.pdf',
      mimeType: 'application/pdf',
    });
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: 'test-private-bucket',
          Key: result.objectKey,
          ResponseContentType: 'application/pdf',
          ResponseContentDisposition: 'inline; filename="CV.pdf"',
        }),
      }),
      { expiresIn: 120 },
    );
    await storage.delete(result.objectKey);
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        input: { Bucket: 'test-private-bucket', Key: result.objectKey },
      }),
    );
  });

  it.each([
    {
      contentType: 'application/pdf',
      fileName: 'Contract.pdf',
      resourceType: 'raw',
      format: 'pdf',
    },
    {
      contentType: 'image/png',
      fileName: 'Licence.png',
      resourceType: 'image',
      format: 'png',
    },
  ])(
    'preserves employee Cloudinary $resourceType upload, historical read and delete',
    async ({ contentType, fileName, resourceType, format }) => {
      process.env.AUTH_TENANT_ASSET_STORAGE_PROVIDER = 'cloudinary';
      process.env.AUTH_TENANT_ASSET_CLOUDINARY_ROOT_FOLDER = 'company-assets';
      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
        (options, callback) => ({
          end: () =>
            callback(null, {
              public_id: `${options.folder}/${options.public_id}`,
            }),
        }),
      );
      const storage = new EmployeeDocumentStorageService();
      const stored = await storage.store({
        tenantId: 'tenant-1',
        employeeId: 'employee-1',
        body: input.body,
        contentType,
        originalFileName: fileName,
      });
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        expect.objectContaining({
          folder:
            'company-assets/assets/tenants/tenant-1/employee-document/employees/employee-1',
          resource_type: resourceType,
          type: 'authenticated',
          overwrite: false,
        }),
        expect.any(Function),
      );
      expect(stored.objectKey).toMatch(
        new RegExp(
          `^cloudinary:${resourceType}:authenticated:company-assets/assets/tenants/tenant-1/employee-document/employees/employee-1/`,
        ),
      );
      const publicId =
        'old-root/tenants/tenant-1/employee-document/employees/employee-1/historical-id';
      const historicalKey = `cloudinary:${resourceType}:authenticated:${publicId}`;
      await storage.createSignedReadUrl({
        objectKey: historicalKey,
        fileName,
        mimeType: contentType,
      });
      expect(cloudinary.utils.private_download_url).toHaveBeenCalledWith(
        publicId,
        format,
        expect.objectContaining({
          resource_type: resourceType,
          type: 'authenticated',
        }),
      );
      await storage.delete(historicalKey);
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(publicId, {
        resource_type: resourceType,
        type: 'authenticated',
        invalidate: true,
      });
    },
  );

  it.each([
    { configured: undefined, expected: 120 },
    { configured: 'invalid', expected: 120 },
    { configured: '0', expected: 120 },
    { configured: '60', expected: 60 },
    { configured: '10000', expected: 900 },
  ])(
    'bounds employee and recruitment signed-read TTL: $configured -> $expected seconds',
    async ({ configured, expected }) => {
      const now = Date.parse('2026-10-16T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(now);
      if (configured === undefined)
        delete process.env.AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS;
      else process.env.AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS = configured;
      const storage = new EmployeeDocumentStorageService();
      const s3 = await storage.createSignedReadUrl({
        objectKey: 'historical-employee/document.pdf',
        fileName: 'CV.pdf',
      });
      const raw = await storage.createSignedReadUrl({
        objectKey: 'cloudinary:raw:authenticated:recruitment/document',
        fileName: 'CV.pdf',
      });
      const expiry = new Date(now + expected * 1000).toISOString();
      expect(s3.expiresAt).toBe(expiry);
      expect(raw.expiresAt).toBe(expiry);
      expect(getSignedUrl).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: expected },
      );
      expect(cloudinary.utils.private_download_url).toHaveBeenLastCalledWith(
        expect.any(String),
        'pdf',
        expect.objectContaining({ expires_at: now / 1000 + expected }),
      );
    },
  );
  it('uploads Cloudinary documents as authenticated raw assets and signs short-lived reads', async () => {
    process.env.AUTH_TENANT_ASSET_STORAGE_PROVIDER = 'cloudinary';
    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
      (options, callback) => ({
        end: () =>
          callback(null, {
            public_id: `${options.folder}/${options.public_id}`,
          }),
      }),
    );
    const storage = new EmployeeDocumentStorageService();
    const result = await storage.storeRecruitmentDocument(input);
    expect(result.objectKey).toMatch(
      /^cloudinary:raw:authenticated:.*tenant-1\/recruitment\/applications\/application-1\/documents\/document-1\//,
    );
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'authenticated',
        resource_type: 'raw',
        overwrite: false,
      }),
      expect.any(Function),
    );
    const signed = await storage.createSignedReadUrl({
      objectKey: result.objectKey,
      fileName: 'CV.pdf',
      mimeType: 'application/pdf',
    });
    expect(signed).toHaveProperty('expiresAt');
    expect(cloudinary.utils.private_download_url).toHaveBeenCalledWith(
      expect.any(String),
      'pdf',
      expect.objectContaining({
        type: 'authenticated',
        resource_type: 'raw',
        expires_at: expect.any(Number),
      }),
    );
    await storage.delete(result.objectKey);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ type: 'authenticated', resource_type: 'raw' }),
    );
  });
  it('reads historical untagged S3 keys even when new writes use Cloudinary', async () => {
    process.env.AUTH_TENANT_ASSET_STORAGE_PROVIDER = 'cloudinary';
    await new EmployeeDocumentStorageService().createSignedReadUrl({
      objectKey: 'historical/key.pdf',
      fileName: 'CV.pdf',
    });
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({ Key: 'historical/key.pdf' }),
      }),
      { expiresIn: 120 },
    );
  });
  it('fails closed on unknown provider or missing Cloudinary credentials', async () => {
    process.env.AUTH_TENANT_ASSET_STORAGE_PROVIDER = 'unknown';
    await expect(
      new EmployeeDocumentStorageService().storeRecruitmentDocument(input),
    ).rejects.toThrow('provider');
    process.env.AUTH_TENANT_ASSET_STORAGE_PROVIDER = 'cloudinary';
    delete process.env.CLOUDINARY_API_SECRET;
    await expect(
      new EmployeeDocumentStorageService().storeRecruitmentDocument(input),
    ).rejects.toThrow('CLOUDINARY_API_SECRET');
  });
});
