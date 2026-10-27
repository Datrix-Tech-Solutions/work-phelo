import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RequestUser } from '@work-phelo/types';
import request from 'supertest';
import { Server } from 'http';
import {
  Prisma,
  RecruitmentApplicationStatus,
} from '../../prisma/generated/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RecruitmentController } from './recruitment.controller';
import { RecruitmentService } from './recruitment.service';
import { RecruitmentCandidateDocumentsController } from './recruitment-documents.controller';
import { RecruitmentDocumentsService } from './recruitment-documents.service';

const candidateId = '13cfa980-7b92-4f4b-9efc-f7d6ed8ab281';
const documentId = 'c5300ddd-5e58-486e-b664-58c1af4e1a48';
const user: RequestUser = {
  id: 'reader',
  email: 'reader@example.test',
  firstName: 'Reader',
  role: 'EMPLOYEE',
  tenantId: 'tenant-a',
  tenantSlug: 'tenant-a',
  tenantName: 'Tenant A',
  moduleConfig: { hr: true },
  featureConfig: {},
  permissions: [],
};

function candidate(tenantId: string, id = candidateId) {
  return {
    id,
    tenantId,
    vacancyId: 'vacancy-a',
    currentStageId: 'stage-a',
    status: RecruitmentApplicationStatus.SUBMITTED,
    firstName: 'Ama',
    lastName: 'Mensah',
    email: 'ama@private.test',
    phone: '+233201234567',
    country: 'Ghana',
    city: 'Accra',
    professionalSummary: 'Private profile',
    skills: ['Payroll'],
    languages: [],
    certificates: [],
    yearsOfExperience: 4,
    highestEducationLevel: 'BACHELORS',
    education: 'Private school',
    educationHistory: [],
    workHistory: [],
    currentEmployer: 'Private employer',
    currentJobTitle: 'Officer',
    expectedSalary: new Prisma.Decimal(5000),
    expectedSalaryCurrency: 'GHS',
    noticePeriod: 'One month',
    accessTokenHash: 'private-hash',
    resumeUrl: 'https://private.test/legacy.pdf',
    resumeFileName: 'Private CV.pdf',
    coverLetterUrl: null,
    coverLetterFileName: null,
    portfolioUrl: 'https://private.test/portfolio',
    githubUrl: null,
    metadata: { privateNote: 'Do not disclose' },
    managedDocuments: [
      {
        id: documentId,
        storageKey: 'private/key',
        readUrl: 'https://private.test/signed',
      },
    ],
    appliedAt: new Date('2026-10-01T00:00:00Z'),
    submittedAt: new Date('2026-10-01T00:00:00Z'),
    currentStage: {
      id: 'stage-a',
      name: 'Applied',
      sortOrder: 1,
      isDefault: true,
      description: 'Internal instructions',
      tenantId,
    },
    vacancy: {
      id: 'vacancy-a',
      title: 'HR Officer',
      details: { skills: { items: ['Payroll'] } },
      salaryMin: null,
      salaryMax: null,
      privateExtra: 'not list metadata',
      _count: { questions: 1 },
    },
    answers: [
      {
        id: 'answer-a',
        questionId: 'question-a',
        questionSnapshot: 'Private question',
        answer: 'Private answer',
        answerText: 'Private text',
        selectedOptions: ['Private choice'],
        screeningDecision: 'ACCEPTED',
        question: { question: 'Private question', retiredAt: null },
      },
    ],
    _count: { stageHistory: 1 },
  };
}

describe('Recruitment candidate response privacy', () => {
  let app: INestApplication;
  let server: Server;
  let service: RecruitmentService;
  const rows = [
    candidate('tenant-a'),
    candidate('tenant-b', 'foreign-candidate'),
  ];
  const prisma = {
    recruitmentApplication: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      update: jest.fn(),
    },
    recruitmentApplicationAnswer: { findFirst: jest.fn(), update: jest.fn() },
    recruitmentStage: { findFirst: jest.fn() },
    recruitmentStageHistory: { create: jest.fn() },
    employee: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const documents = { download: jest.fn() };

  beforeAll(async () => {
    service = new RecruitmentService(prisma as unknown as PrismaService);
    const module = await Test.createTestingModule({
      controllers: [
        RecruitmentController,
        RecruitmentCandidateDocumentsController,
      ],
      providers: [
        { provide: RecruitmentService, useValue: service },
        { provide: RecruitmentDocumentsService, useValue: documents },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<{
            headers: Record<string, string | undefined>;
            user: RequestUser;
          }>();
          req.user = {
            ...user,
            permissions: (req.headers['test-permissions'] ?? '').split(','),
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => app?.close());
  beforeEach(() => {
    jest.clearAllMocks();
    const matchingRows = (where: Prisma.RecruitmentApplicationWhereInput) =>
      rows.filter(
        (row) =>
          row.tenantId === where.tenantId &&
          row.status === where.status &&
          (!where.id || row.id === where.id) &&
          (!where.vacancyId || row.vacancyId === where.vacancyId),
      );
    // Return deliberately over-rich rows: the serializer must still allowlist every nested field.
    prisma.recruitmentApplication.findMany.mockImplementation(
      async ({ where }: { where: Prisma.RecruitmentApplicationWhereInput }) =>
        matchingRows(where),
    );
    prisma.recruitmentApplication.count.mockImplementation(
      async ({ where }: { where: Prisma.RecruitmentApplicationWhereInput }) =>
        matchingRows(where).length,
    );
    prisma.recruitmentApplication.findFirst.mockImplementation(
      async ({ where }: { where: Prisma.RecruitmentApplicationWhereInput }) =>
        matchingRows(where)[0] ?? null,
    );
    prisma.recruitmentApplication.findFirstOrThrow.mockResolvedValue(rows[0]);
    prisma.recruitmentStage.findFirst.mockResolvedValue({
      id: 'stage-b',
      isDefault: false,
    });
    prisma.recruitmentApplicationAnswer.findFirst.mockResolvedValue({
      id: 'answer-a',
    });
    prisma.$transaction.mockImplementation(
      (
        input: Promise<unknown>[] | ((tx: typeof prisma) => Promise<unknown>),
      ) => (Array.isArray(input) ? Promise.all(input) : input(prisma)),
    );
  });

  const summaryKeys = [
    'id',
    'vacancyId',
    'firstName',
    'lastName',
    'status',
    'currentStageId',
    'currentStage',
    'vacancy',
    'appliedAt',
    'submittedAt',
    'matchScore',
  ];
  function assertSummary(summary: Record<string, unknown>) {
    expect(Object.keys(summary).sort()).toEqual([...summaryKeys].sort());
    expect(summary.vacancy).toEqual({ id: 'vacancy-a', title: 'HR Officer' });
    expect(summary.currentStage).toEqual({
      id: 'stage-a',
      name: 'Applied',
      sortOrder: 1,
      isDefault: true,
    });
    for (const key of [
      'email',
      'phone',
      'city',
      'country',
      'professionalSummary',
      'skills',
      'languages',
      'certificates',
      'education',
      'educationHistory',
      'workHistory',
      'yearsOfExperience',
      'currentEmployer',
      'currentJobTitle',
      'highestEducationLevel',
      'answers',
      'resumeUrl',
      'resumeFileName',
      'coverLetterUrl',
      'portfolioUrl',
      'githubUrl',
      'documents',
      'managedDocuments',
      'storageKey',
      'readUrl',
      'accessTokenHash',
      'metadata',
      'expectedSalary',
      'noticePeriod',
      'stageHistory',
      'interviews',
      '_count',
    ]) {
      expect(summary).not.toHaveProperty(key);
    }
    expect(summary.matchScore).toBe(100);
  }

  it.each(['recruitment.vacancies:VIEW', 'recruitment.candidates:VIEW'])(
    '%s receives only summaries, even for candidate readers',
    async (permission) => {
      const res = await request(server)
        .get('/recruitment/candidates')
        .set('test-permissions', permission)
        .expect(200);
      const body = res.body as {
        items: Record<string, unknown>[];
        meta: { total: number };
      };
      expect(body.items).toHaveLength(1);
      expect(body.meta.total).toBe(1);
      assertSummary(body.items[0]);
      const [[query]] = prisma.recruitmentApplication.findMany.mock.calls as [
        [
          {
            select: Record<string, unknown>;
            where: Prisma.RecruitmentApplicationWhereInput;
          },
        ],
      ];
      expect(query.where.tenantId).toBe('tenant-a');
      expect(query.where.status).toBe('SUBMITTED');
      expect(query).not.toHaveProperty('include');
      expect(query.select).not.toHaveProperty('email');
      expect(query.select).not.toHaveProperty('managedDocuments');
      expect(query.select.answers).toEqual({
        select: {
          screeningDecision: true,
          question: { select: { retiredAt: true } },
        },
      });
    },
  );

  it('uses the same safe contract for the vacancy pipeline and screening filters', async () => {
    const res = await request(server)
      .get('/recruitment/candidates?vacancyId=vacancy-a&stageId=stage-a')
      .set('test-permissions', 'recruitment.vacancies:VIEW')
      .expect(200);
    assertSummary((res.body as { items: Record<string, unknown>[] }).items[0]);
    const [[query]] = prisma.recruitmentApplication.findMany.mock.calls as [
      [
        {
          where: Prisma.RecruitmentApplicationWhereInput;
        },
      ],
    ];
    expect(query.where).toMatchObject({
      tenantId: 'tenant-a',
      vacancyId: 'vacancy-a',
      currentStageId: 'stage-a',
    });
  });

  it('never returns another tenant candidate or its totals', async () => {
    const res = await request(server)
      .get('/recruitment/candidates?vacancyId=foreign-vacancy')
      .set('test-permissions', 'recruitment.vacancies:VIEW')
      .expect(200);
    expect(
      (res.body as { items: unknown[]; meta: { total: number } }).items,
    ).toEqual([]);
    expect((res.body as { meta: { total: number } }).meta.total).toBe(0);
  });

  it.each([
    '',
    '/documents',
    '/stage-history',
    '/interviews',
    `/documents/${documentId}/download`,
  ])(
    'vacancy-only VIEW cannot read candidate detail route %s',
    async (suffix) => {
      await request(server)
        .get(`/recruitment/candidates/${candidateId}${suffix}`)
        .set('test-permissions', 'recruitment.vacancies:VIEW')
        .expect(403);
      expect(prisma.recruitmentApplication.findFirst).not.toHaveBeenCalled();
      expect(documents.download).not.toHaveBeenCalled();
    },
  );

  it('retains private contact, answers and legacy documents behind candidate VIEW', async () => {
    const res = await request(server)
      .get(`/recruitment/candidates/${candidateId}`)
      .set('test-permissions', 'recruitment.candidates:VIEW')
      .expect(200);
    const detail = res.body as Record<string, unknown>;
    expect(detail.phone).toBe(rows[0].phone);
    expect(detail.email).toBe(rows[0].email);
    expect(detail.answers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ answer: 'Private answer' }),
      ]),
    );
    expect(detail).toHaveProperty('documents.resume.url', rows[0].resumeUrl);
    expect(detail).not.toHaveProperty('accessTokenHash');
  });

  it('returns the existing non-disclosing 404 for cross-tenant detail', async () => {
    await request(server)
      .get('/recruitment/candidates/foreign-candidate')
      .set('test-permissions', 'recruitment.candidates:VIEW')
      .expect(404);
  });

  it.each(['stage', 'screening decision'])(
    'EDIT-only %s mutation does not return private detail',
    async (operation) => {
      const res =
        operation === 'stage'
          ? await request(server)
              .patch(`/recruitment/candidates/${candidateId}/stage`)
              .set('test-permissions', 'recruitment.candidates:EDIT')
              .send({ stageId: 'stage-b' })
              .expect(200)
          : await request(server)
              .patch(
                `/recruitment/candidates/${candidateId}/answers/question-a/decision`,
              )
              .set('test-permissions', 'recruitment.candidates:EDIT')
              .send({ decision: 'ACCEPTED' })
              .expect(200);
      assertSummary(res.body as Record<string, unknown>);
    },
  );
});
