import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  RecruitmentCandidateDocumentsController,
  RecruitmentPublicDocumentsController,
} from './recruitment-documents.controller';
import { RecruitmentDocumentsService } from './recruitment-documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { httpCorsOptions } from '../config/cors';

describe('Recruitment document HTTP contracts', () => {
  let app: INestApplication;
  const applicationId = '13cfa980-7b92-4f4b-9efc-f7d6ed8ab281';
  const documentId = 'c5300ddd-5e58-486e-b664-58c1af4e1a48';
  const documents = {
    upload: jest.fn().mockResolvedValue({ id: documentId }),
    listDraft: jest.fn().mockResolvedValue({ items: [] }),
    retire: jest.fn().mockResolvedValue(undefined),
    download: jest
      .fn()
      .mockResolvedValue({ readUrl: 'https://private.example/signed' }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        RecruitmentPublicDocumentsController,
        RecruitmentCandidateDocumentsController,
      ],
      providers: [
        { provide: RecruitmentDocumentsService, useValue: documents },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: any) {
          const req = context.switchToHttp().getRequest();
          if (!req.headers['test-authenticated'])
            throw new UnauthorizedException();
          req.user = {
            id: 'user-1',
            tenantId: 'tenant-1',
            role: 'EMPLOYEE',
            moduleConfig: { hr: req.headers['test-hr'] !== 'disabled' },
            featureConfig: { hr: { recruitment: true } },
            permissions: req.headers['test-permitted']
              ? ['recruitment.candidates:VIEW']
              : [],
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.enableCors(httpCorsOptions());
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => jest.clearAllMocks());
  const uploadPath = `/recruitment/public/applications/${applicationId}/documents/upload`;
  const downloadPath = `/recruitment/candidates/${applicationId}/documents/${documentId}/download`;

  it('accepts multipart bytes and draft token without tenant Bearer authentication', async () => {
    await request(app.getHttpServer())
      .post(uploadPath)
      .set('x-application-access-token', 'draft-token')
      .field('type', 'RESUME')
      .attach('file', Buffer.from('%PDF-1.7'), {
        filename: 'CV.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    expect(documents.upload).toHaveBeenCalledWith(
      applicationId,
      'draft-token',
      'RESUME',
      expect.objectContaining({ buffer: Buffer.from('%PDF-1.7') }),
    );
  });
  it.each(['tenantId', 'applicationId', 'storageKey'])(
    'rejects applicant-controlled %s',
    async (field) => {
      await request(app.getHttpServer())
        .post(uploadPath)
        .send({ type: 'RESUME', [field]: 'untrusted' })
        .expect(400);
      expect(documents.upload).not.toHaveBeenCalled();
    },
  );
  it('rejects invalid type and oversize uploads before service/storage', async () => {
    await request(app.getHttpServer())
      .post(uploadPath)
      .send({ type: 'EXECUTABLE' })
      .expect(400);
    await request(app.getHttpServer())
      .post(uploadPath)
      .field('type', 'RESUME')
      .attach('file', Buffer.alloc(15 * 1024 * 1024 + 1), {
        filename: 'CV.pdf',
        contentType: 'application/pdf',
      })
      .expect(413);
    expect(documents.upload).not.toHaveBeenCalled();
  });
  it('requires authentication, candidate permission and enabled HR for recruiter downloads', async () => {
    await request(app.getHttpServer()).get(downloadPath).expect(401);
    await request(app.getHttpServer())
      .get(downloadPath)
      .set('test-authenticated', 'yes')
      .expect(403);
    await request(app.getHttpServer())
      .get(downloadPath)
      .set('test-authenticated', 'yes')
      .set('test-permitted', 'yes')
      .set('test-hr', 'disabled')
      .expect(403);
    expect(documents.download).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .get(downloadPath)
      .set('test-authenticated', 'yes')
      .set('test-permitted', 'yes')
      .expect(200);
    expect(documents.download).toHaveBeenCalledWith(
      'tenant-1',
      applicationId,
      documentId,
    );
  });
  it('allows the draft-token CORS header alongside Authorization on configured origins', async () => {
    const origin = httpCorsOptions().origin[0];
    const res = await request(app.getHttpServer())
      .options(uploadPath)
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set(
        'Access-Control-Request-Headers',
        'content-type,authorization,x-application-access-token',
      )
      .expect(204);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(
      res.headers['access-control-allow-headers'].toLowerCase().split(','),
    ).toEqual(['content-type', 'authorization', 'x-application-access-token']);
    expect(res.headers['access-control-allow-headers']).not.toContain('*');
  });
});
