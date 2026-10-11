/// <reference types="jest" />

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import {
  EmploymentType,
  RecruitmentVacancyStatus,
} from '../../prisma/generated/client';
import { RecruitmentService } from './recruitment.service';

const user = {
  id: 'user-1',
  tenantId: 'tenant-1',
  role: 'EMPLOYEE',
  permissions: [],
} as any;

function createPrismaMock() {
  const prisma: any = {
    recruitmentVacancy: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    recruitmentStage: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    recruitmentApplication: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    recruitmentStageHistory: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    employee: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((input: any) => {
      if (Array.isArray(input)) return Promise.all(input);
      return input(prisma);
    }),
  };
  return prisma;
}

function vacancy(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vacancy-1',
    tenantId: 'tenant-1',
    title: 'HR Officer',
    location: 'Accra',
    jobType: EmploymentType.FULL_TIME,
    description: 'Support HR operations for the business.',
    responsibilities: null,
    requirements: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    status: RecruitmentVacancyStatus.OPEN,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    closedAt: null,
    closedByUserId: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    _count: { applications: 2 },
    ...overrides,
  };
}

function stage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'stage-1',
    tenantId: 'tenant-1',
    name: 'Applied',
    normalizedName: 'applied',
    sortOrder: 1,
    isDefault: true,
    description: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    ...overrides,
  };
}

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'candidate-1',
    tenantId: 'tenant-1',
    vacancyId: 'vacancy-1',
    currentStageId: 'stage-1',
    firstName: 'Ama',
    lastName: 'Mensah',
    email: 'ama@example.com',
    phone: null,
    professionalSummary: null,
    skills: ['Payroll'],
    education: null,
    expectedSalary: null,
    expectedSalaryCurrency: null,
    noticePeriod: null,
    resumeUrl: null,
    resumeFileName: null,
    coverLetterUrl: null,
    coverLetterFileName: null,
    portfolioUrl: null,
    githubUrl: null,
    metadata: null,
    appliedAt: new Date('2026-10-01T00:00:00Z'),
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    vacancy: vacancy({ _count: { applications: 1 } }),
    currentStage: stage(),
    _count: { stageHistory: 1 },
    ...overrides,
  };
}

describe('RecruitmentService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: RecruitmentService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new RecruitmentService(prisma);
  });

  describe('vacancies', () => {
    it('lists only tenant vacancies and includes applicant counts', async () => {
      prisma.recruitmentVacancy.findMany.mockResolvedValue([vacancy()]);
      prisma.recruitmentVacancy.count.mockResolvedValue(1);

      const result = await service.listVacancies('tenant-1', {});

      expect(prisma.recruitmentVacancy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
          include: { _count: { select: { applications: true } } },
        }),
      );
      expect(result.items[0].applicantCount).toBe(2);
    });

    it('does not disclose another tenant vacancy', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue(null);

      await expect(service.getVacancy('tenant-1', 'other')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates a draft vacancy with partial data', async () => {
      prisma.recruitmentVacancy.create.mockResolvedValue(
        vacancy({
          status: RecruitmentVacancyStatus.DRAFT,
          title: 'Draft role',
          location: null,
          jobType: null,
          description: null,
        }),
      );

      const result = await service.createVacancy('tenant-1', user, {
        title: 'Draft role',
      });

      expect(prisma.recruitmentVacancy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            status: RecruitmentVacancyStatus.DRAFT,
          }),
        }),
      );
      expect(result.status).toBe(RecruitmentVacancyStatus.DRAFT);
    });

    it('requires mandatory fields before opening a vacancy', async () => {
      await expect(
        service.createVacancy('tenant-1', user, {
          status: RecruitmentVacancyStatus.OPEN,
          title: 'Incomplete role',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates a vacancy without deleting applications', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue(vacancy());
      prisma.recruitmentVacancy.update.mockResolvedValue(
        vacancy({ title: 'Senior HR Officer' }),
      );

      await service.updateVacancy('tenant-1', user, 'vacancy-1', {
        title: 'Senior HR Officer',
      });

      expect(prisma.recruitmentVacancy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'vacancy-1' },
          data: expect.objectContaining({ title: 'Senior HR Officer' }),
        }),
      );
      expect(prisma.recruitmentApplication.count).not.toHaveBeenCalled();
    });

    it('opens a complete draft vacancy through item PATCH', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue(
        vacancy({
          status: RecruitmentVacancyStatus.DRAFT,
          title: 'HR Officer',
          location: 'Accra',
          jobType: EmploymentType.FULL_TIME,
          description: 'Support HR operations.',
        }),
      );
      prisma.recruitmentVacancy.update.mockResolvedValue(
        vacancy({ status: RecruitmentVacancyStatus.OPEN }),
      );

      await service.updateVacancy('tenant-1', user, 'vacancy-1', {
        status: RecruitmentVacancyStatus.OPEN,
      });

      expect(prisma.recruitmentVacancy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'vacancy-1' },
          data: expect.objectContaining({
            status: RecruitmentVacancyStatus.OPEN,
          }),
        }),
      );
    });

    it('does not open an incomplete draft vacancy', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue(
        vacancy({
          status: RecruitmentVacancyStatus.DRAFT,
          title: 'HR Officer',
          location: null,
          jobType: EmploymentType.FULL_TIME,
          description: 'Support HR operations.',
        }),
      );

      await expect(
        service.updateVacancy('tenant-1', user, 'vacancy-1', {
          status: RecruitmentVacancyStatus.OPEN,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.recruitmentVacancy.update).not.toHaveBeenCalled();
    });

    it('closes a vacancy without deleting applications', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue(vacancy());
      prisma.recruitmentVacancy.update.mockResolvedValue(
        vacancy({ status: RecruitmentVacancyStatus.CLOSED }),
      );

      const result = await service.closeVacancy('tenant-1', user, 'vacancy-1');

      expect(prisma.recruitmentVacancy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RecruitmentVacancyStatus.CLOSED,
            closedByUserId: user.id,
          }),
        }),
      );
      expect(result.status).toBe(RecruitmentVacancyStatus.CLOSED);
    });
  });

  describe('stages', () => {
    it('enforces tenant-scoped stage name uniqueness', async () => {
      prisma.recruitmentStage.findMany.mockResolvedValue([stage()]);
      prisma.recruitmentStage.findUnique.mockResolvedValue(stage());

      await expect(
        service.createStage('tenant-1', { name: '  Applied  ' }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.recruitmentStage.findUnique).toHaveBeenCalledWith({
        where: {
          tenantId_normalizedName: {
            tenantId: 'tenant-1',
            normalizedName: 'applied',
          },
        },
        select: { id: true },
      });
    });

    it('updates ordering and default stage within the tenant', async () => {
      prisma.recruitmentStage.findFirst.mockResolvedValue(
        stage({ id: 'stage-2', isDefault: false }),
      );
      prisma.recruitmentStage.findUnique.mockResolvedValue(null);
      prisma.recruitmentStage.update.mockResolvedValue(
        stage({ id: 'stage-2', name: 'Interview', sortOrder: 10 }),
      );

      await service.updateStage('tenant-1', 'stage-2', {
        name: 'Interview',
        sortOrder: 10,
        isDefault: true,
      });

      expect(prisma.recruitmentStage.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          isDefault: true,
          id: { not: 'stage-2' },
        },
        data: { isDefault: false },
      });
      expect(prisma.recruitmentStage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sortOrder: 10, isDefault: true }),
        }),
      );
    });

    it('creates a new default stage by clearing the previous tenant default first', async () => {
      prisma.recruitmentStage.findMany.mockResolvedValue([stage()]);
      prisma.recruitmentStage.findUnique.mockResolvedValue(null);
      prisma.recruitmentStage.aggregate.mockResolvedValue({
        _max: { sortOrder: 6 },
      });
      prisma.recruitmentStage.create.mockResolvedValue(
        stage({ id: 'stage-7', name: 'Assessment', isDefault: true }),
      );

      await service.createStage('tenant-1', {
        name: 'Assessment',
        isDefault: true,
      });

      expect(prisma.recruitmentStage.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', isDefault: true },
        data: { isDefault: false },
      });
      expect(prisma.recruitmentStage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Assessment',
            normalizedName: 'assessment',
            sortOrder: 7,
            isDefault: true,
          }),
        }),
      );
    });

    it('does not clear the only default stage directly', async () => {
      prisma.recruitmentStage.findFirst.mockResolvedValue(stage());

      await expect(
        service.updateStage('tenant-1', 'stage-1', { isDefault: false }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.recruitmentStage.update).not.toHaveBeenCalled();
    });

    it('does not delete a stage currently in use', async () => {
      prisma.recruitmentStage.findFirst.mockResolvedValue(stage());
      prisma.recruitmentApplication.count.mockResolvedValue(1);
      prisma.recruitmentStageHistory.count.mockResolvedValue(0);

      await expect(service.deleteStage('tenant-1', 'stage-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('promotes a replacement after deleting the current default stage', async () => {
      prisma.recruitmentStage.findFirst
        .mockResolvedValueOnce(stage({ id: 'stage-1', isDefault: true }))
        .mockResolvedValueOnce(stage({ id: 'stage-2', isDefault: false }));
      prisma.recruitmentApplication.count.mockResolvedValue(0);
      prisma.recruitmentStageHistory.count.mockResolvedValue(0);
      prisma.recruitmentStage.delete.mockResolvedValue(
        stage({ id: 'stage-1' }),
      );
      prisma.recruitmentStage.update.mockResolvedValue(
        stage({ id: 'stage-2', isDefault: true }),
      );

      await service.deleteStage('tenant-1', 'stage-1');

      expect(prisma.recruitmentStage.delete).toHaveBeenCalledWith({
        where: { id: 'stage-1' },
      });
      expect(prisma.recruitmentStage.update).toHaveBeenCalledWith({
        where: { id: 'stage-2' },
        data: { isDefault: true },
      });
      expect(
        prisma.recruitmentStage.delete.mock.invocationCallOrder[0],
      ).toBeLessThan(
        prisma.recruitmentStage.update.mock.invocationCallOrder[0],
      );
    });

    it('does not disclose another tenant stage', async () => {
      prisma.recruitmentStage.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStage('tenant-1', 'stage-other', { name: 'Screening' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('candidates', () => {
    it('lists candidates with tenant-scoped filters and search', async () => {
      prisma.recruitmentApplication.findMany.mockResolvedValue([candidate()]);
      prisma.recruitmentApplication.count.mockResolvedValue(1);

      await service.listCandidates('tenant-1', {
        search: 'Ama',
        vacancyId: 'vacancy-1',
        stageId: 'stage-1',
      });

      expect(prisma.recruitmentApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            vacancyId: 'vacancy-1',
            currentStageId: 'stage-1',
          }),
        }),
      );
    });

    it('does not disclose another tenant candidate', async () => {
      prisma.recruitmentApplication.findFirst.mockResolvedValue(null);

      await expect(service.getCandidate('tenant-1', 'other')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects cross-tenant target stages', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
      prisma.recruitmentApplication.findFirst.mockResolvedValue(
        candidate({ currentStageId: 'stage-1' }),
      );
      prisma.recruitmentStage.findFirst.mockResolvedValue(null);

      await expect(
        service.moveCandidateStage('tenant-1', user, 'candidate-1', 'stage-x'),
      ).rejects.toThrow(NotFoundException);
    });

    it('moves a candidate stage and writes stage history atomically', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
      prisma.recruitmentApplication.findFirst.mockResolvedValue(
        candidate({ id: 'candidate-1', currentStageId: 'stage-1' }),
      );
      prisma.recruitmentStage.findFirst.mockResolvedValue(
        stage({ id: 'stage-2' }),
      );
      prisma.recruitmentApplication.update.mockResolvedValue({});
      prisma.recruitmentStageHistory.create.mockResolvedValue({});
      prisma.recruitmentApplication.findFirstOrThrow.mockResolvedValue(
        candidate({ currentStageId: 'stage-2' }),
      );

      await service.moveCandidateStage(
        'tenant-1',
        user,
        'candidate-1',
        'stage-2',
        'Strong interview',
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.recruitmentStageHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          applicationId: 'candidate-1',
          previousStageId: 'stage-1',
          newStageId: 'stage-2',
          changedByUserId: user.id,
          changedByEmployeeId: 'employee-1',
          note: 'Strong interview',
        }),
      });
    });

    it('returns stage history only after confirming tenant-scoped candidate access', async () => {
      prisma.recruitmentApplication.findFirst.mockResolvedValue(candidate());
      prisma.recruitmentStageHistory.findMany.mockResolvedValue([]);

      await service.getCandidateStageHistory('tenant-1', 'candidate-1');

      expect(prisma.recruitmentApplication.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', id: 'candidate-1' },
        }),
      );
      expect(prisma.recruitmentStageHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', applicationId: 'candidate-1' },
        }),
      );
    });

    it('creates applications with an initial default stage and history record', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue({
        id: 'vacancy-1',
      });
      prisma.recruitmentStage.findMany.mockResolvedValue([stage()]);
      prisma.recruitmentStage.findFirst.mockResolvedValue(stage());
      prisma.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
      prisma.recruitmentApplication.create.mockResolvedValue(
        candidate({ id: 'candidate-1' }),
      );
      prisma.recruitmentStageHistory.create.mockResolvedValue({});
      prisma.recruitmentApplication.findFirstOrThrow.mockResolvedValue(
        candidate({ id: 'candidate-1' }),
      );

      await service.createApplication('tenant-1', user, {
        vacancyId: 'vacancy-1',
        firstName: 'Ama',
        lastName: 'Mensah',
        email: 'AMA@EXAMPLE.COM',
      });

      expect(prisma.recruitmentApplication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          vacancyId: 'vacancy-1',
          currentStageId: 'stage-1',
          email: 'ama@example.com',
        }),
      });
      expect(prisma.recruitmentStageHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          previousStageId: null,
          newStageId: 'stage-1',
          changedByUserId: user.id,
        }),
      });
    });

    it('keeps stage transition consistent when history creation fails', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
      prisma.recruitmentApplication.findFirst.mockResolvedValue(
        candidate({ currentStageId: 'stage-1' }),
      );
      prisma.recruitmentStage.findFirst.mockResolvedValue(
        stage({ id: 'stage-2' }),
      );
      prisma.$transaction.mockRejectedValue(new Error('rollback'));

      await expect(
        service.moveCandidateStage('tenant-1', user, 'candidate-1', 'stage-2'),
      ).rejects.toThrow('rollback');
    });
  });
});
