import { createHash } from 'crypto';
import { NotFoundException } from '@nestjs/common';
import { RecruitmentService } from './recruitment.service';
import { RecruitmentDocumentsService } from './recruitment-documents.service';
import {
  validateRecruitmentDocument,
  MAX_RECRUITMENT_DOCUMENT_BYTES,
} from './recruitment-document-validation';

const token = 'test-draft-token';
const file = (overrides: Partial<Express.Multer.File> = {}) =>
  ({
    originalname: 'CV.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nresume'),
    ...overrides,
  }) as Express.Multer.File;

function fixture() {
  const app: any = {
    id: 'application-1',
    tenantId: 'tenant-1',
    vacancyId: 'vacancy-1',
    status: 'DRAFT',
    accessTokenHash: createHash('sha256').update(token).digest('hex'),
    vacancy: { status: 'OPEN', closingDate: null },
  };
  let rows: any[] = [];
  const matches = (row: any, where: any): boolean =>
    Object.entries(where).every(([key, value]) => {
      if (key === 'application')
        return (
          app.tenantId === (value as any).tenantId &&
          app.status === (value as any).status
        );
      return row[key] === value;
    });
  const safe = (row: any, select?: any) =>
    select
      ? Object.fromEntries(Object.keys(select).map((key) => [key, row[key]]))
      : { ...row };
  const prisma: any = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: app.id }]),
    recruitmentApplication: {
      findFirst: jest.fn(async ({ where }: any) =>
        matches(app, where) ? app : null,
      ),
    },
    recruitmentApplicationDocument: {
      findMany: jest.fn(async ({ where, select }: any) =>
        rows
          .filter((row) => matches(row, where))
          .map((row) => safe(row, select)),
      ),
      findFirst: jest.fn(
        async ({ where }: any) =>
          rows.find((row) => matches(row, where)) ?? null,
      ),
      updateMany: jest.fn(async ({ where, data }: any) => {
        rows
          .filter((row) => matches(row, where))
          .forEach((row) => Object.assign(row, data));
      }),
      create: jest.fn(async ({ data, select }: any) => {
        const row = { ...data, status: 'ACTIVE', createdAt: new Date() };
        rows.push(row);
        return safe(row, select);
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = rows.find((row) => row.id === where.id);
        Object.assign(row, data);
        return row;
      }),
    },
  };
  prisma.$transaction = jest.fn(async (callback: any) => {
    const snapshot = rows.map((row) => ({ ...row }));
    try {
      return await callback(prisma);
    } catch (error) {
      rows = snapshot;
      throw error;
    }
  });
  const storage = {
    storeRecruitmentDocument: jest.fn(async (input: any) => ({
      objectKey: `private/${input.documentId}`,
      mimeType: input.contentType,
      sizeBytes: input.body.length,
    })),
    delete: jest.fn().mockResolvedValue(undefined),
    createSignedReadUrl: jest.fn().mockResolvedValue({
      readUrl: 'https://private.example/signed',
      expiresAt: '2026-10-16T12:02:00Z',
    }),
  };
  const recruitment = new RecruitmentService(prisma, {} as any);
  const service = new RecruitmentDocumentsService(
    prisma,
    recruitment,
    storage as any,
  );
  return { app, prisma, storage, recruitment, service, rows: () => rows };
}

describe('Recruitment private application documents', () => {
  it('uploads checked bytes with server-owned tenant/application/key context and safe metadata', async () => {
    const f = fixture();
    const result = await f.service.upload(f.app.id, token, 'RESUME', file());
    expect(result).toMatchObject({
      type: 'RESUME',
      originalFileName: 'CV.pdf',
    });
    expect(result).not.toHaveProperty('storageKey');
    expect(f.storage.storeRecruitmentDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: f.app.tenantId,
        applicationId: f.app.id,
        documentId: expect.any(String),
        body: file().buffer,
      }),
    );
    expect(f.prisma.$queryRaw).toHaveBeenCalled();
  });

  it.each([undefined, 'invalid-token'])(
    'rejects missing/invalid draft token %s before storage',
    async (badToken) => {
      const f = fixture();
      await expect(
        f.service.upload(f.app.id, badToken, 'RESUME', file()),
      ).rejects.toThrow(NotFoundException);
      expect(f.storage.storeRecruitmentDocument).not.toHaveBeenCalled();
    },
  );

  it('rejects a token belonging to another application for upload/list/delete', async () => {
    const f = fixture();
    await expect(
      f.service.upload('another-application', token, 'RESUME', file()),
    ).rejects.toThrow(NotFoundException);
    await expect(
      f.service.listDraft('another-application', token),
    ).rejects.toThrow(NotFoundException);
    await expect(
      f.service.retire('another-application', 'document', token),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects submitted applications and closed or missing vacancies', async () => {
    const f = fixture();
    f.app.status = 'SUBMITTED';
    await expect(
      f.service.upload(f.app.id, token, 'RESUME', file()),
    ).rejects.toThrow(NotFoundException);
    await expect(f.service.retire(f.app.id, 'document', token)).rejects.toThrow(
      NotFoundException,
    );
    f.app.status = 'DRAFT';
    f.app.vacancy.status = 'CLOSED';
    await expect(
      f.service.upload(f.app.id, token, 'RESUME', file()),
    ).rejects.toThrow('no longer open');
    f.prisma.recruitmentApplication.findFirst.mockResolvedValue(null);
    await expect(f.service.listDraft(f.app.id, token)).rejects.toThrow(
      NotFoundException,
    );
  });

  it.each(['RESUME', 'COVER_LETTER'] as const)(
    'replaces %s only after storage succeeds, retaining retired metadata',
    async (type) => {
      const f = fixture();
      const first = await f.service.upload(f.app.id, token, type, file());
      const second = await f.service.upload(f.app.id, token, type, file());
      expect(first.id).not.toBe(second.id);
      expect(f.rows().map((row) => row.status)).toEqual(['RETIRED', 'ACTIVE']);
      expect(f.storage.delete).toHaveBeenCalledWith(`private/${first.id}`);
      const list = await f.service.listDraft(f.app.id, token);
      expect(list.items.map((row: any) => row.id)).toEqual([second.id]);
      expect(JSON.stringify(list)).not.toContain('storageKey');
    },
  );

  it('keeps the current document on storage failure and on database failure', async () => {
    const f = fixture();
    const first = await f.service.upload(f.app.id, token, 'RESUME', file());
    f.storage.storeRecruitmentDocument.mockRejectedValueOnce(
      new Error('storage unavailable'),
    );
    await expect(
      f.service.upload(f.app.id, token, 'RESUME', file()),
    ).rejects.toThrow('storage unavailable');
    f.prisma.recruitmentApplicationDocument.create.mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    await expect(
      f.service.upload(f.app.id, token, 'RESUME', file()),
    ).rejects.toThrow('database unavailable');
    expect(f.rows()).toHaveLength(1);
    expect(f.rows()[0]).toMatchObject({ id: first.id, status: 'ACTIVE' });
    expect(f.storage.delete).toHaveBeenCalledWith(
      expect.not.stringContaining(first.id),
    );
  });

  it('rechecks draft ownership after storage so concurrent submission cannot attach a file', async () => {
    const f = fixture();
    f.storage.storeRecruitmentDocument.mockImplementationOnce(async () => {
      f.app.status = 'SUBMITTED';
      f.app.accessTokenHash = null;
      return {
        objectKey: 'unattached-object',
        mimeType: 'application/pdf',
        sizeBytes: 10,
      };
    });
    await expect(
      f.service.upload(f.app.id, token, 'RESUME', file()),
    ).rejects.toThrow(NotFoundException);
    expect(f.rows()).toEqual([]);
    expect(f.storage.delete).toHaveBeenCalledWith('unattached-object');
  });

  it('allows OTHER documents without replacing the resume', async () => {
    const f = fixture();
    await f.service.upload(f.app.id, token, 'RESUME', file());
    await f.service.upload(f.app.id, token, 'OTHER', file());
    expect((await f.service.listDraft(f.app.id, token)).items).toHaveLength(2);
  });

  it('cannot delete another document; own deletion retires metadata and tolerates storage cleanup failure', async () => {
    const f = fixture();
    const document = await f.service.upload(f.app.id, token, 'RESUME', file());
    await expect(
      f.service.retire(f.app.id, 'another-document', token),
    ).rejects.toThrow(NotFoundException);
    f.storage.delete.mockRejectedValueOnce(
      new Error('temporary storage outage'),
    );
    await f.service.retire(f.app.id, document.id, token);
    expect(f.rows()[0].status).toBe('RETIRED');
    expect((await f.service.listDraft(f.app.id, token)).items).toEqual([]);
  });

  it('signs only active submitted candidate documents in the authenticated tenant', async () => {
    const f = fixture();
    const document = await f.service.upload(f.app.id, token, 'RESUME', file());
    await expect(
      f.service.download(f.app.tenantId, f.app.id, document.id),
    ).rejects.toThrow(NotFoundException);
    f.app.status = 'SUBMITTED';
    await expect(
      f.service.download('other-tenant', f.app.id, document.id),
    ).rejects.toThrow(NotFoundException);
    await expect(
      f.service.download(f.app.tenantId, 'other-application', document.id),
    ).rejects.toThrow(NotFoundException);
    await expect(
      f.service.download(f.app.tenantId, f.app.id, document.id),
    ).resolves.toHaveProperty('readUrl');
    expect(f.storage.createSignedReadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey: `private/${document.id}`,
        fileName: 'CV.pdf',
      }),
    );
  });
});

describe('Recruitment document content validation', () => {
  it('sanitizes traversal, controls and unsafe filename characters', () => {
    expect(
      validateRecruitmentDocument(
        file({ originalname: '../../folder\\my<script> CV.pdf' }),
      ).originalFileName,
    ).toBe('my_script_CV.pdf');
  });
  it.each([
    { originalname: 'bad.exe', mimetype: 'application/octet-stream' },
    { originalname: 'bad.pdf', mimetype: 'text/plain' },
    { buffer: Buffer.from('executable') },
    {
      originalname: 'bad.docx',
      mimetype:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('P'),
    },
  ])('rejects unsupported or spoofed files %#', (input) => {
    expect(() => validateRecruitmentDocument(file(input))).toThrow();
  });
  it('rejects missing, empty and oversized files', () => {
    expect(() => validateRecruitmentDocument()).toThrow('required');
    expect(() =>
      validateRecruitmentDocument(file({ buffer: Buffer.alloc(0) })),
    ).toThrow('required');
    expect(() =>
      validateRecruitmentDocument(
        file({ buffer: Buffer.alloc(MAX_RECRUITMENT_DOCUMENT_BYTES + 1) }),
      ),
    ).toThrow('15 MiB');
  });
  it('accepts a Word compound document signature and rejects other compound formats', () => {
    const header = Buffer.from('d0cf11e0a1b11ae1', 'hex');
    const doc = file({
      originalname: 'CV.doc',
      mimetype: 'application/msword',
      buffer: Buffer.concat([header, Buffer.from('WordDocument', 'utf16le')]),
    });
    expect(validateRecruitmentDocument(doc).mimeType).toBe(
      'application/msword',
    );
    expect(() =>
      validateRecruitmentDocument({ ...doc, buffer: header }),
    ).toThrow('contents');
  });
  it('accepts a DOCX directory and rejects generic ZIPs or macro-enabled Word files', () => {
    const zip = (names: string[]) => {
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50);
      const directory = Buffer.concat(
        names.map((name) => {
          const entry = Buffer.alloc(46);
          entry.writeUInt32LE(0x02014b50);
          entry.writeUInt16LE(Buffer.byteLength(name), 28);
          return Buffer.concat([entry, Buffer.from(name)]);
        }),
      );
      const end = Buffer.alloc(22);
      end.writeUInt32LE(0x06054b50);
      end.writeUInt16LE(names.length, 10);
      end.writeUInt32LE(local.length, 16);
      return Buffer.concat([local, directory, end]);
    };
    const docx = (names: string[]) =>
      file({
        originalname: 'CV.docx',
        mimetype:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: zip(names),
      });
    expect(
      validateRecruitmentDocument(
        docx(['[Content_Types].xml', 'word/document.xml']),
      ).originalFileName,
    ).toBe('CV.docx');
    expect(() => validateRecruitmentDocument(docx(['ordinary.txt']))).toThrow(
      'contents',
    );
    expect(() =>
      validateRecruitmentDocument(
        docx([
          '[Content_Types].xml',
          'word/document.xml',
          'word/vbaProject.bin',
        ]),
      ),
    ).toThrow('contents');
  });
});
