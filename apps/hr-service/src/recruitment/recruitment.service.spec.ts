/// <reference types="jest" />

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import {
  EmploymentType,
  WorkMode,
  RecruitmentApplicationStatus,
  RecruitmentInterviewMode,
  RecruitmentInterviewStatus,
  RecruitmentQuestionType,
  RecruitmentSalaryType,
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
    $queryRaw: jest.fn(),
    recruitmentEmployer: {
      findMany: jest.fn(),
    },
    recruitmentVacancy: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
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
    recruitmentVacancyQuestion: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    recruitmentApplication: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    recruitmentApplicationAnswer: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    recruitmentStageHistory: {
      count: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    recruitmentInterview: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    employee: {
      findFirst: jest.fn(),
    },
    department: {
      findFirst: jest.fn(),
    },
    branch: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((input: any) => {
      if (Array.isArray(input)) return Promise.all(input);
      return input(prisma);
    }),
  };
  prisma.recruitmentEmployer.findMany.mockResolvedValue([]);
  return prisma;
}

function vacancy(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vacancy-1',
    tenantId: 'tenant-1',
    title: 'HR Officer',
    departmentId: null,
    branchId: null,
    department: null,
    branch: null,
    location: 'Accra',
    city: null,
    jobType: EmploymentType.FULL_TIME,
    workMode: null,
    vacancies: 1,
    closingDate: null,
    description: 'Support HR operations for the business.',
    responsibilities: null,
    perksAndBenefits: null,
    requirements: null,
    details: null,
    salaryType: RecruitmentSalaryType.NON_DISCLOSED,
    salaryAmount: null,
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
    questions: [],
    _count: { applications: 2 },
    ...overrides,
  };
}

function question(overrides: Record<string, unknown> = {}) {
  return {
    id: 'question-1',
    tenantId: 'tenant-1',
    vacancyId: 'vacancy-1',
    question: 'Why are you interested in this role?',
    type: RecruitmentQuestionType.SHORT_ANSWER,
    options: null,
    required: true,
    sortOrder: 1,
    retiredAt: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
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

function interview(overrides: Record<string, unknown> = {}) {
  return {
    id: 'interview-1',
    tenantId: 'tenant-1',
    applicationId: 'candidate-1',
    mode: RecruitmentInterviewMode.VIDEO,
    status: RecruitmentInterviewStatus.SCHEDULED,
    scheduledAt: new Date('2099-01-01T10:00:00Z'),
    durationMinutes: 45,
    platform: 'Google Meet',
    meetingLink: 'https://meet.google.com/abc',
    phone: null,
    location: null,
    notes: null,
    feedback: null,
    createdByUserId: 'user-1',
    createdByEmployeeId: 'employee-1',
    createdByEmployee: {
      id: 'employee-1',
      firstName: 'Efua',
      lastName: 'Sarpong',
    },
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
    status: RecruitmentApplicationStatus.SUBMITTED,
    accessTokenHash: null,
    submittedAt: new Date('2026-10-01T00:00:00Z'),
    currentStageId: 'stage-1',
    firstName: 'Ama',
    lastName: 'Mensah',
    email: 'ama@example.com',
    phone: null,
    country: 'Ghana',
    city: 'Accra',
    professionalSummary: null,
    skills: ['Payroll'],
    education: null,
    yearsOfExperience: 3,
    currentJobTitle: 'HR Officer',
    currentEmployer: null,
    highestEducationLevel: 'Bachelor Degree',
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
    answers: [],
    _count: { stageHistory: 1 },
    ...overrides,
  };
}

function applicationDto(overrides: Record<string, unknown> = {}) {
  return {
    vacancyId: 'vacancy-1',
    firstName: 'Ama',
    lastName: 'Mensah',
    email: 'ama@example.com',
    phone: '+233201234567',
    country: 'Ghana',
    city: 'Accra',
    yearsOfExperience: 3,
    currentJobTitle: 'HR Officer',
    highestEducationLevel: 'Bachelor Degree',
    skills: ['Payroll'],
    noticePeriod: 'One month',
    ...overrides,
  } as any;
}

function draftApplication(overrides: Record<string, unknown> = {}) {
  return candidate({
    status: RecruitmentApplicationStatus.DRAFT,
    accessTokenHash: 'token-hash',
    currentStageId: null,
    currentStage: null,
    submittedAt: null,
    vacancy: vacancy({
      questions: [],
      _count: { applications: 0 },
    }),
    _count: { stageHistory: 0 },
    ...overrides,
  });
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
          include: expect.objectContaining({
            _count: {
              select: {
                applications: {
                  where: { status: RecruitmentApplicationStatus.SUBMITTED },
                },
              },
            },
          }),
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
      prisma.recruitmentVacancy.findFirstOrThrow.mockResolvedValue(
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

    it('creates employer-specific application questions with a vacancy', async () => {
      prisma.recruitmentVacancy.create.mockResolvedValue(vacancy());
      prisma.recruitmentVacancy.findFirstOrThrow.mockResolvedValue(
        vacancy({ questions: [question()] }),
      );
      prisma.recruitmentVacancyQuestion.findMany.mockResolvedValue([]);
      prisma.recruitmentVacancyQuestion.create.mockResolvedValue(question());

      const result = await service.createVacancy('tenant-1', user, {
        title: 'HR Officer',
        questions: [
          {
            question: 'Why do you want this role?',
            required: true,
            sortOrder: 1,
          },
        ],
      });

      expect(prisma.recruitmentVacancyQuestion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          vacancyId: 'vacancy-1',
          question: 'Why do you want this role?',
          required: true,
          sortOrder: 1,
        }),
      });
      expect(result.questions).toHaveLength(1);
    });

    it('updates a vacancy without deleting applications', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue(vacancy());
      prisma.recruitmentVacancy.update.mockResolvedValue(
        vacancy({ title: 'Senior HR Officer' }),
      );
      prisma.recruitmentVacancy.findFirstOrThrow.mockResolvedValue(
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

    it('retires omitted vacancy questions without deleting historical answers', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue(vacancy());
      prisma.recruitmentVacancy.update.mockResolvedValue(vacancy());
      prisma.recruitmentVacancy.findFirstOrThrow.mockResolvedValue(vacancy());
      prisma.recruitmentVacancyQuestion.findMany.mockResolvedValue([
        question({ id: 'question-1' }),
        question({ id: 'question-2' }),
      ]);
      prisma.recruitmentVacancyQuestion.update.mockResolvedValue(
        question({ id: 'question-1', question: 'Updated question?' }),
      );
      prisma.recruitmentVacancyQuestion.updateMany.mockResolvedValue({
        count: 1,
      });

      await service.updateVacancy('tenant-1', user, 'vacancy-1', {
        questions: [
          {
            id: 'question-1',
            question: 'Updated question?',
            required: false,
            sortOrder: 1,
          },
        ],
      });

      expect(prisma.recruitmentVacancyQuestion.update).toHaveBeenCalledWith({
        where: { id: 'question-1' },
        data: expect.objectContaining({
          question: 'Updated question?',
          retiredAt: null,
        }),
      });
      expect(prisma.recruitmentVacancyQuestion.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: ['question-2'] } }),
        }),
      );
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
      prisma.recruitmentVacancy.findFirstOrThrow.mockResolvedValue(
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

  describe('reopening vacancies', () => {
    it('reopens a closed vacancy and clears the close details', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue(
        vacancy({ status: RecruitmentVacancyStatus.CLOSED }),
      );
      prisma.recruitmentVacancy.update.mockResolvedValue(
        vacancy({ status: RecruitmentVacancyStatus.OPEN }),
      );

      const result = await service.reopenVacancy('tenant-1', user, 'vacancy-1');

      expect(prisma.recruitmentVacancy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RecruitmentVacancyStatus.OPEN,
            closedAt: null,
            closedByUserId: null,
          }),
        }),
      );
      expect(result.status).toBe(RecruitmentVacancyStatus.OPEN);
    });

    it('only reopens closed vacancies', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue(
        vacancy({ status: RecruitmentVacancyStatus.DRAFT }),
      );

      await expect(
        service.reopenVacancy('tenant-1', user, 'vacancy-1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.recruitmentVacancy.update).not.toHaveBeenCalled();
    });

    it('refuses to reopen after the closing date', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue(
        vacancy({
          status: RecruitmentVacancyStatus.CLOSED,
          closingDate: new Date('2020-01-01'),
        }),
      );

      await expect(
        service.reopenVacancy('tenant-1', user, 'vacancy-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not disclose another tenant vacancy', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue(null);

      await expect(
        service.reopenVacancy('tenant-1', user, 'vacancy-9'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('vacancy form fields', () => {
    beforeEach(() => {
      prisma.recruitmentVacancy.create.mockResolvedValue(vacancy());
      prisma.recruitmentVacancy.findFirstOrThrow.mockResolvedValue(vacancy());
      prisma.recruitmentVacancyQuestion.findMany.mockResolvedValue([]);
      prisma.recruitmentVacancyQuestion.create.mockResolvedValue(question());
    });

    function createdData() {
      return prisma.recruitmentVacancy.create.mock.calls[0][0].data;
    }

    it('stores a fixed salary as a single amount', async () => {
      await service.createVacancy('tenant-1', user, {
        title: 'HR Officer',
        salaryType: RecruitmentSalaryType.FIXED,
        salaryAmount: 7000,
        salaryCurrency: 'ghs',
      });

      expect(createdData()).toEqual(
        expect.objectContaining({
          salaryType: RecruitmentSalaryType.FIXED,
          salaryCurrency: 'GHS',
        }),
      );
      expect(createdData().salaryAmount.toNumber()).toBe(7000);
      expect(createdData().salaryMin).toBeUndefined();
      expect(createdData().salaryMax).toBeUndefined();
    });

    it('requires both ends of a salary range and keeps them ordered', async () => {
      await expect(
        service.createVacancy('tenant-1', user, {
          title: 'HR Officer',
          salaryType: RecruitmentSalaryType.RANGE,
          salaryMin: 5000,
          salaryCurrency: 'GHS',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createVacancy('tenant-1', user, {
          title: 'HR Officer',
          salaryType: RecruitmentSalaryType.RANGE,
          salaryMin: 9000,
          salaryMax: 5000,
          salaryCurrency: 'GHS',
        }),
      ).rejects.toThrow('salaryMax cannot be lower than salaryMin');
    });

    it('carries no amount for negotiable or non-disclosed salaries', async () => {
      await service.createVacancy('tenant-1', user, {
        title: 'HR Officer',
        salaryType: RecruitmentSalaryType.NEGOTIABLE,
        salaryMin: 5000,
        salaryMax: 9000,
        salaryCurrency: 'GHS',
      });

      expect(createdData().salaryType).toBe(RecruitmentSalaryType.NEGOTIABLE);
      expect(createdData().salaryMin).toBeUndefined();
      expect(createdData().salaryMax).toBeUndefined();
      expect(createdData().salaryCurrency).toBeUndefined();
    });

    it('infers a salary range when only amounts are sent', async () => {
      await service.createVacancy('tenant-1', user, {
        title: 'HR Officer',
        salaryMin: 5000,
        salaryMax: 9000,
        salaryCurrency: 'GHS',
      });

      expect(createdData().salaryType).toBe(RecruitmentSalaryType.RANGE);
    });

    it('stores structured requirements and generates the public requirements text', async () => {
      await service.createVacancy('tenant-1', user, {
        title: 'HR Officer',
        details: {
          education: { levels: ['HND', 'BACHELORS'], required: true },
          experience: { minYears: 2, maxYears: 5 },
          skills: { items: ['Payroll', 'payroll ', 'Excel'], required: false },
          documents: { resume: true, coverLetter: true },
        },
      });

      expect(createdData().details).toEqual({
        education: { levels: ['HND', 'BACHELORS'], required: true },
        experience: { minYears: 2, maxYears: 5, required: false },
        skills: { items: ['Payroll', 'payroll', 'Excel'], required: false },
        documents: {
          resume: true,
          coverLetter: true,
          portfolio: false,
          github: false,
        },
      });
      expect(createdData().requirements).toBe(
        [
          "Education: Higher National Diploma (HND), Bachelor's Degree (required)",
          'Experience: 2 - 5 years',
          'Skills: Payroll, payroll, Excel',
        ].join('\n'),
      );
    });

    it('rejects a maximum experience below the minimum', async () => {
      await expect(
        service.createVacancy('tenant-1', user, {
          title: 'HR Officer',
          details: { experience: { minYears: 5, maxYears: 2 } },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a department outside the tenant', async () => {
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(
        service.createVacancy('tenant-1', user, {
          title: 'HR Officer',
          departmentId: '8d6b2d6a-70d9-4f6e-9a3c-0d2f7f1d6a11',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.department.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-1' }),
        }),
      );
    });

    it('stores department, branch, work mode, vacancies, city and closing date', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: 'dept-1' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      const closing = new Date(Date.now() + 7 * 86400000)
        .toISOString()
        .slice(0, 10);

      await service.createVacancy('tenant-1', user, {
        title: 'HR Officer',
        departmentId: 'dept-1',
        branchId: 'branch-1',
        workMode: 'HYBRID',
        vacancies: 3,
        city: 'Accra',
        closingDate: closing,
        perksAndBenefits: 'Health insurance',
      } as any);

      expect(createdData()).toEqual(
        expect.objectContaining({
          departmentId: 'dept-1',
          branchId: 'branch-1',
          workMode: 'HYBRID',
          vacancies: 3,
          city: 'Accra',
          perksAndBenefits: 'Health insurance',
          closingDate: new Date(`${closing}T00:00:00.000Z`),
        }),
      );
    });

    it('rejects a closing date in the past', async () => {
      await expect(
        service.createVacancy('tenant-1', user, {
          title: 'HR Officer',
          closingDate: '2020-01-01',
        }),
      ).rejects.toThrow('closingDate cannot be in the past');
    });

    it('fixes Yes / No questions to the options Yes and No', async () => {
      await service.createVacancy('tenant-1', user, {
        title: 'HR Officer',
        questions: [
          {
            question: 'Can you work weekends?',
            type: RecruitmentQuestionType.YES_NO,
            options: ['Maybe'],
          },
        ],
      });

      expect(prisma.recruitmentVacancyQuestion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: RecruitmentQuestionType.YES_NO,
          options: ['Yes', 'No'],
        }),
      });
    });

    it('stores short answer and paragraph questions without options', async () => {
      await service.createVacancy('tenant-1', user, {
        title: 'HR Officer',
        questions: [
          {
            question: 'Tell us about yourself',
            type: RecruitmentQuestionType.PARAGRAPH,
            options: ['ignored'],
          },
        ],
      });

      expect(
        prisma.recruitmentVacancyQuestion.create.mock.calls[0][0].data.type,
      ).toBe(RecruitmentQuestionType.PARAGRAPH);
    });

    it('requires options for multiple choice, checkboxes and dropdown questions', async () => {
      for (const type of [
        RecruitmentQuestionType.MULTIPLE_CHOICE,
        RecruitmentQuestionType.CHECKBOXES,
        RecruitmentQuestionType.DROPDOWN,
      ]) {
        await expect(
          service.createVacancy('tenant-1', user, {
            title: 'HR Officer',
            questions: [{ question: 'Pick one', type }],
          }),
        ).rejects.toThrow(BadRequestException);
      }
    });
  });

  describe('public vacancies', () => {
    it('lists only open vacancies for the requested tenant', async () => {
      prisma.recruitmentVacancy.findMany.mockResolvedValue([
        vacancy({ questions: [question({ required: false })] }),
      ]);
      prisma.recruitmentVacancy.count.mockResolvedValue(1);

      const result = await service.listPublicVacancies({
        tenantId: 'tenant-1',
      });

      expect(prisma.recruitmentVacancy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            status: RecruitmentVacancyStatus.OPEN,
          }),
        }),
      );
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          id: 'vacancy-1',
          title: 'HR Officer',
          questions: [
            expect.objectContaining({
              id: 'question-1',
              required: false,
            }),
          ],
        }),
      );
      expect(result.items[0]).not.toHaveProperty('createdByUserId');
    });

    it('lists open vacancies across tenants on the public board', async () => {
      prisma.recruitmentVacancy.findMany.mockResolvedValue([
        vacancy({ companyName: 'Acme Ghana Ltd' }),
      ]);
      prisma.recruitmentVacancy.count.mockResolvedValue(1);

      const result = await service.listPublicBoard({
        search: 'officer',
        workMode: WorkMode.REMOTE,
      });

      const args = prisma.recruitmentVacancy.findMany.mock.calls[0][0];
      expect(args.where).not.toHaveProperty('tenantId');
      expect(args.where.workMode).toBe(WorkMode.REMOTE);
      expect(JSON.stringify(args.where.AND)).toContain('OPEN');
      expect(JSON.stringify(args.where.AND)).toContain('officer');
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          tenantId: 'tenant-1',
          companyName: 'Acme Ghana Ltd',
        }),
      );
      expect(result.meta).toEqual({
        page: 1,
        limit: expect.any(Number),
        total: 1,
      });
    });

    it('hides blocked companies from the board and marks unverified ones', async () => {
      prisma.recruitmentEmployer.findMany
        .mockResolvedValueOnce([{ tenantId: 'blocked-tenant' }])
        .mockResolvedValueOnce([{ tenantId: 'tenant-1', isVerified: false }]);
      prisma.recruitmentVacancy.findMany.mockResolvedValue([vacancy()]);
      prisma.recruitmentVacancy.count.mockResolvedValue(1);

      const result = await service.listPublicBoard({});

      const where = prisma.recruitmentVacancy.findMany.mock.calls[0][0].where;
      expect(JSON.stringify(where.AND)).toContain('blocked-tenant');
      expect(result.items[0].companyVerified).toBe(false);
    });

    it('treats companies HR has no record of as verified', async () => {
      prisma.recruitmentVacancy.findMany.mockResolvedValue([vacancy()]);
      prisma.recruitmentVacancy.count.mockResolvedValue(1);

      const result = await service.listPublicBoard({});

      expect(result.items[0].companyVerified).toBe(true);
    });

    it('returns public detail for an open vacancy', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue(
        vacancy({ questions: [question()] }),
      );

      const result = await service.getPublicVacancy('tenant-1', 'vacancy-1');

      expect(prisma.recruitmentVacancy.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            id: 'vacancy-1',
            status: RecruitmentVacancyStatus.OPEN,
            OR: [
              { closingDate: null },
              { closingDate: { gte: expect.any(Date) } },
            ],
          },
        }),
      );
      expect(result.questions).toHaveLength(1);
    });

    it('does not expose draft or closed vacancies publicly', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue(null);

      await expect(
        service.getPublicVacancy('tenant-1', 'vacancy-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('requires tenant context for public vacancy access', async () => {
      await expect(
        service.listPublicVacancies({ tenantId: '' }),
      ).rejects.toThrow(BadRequestException);
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
            status: RecruitmentApplicationStatus.SUBMITTED,
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

    it('returns question responses in the candidate overview', async () => {
      prisma.recruitmentApplication.findFirst.mockResolvedValue(
        candidate({
          answers: [
            {
              id: 'answer-1',
              tenantId: 'tenant-1',
              applicationId: 'candidate-1',
              questionId: 'question-1',
              questionSnapshot: 'Why this role?',
              answer: 'I can help the team.',
              answerText: 'I can help the team.',
              selectedOptions: [],
              createdAt: new Date('2026-10-01T00:00:00Z'),
              question: question({
                id: 'question-1',
                question: 'Why this role?',
              }),
            },
          ],
        }),
      );

      const result = await service.getCandidate('tenant-1', 'candidate-1');

      expect(result.answers).toEqual([
        expect.objectContaining({
          questionId: 'question-1',
          question: 'Why this role?',
          answer: 'I can help the team.',
        }),
      ]);
    });

    it('returns only the candidate supporting document references', async () => {
      prisma.recruitmentApplication.findFirst.mockResolvedValue(
        candidate({
          resumeUrl: 'https://files.example/resume.pdf',
          resumeFileName: 'resume.pdf',
          coverLetterUrl: 'https://files.example/cover.pdf',
          coverLetterFileName: 'cover.pdf',
          portfolioUrl: 'https://portfolio.example',
          githubUrl: 'https://github.com/ama',
        }),
      );

      const result = await service.getCandidateDocuments(
        'tenant-1',
        'candidate-1',
      );

      expect(prisma.recruitmentApplication.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            id: 'candidate-1',
            status: RecruitmentApplicationStatus.SUBMITTED,
          },
        }),
      );
      expect(result.resume).toEqual({
        url: 'https://files.example/resume.pdf',
        fileName: 'resume.pdf',
      });
      expect(result.coverLetter).toEqual({
        url: 'https://files.example/cover.pdf',
        fileName: 'cover.pdf',
      });
      expect(result.portfolioUrl).toBe('https://portfolio.example');
      expect(result.githubUrl).toBe('https://github.com/ama');
    });

    it('does not disclose another tenant candidate documents', async () => {
      prisma.recruitmentApplication.findFirst.mockResolvedValue(null);

      await expect(
        service.getCandidateDocuments('tenant-1', 'other'),
      ).rejects.toThrow(NotFoundException);
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
        stage({ id: 'stage-2', isDefault: false }),
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
          where: {
            tenantId: 'tenant-1',
            id: 'candidate-1',
            status: RecruitmentApplicationStatus.SUBMITTED,
          },
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
        questions: [],
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
        ...applicationDto({
          email: 'AMA@EXAMPLE.COM',
        }),
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

    it('saves applicant responses to vacancy questions atomically', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue({
        id: 'vacancy-1',
        questions: [question()],
      });
      prisma.recruitmentStage.findMany.mockResolvedValue([stage()]);
      prisma.recruitmentStage.findFirst.mockResolvedValue(stage());
      prisma.employee.findFirst.mockResolvedValue(null);
      prisma.recruitmentApplication.create.mockResolvedValue(
        candidate({ id: 'candidate-1' }),
      );
      prisma.recruitmentApplicationAnswer.createMany.mockResolvedValue({
        count: 1,
      });
      prisma.recruitmentStageHistory.create.mockResolvedValue({});
      prisma.recruitmentApplication.findFirstOrThrow.mockResolvedValue(
        candidate({
          id: 'candidate-1',
          answers: [
            {
              id: 'answer-1',
              questionId: 'question-1',
              questionSnapshot: 'Why are you interested in this role?',
              answer: 'This is a strong fit.',
              createdAt: new Date('2026-10-01T00:00:00Z'),
              question: question(),
            },
          ],
        }),
      );

      await service.createApplication('tenant-1', user, {
        ...applicationDto({
          answers: [
            {
              questionId: 'question-1',
              answer: ' This is a strong fit. ',
            },
          ],
        }),
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(
        prisma.recruitmentApplicationAnswer.createMany,
      ).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            tenantId: 'tenant-1',
            applicationId: 'candidate-1',
            questionId: 'question-1',
            questionSnapshot: 'Why are you interested in this role?',
            answer: 'This is a strong fit.',
            answerText: 'This is a strong fit.',
            selectedOptions: [],
          }),
        ],
      });
    });

    it('rejects applications when a required vacancy question is missing', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue({
        id: 'vacancy-1',
        questions: [question({ required: true })],
      });
      prisma.recruitmentStage.findMany.mockResolvedValue([stage()]);
      prisma.recruitmentStage.findFirst.mockResolvedValue(stage());
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.createApplication('tenant-1', user, {
          ...applicationDto({
            answers: [],
          }),
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.recruitmentApplication.create).not.toHaveBeenCalled();
    });

    it('rejects answers for questions from another vacancy', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue({
        id: 'vacancy-1',
        questions: [question({ id: 'question-1', required: false })],
      });
      prisma.recruitmentStage.findMany.mockResolvedValue([stage()]);
      prisma.recruitmentStage.findFirst.mockResolvedValue(stage());
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.createApplication('tenant-1', user, {
          ...applicationDto({
            answers: [{ questionId: 'question-other', answer: 'Nope' }],
          }),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate answers for the same vacancy question', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue({
        id: 'vacancy-1',
        questions: [question({ required: false })],
      });
      prisma.recruitmentStage.findMany.mockResolvedValue([stage()]);
      prisma.recruitmentStage.findFirst.mockResolvedValue(stage());
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.createApplication('tenant-1', user, {
          ...applicationDto({
            answers: [
              { questionId: 'question-1', answer: 'First' },
              { questionId: 'question-1', answer: 'Second' },
            ],
          }),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('starts public applications as drafts without stage history', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue({
        id: 'vacancy-1',
        questions: [],
      });
      prisma.recruitmentApplication.create.mockResolvedValue(
        draftApplication({ id: 'application-1' }),
      );
      prisma.recruitmentApplicationAnswer.deleteMany.mockResolvedValue({
        count: 0,
      });
      prisma.recruitmentApplication.findFirstOrThrow.mockResolvedValue(
        draftApplication({ id: 'application-1' }),
      );

      const result = await service.createPublicApplication(
        'tenant-1',
        'vacancy-1',
        { firstName: 'Ama' },
      );

      expect(result.accessToken).toEqual(expect.any(String));
      expect(prisma.recruitmentApplication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          vacancyId: 'vacancy-1',
          status: RecruitmentApplicationStatus.DRAFT,
          accessTokenHash: expect.any(String),
        }),
      });
      expect(prisma.recruitmentApplication.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({
          currentStageId: expect.any(String),
        }),
      });
      expect(prisma.recruitmentStageHistory.create).not.toHaveBeenCalled();
    });

    it('does not allow draft access by id alone', async () => {
      await expect(
        service.getPublicApplication('application-1'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.recruitmentApplication.findFirst).not.toHaveBeenCalled();
    });

    it('does not allow one draft token to access another application id', async () => {
      prisma.recruitmentApplication.findFirst.mockResolvedValue(null);

      await expect(
        service.getPublicApplication(
          'application-b',
          'token-for-application-a',
        ),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.recruitmentApplication.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'application-b',
            accessTokenHash: expect.any(String),
            status: RecruitmentApplicationStatus.DRAFT,
          }),
        }),
      );
    });

    it('reviews draft completion without submitting it', async () => {
      prisma.recruitmentApplication.findFirst.mockResolvedValue(
        draftApplication({
          firstName: 'Ama',
          lastName: null,
          email: 'ama@example.com',
          phone: '+233201234567',
          country: 'Ghana',
          city: 'Accra',
          yearsOfExperience: 3,
          currentJobTitle: 'HR Officer',
          highestEducationLevel: 'Bachelor Degree',
          skills: ['Payroll'],
          noticePeriod: 'One month',
          vacancy: vacancy({
            questions: [question({ required: true })],
            _count: { applications: 0 },
          }),
          answers: [],
        }),
      );

      const result = await service.reviewPublicApplication(
        'application-1',
        'token',
      );

      expect(result.canSubmit).toBe(false);
      expect(result.missing).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'lastName' }),
          expect.objectContaining({ field: 'question:question-1' }),
        ]),
      );
      expect(prisma.recruitmentApplication.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'application-1',
            accessTokenHash: expect.any(String),
            status: RecruitmentApplicationStatus.DRAFT,
          }),
        }),
      );
    });

    it('only requires what the vacancy setup marked as required', async () => {
      const base = {
        firstName: 'Ama',
        lastName: 'Mensah',
        email: 'ama@example.com',
        phone: '+233201234567',
        country: 'Ghana',
        city: 'Accra',
        currentJobTitle: 'HR Officer',
        noticePeriod: 'One month',
        yearsOfExperience: null,
        highestEducationLevel: null,
        skills: [],
        languages: [],
        certificates: [],
        answers: [],
      };

      // Nothing marked required: skills, experience and education are optional.
      prisma.recruitmentApplication.findFirst.mockResolvedValueOnce(
        draftApplication({
          ...base,
          vacancy: vacancy({ details: null, _count: { applications: 0 } }),
        }),
      );
      const optional = await service.reviewPublicApplication(
        'application-1',
        'token',
      );
      expect(optional.canSubmit).toBe(true);

      // The same answers fail once the setup marks them required.
      prisma.recruitmentApplication.findFirst.mockResolvedValueOnce(
        draftApplication({
          ...base,
          vacancy: vacancy({
            details: {
              education: { levels: ['BACHELORS'], required: true },
              experience: { minYears: 2, required: true },
              skills: { items: ['Payroll'], required: true },
              languages: { items: ['English'], required: true },
              certificates: { items: ['ACCA'], required: false },
            },
            _count: { applications: 0 },
          }),
        }),
      );
      const strict = await service.reviewPublicApplication(
        'application-1',
        'token',
      );
      expect(strict.canSubmit).toBe(false);
      expect(
        strict.missing.map((item: { field: string }) => item.field),
      ).toEqual(
        expect.arrayContaining([
          'highestEducationLevel',
          'yearsOfExperience',
          'skills',
          'languages',
        ]),
      );
      expect(
        strict.missing.map((item: { field: string }) => item.field),
      ).not.toContain('certificates');
    });

    it('stores selected languages, certificates and structured history on a draft', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue(
        vacancy({ questions: [] }),
      );
      prisma.recruitmentApplication.create.mockResolvedValue(
        draftApplication({ id: 'application-1' }),
      );
      prisma.recruitmentApplication.findFirstOrThrow.mockResolvedValue(
        draftApplication({
          id: 'application-1',
          vacancy: vacancy({ _count: { applications: 0 } }),
        }),
      );

      await service.createPublicApplication('tenant-1', 'vacancy-1', {
        languages: [' English ', 'English', 'Twi'],
        certificates: ['ACCA'],
        educationHistory: [
          {
            level: 'BACHELORS',
            qualification: 'BSc Accounting',
            institution: 'UG',
          },
        ],
        workHistory: [
          { role: 'Accountant', company: 'GCB', start: '2019-01', end: '' },
          { role: '  ', company: 'Ignored', start: '2018-01', end: '2018-06' },
        ],
      });

      const data = prisma.recruitmentApplication.create.mock.calls[0][0].data;
      expect(data.languages).toEqual(['English', 'Twi']);
      expect(data.certificates).toEqual(['ACCA']);
      expect(data.educationHistory).toEqual([
        {
          level: 'BACHELORS',
          qualification: 'BSc Accounting',
          institution: 'UG',
        },
      ]);
      expect(data.workHistory).toEqual([
        { role: 'Accountant', company: 'GCB', start: '2019-01', end: '' },
      ]);
    });

    it('submits a complete public draft and assigns the default stage atomically', async () => {
      const managedDocuments = [
        {
          id: 'document-1',
          type: 'RESUME',
          originalFileName: 'CV.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 20,
          createdAt: new Date(),
        },
      ];
      prisma.recruitmentApplication.findFirst
        .mockResolvedValueOnce(
          draftApplication({
            ...applicationDto(),
            id: 'application-1',
            managedDocuments,
            vacancy: vacancy({
              questions: [question({ required: true })],
              details: { documents: { resume: true, coverLetter: false } },
              _count: { applications: 0 },
            }),
            answers: [
              {
                id: 'answer-1',
                tenantId: 'tenant-1',
                applicationId: 'application-1',
                questionId: 'question-1',
                questionSnapshot: 'Why are you interested in this role?',
                answer: 'This is a strong fit.',
                answerText: 'This is a strong fit.',
                selectedOptions: [],
                createdAt: new Date('2026-10-01T00:00:00Z'),
                question: question(),
              },
            ],
          }),
        )
        .mockResolvedValueOnce(null);
      prisma.recruitmentStage.findMany.mockResolvedValue([stage()]);
      prisma.recruitmentStage.findFirst.mockResolvedValue(stage());
      prisma.recruitmentApplication.update.mockResolvedValue({});
      prisma.recruitmentStageHistory.create.mockResolvedValue({});
      prisma.recruitmentApplication.findFirstOrThrow.mockResolvedValue(
        candidate({
          id: 'application-1',
          currentStageId: 'stage-1',
          managedDocuments,
        }),
      );

      const result = await service.submitPublicApplication(
        'application-1',
        'token',
      );
      expect(result.documents.managedDocuments).toEqual(managedDocuments);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.recruitmentApplication.findFirst.mock.invocationCallOrder[0],
      );
      expect(prisma.recruitmentApplication.update).toHaveBeenCalledWith({
        where: { id: 'application-1' },
        data: expect.objectContaining({
          status: RecruitmentApplicationStatus.SUBMITTED,
          currentStageId: 'stage-1',
          accessTokenHash: null,
        }),
      });
      expect(prisma.recruitmentStageHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          applicationId: 'application-1',
          previousStageId: null,
          newStageId: 'stage-1',
        }),
      });
    });

    // File storage is not set up yet, so required documents are not enforced.
    it.each([
      { resume: true, coverLetter: false },
      { resume: false, coverLetter: true },
      { resume: true, coverLetter: true },
    ])(
      'does not block review when required documents are not uploaded: %j',
      async ({ resume, coverLetter }) => {
        prisma.recruitmentApplication.findFirst.mockResolvedValue(
          draftApplication({
            ...applicationDto(),
            answers: [],
            managedDocuments: [],
            vacancy: vacancy({
              questions: [],
              details: { documents: { resume, coverLetter } },
            }),
          }),
        );
        const review = await service.reviewPublicApplication(
          'application-1',
          'token',
        );
        expect(review.missing).toEqual([]);
        expect(review.canSubmit).toBe(true);
      },
    );

    it('accepts confirmed documents, leaves optional documents optional, and returns safe review metadata', async () => {
      const document = {
        id: 'document-1',
        type: 'RESUME',
        originalFileName: 'CV.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 20,
        createdAt: new Date(),
      };
      prisma.recruitmentApplication.findFirst.mockResolvedValue(
        draftApplication({
          ...applicationDto(),
          answers: [],
          managedDocuments: [document],
          vacancy: vacancy({
            questions: [],
            details: { documents: { resume: true, coverLetter: false } },
          }),
        }),
      );
      const review = await service.reviewPublicApplication(
        'application-1',
        'token',
      );
      expect(review.canSubmit).toBe(true);
      expect(review.application.documents.managedDocuments).toEqual([document]);
      expect(JSON.stringify(review)).not.toContain('storageKey');
      expect(prisma.recruitmentApplication.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            managedDocuments: expect.objectContaining({
              where: { status: 'ACTIVE' },
            }),
          }),
        }),
      );
    });

    it('keeps managed and legacy documents visible after submission without changing their ownership', async () => {
      const document = {
        id: 'document-1',
        type: 'RESUME',
        originalFileName: 'CV.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 20,
        createdAt: new Date(),
      };
      prisma.recruitmentApplication.findFirst.mockResolvedValue(
        candidate({
          managedDocuments: [document],
          resumeUrl: 'https://legacy.example/cv.pdf',
        }),
      );
      const result = await service.getCandidateDocuments(
        'tenant-1',
        'candidate-1',
      );
      expect(result.managedDocuments).toEqual([document]);
      expect(result.legacyDocuments).toContainEqual(
        expect.objectContaining({
          source: 'LEGACY_EXTERNAL',
          url: 'https://legacy.example/cv.pdf',
        }),
      );
      expect(prisma.recruitmentApplication.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            id: 'candidate-1',
            status: 'SUBMITTED',
          },
        }),
      );
    });

    it('rejects duplicate submitted applications for the same vacancy and email', async () => {
      prisma.recruitmentApplication.findFirst
        .mockResolvedValueOnce(
          draftApplication({
            ...applicationDto(),
            id: 'application-1',
          }),
        )
        .mockResolvedValueOnce({ id: 'existing-submission' });

      await expect(
        service.submitPublicApplication('application-1', 'token'),
      ).rejects.toThrow(ConflictException);

      expect(prisma.recruitmentApplication.update).not.toHaveBeenCalled();
    });

    it('validates and snapshots single-select question answers', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue({
        id: 'vacancy-1',
        questions: [
          question({
            type: RecruitmentQuestionType.MULTIPLE_CHOICE,
            options: ['Yes', 'No'],
            required: true,
          }),
        ],
      });
      prisma.recruitmentStage.findMany.mockResolvedValue([stage()]);
      prisma.recruitmentStage.findFirst.mockResolvedValue(stage());
      prisma.employee.findFirst.mockResolvedValue(null);
      prisma.recruitmentApplication.create.mockResolvedValue(
        candidate({ id: 'candidate-1' }),
      );
      prisma.recruitmentApplicationAnswer.createMany.mockResolvedValue({
        count: 1,
      });
      prisma.recruitmentStageHistory.create.mockResolvedValue({});
      prisma.recruitmentApplication.findFirstOrThrow.mockResolvedValue(
        candidate({ id: 'candidate-1' }),
      );

      await service.createApplication(
        'tenant-1',
        user,
        applicationDto({
          answers: [{ questionId: 'question-1', selectedOptions: ['Yes'] }],
        }),
      );

      expect(
        prisma.recruitmentApplicationAnswer.createMany,
      ).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            questionId: 'question-1',
            answer: 'Yes',
            answerText: null,
            selectedOptions: ['Yes'],
          }),
        ],
      });
    });

    it('rejects unconfigured select question options', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue({
        id: 'vacancy-1',
        questions: [
          question({
            type: RecruitmentQuestionType.CHECKBOXES,
            options: ['Payroll', 'Benefits'],
            required: false,
          }),
        ],
      });
      prisma.recruitmentStage.findMany.mockResolvedValue([stage()]);
      prisma.recruitmentStage.findFirst.mockResolvedValue(stage());
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.createApplication(
          'tenant-1',
          user,
          applicationDto({
            answers: [
              {
                questionId: 'question-1',
                selectedOptions: ['Payroll', 'Unconfigured'],
              },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.recruitmentApplication.create).not.toHaveBeenCalled();
    });

    it('allows optional questions to remain unanswered while saving drafts', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue({
        id: 'vacancy-1',
        questions: [
          question({
            type: RecruitmentQuestionType.MULTIPLE_CHOICE,
            options: ['Yes', 'No'],
            required: false,
          }),
        ],
      });
      prisma.recruitmentApplication.create.mockResolvedValue(
        draftApplication({ id: 'application-1' }),
      );
      prisma.recruitmentApplicationAnswer.deleteMany.mockResolvedValue({
        count: 0,
      });
      prisma.recruitmentApplication.findFirstOrThrow.mockResolvedValue(
        draftApplication({ id: 'application-1' }),
      );

      await service.createPublicApplication('tenant-1', 'vacancy-1', {
        answers: [],
      });

      expect(prisma.recruitmentApplication.create).toHaveBeenCalled();
      expect(
        prisma.recruitmentApplicationAnswer.createMany,
      ).not.toHaveBeenCalled();
    });

    it('rejects closed or draft vacancies for application submission', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue(null);

      await expect(
        service.createApplication('tenant-1', user, {
          ...applicationDto(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('fails safely when no default stage can be resolved', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue({
        id: 'vacancy-1',
        questions: [],
      });
      prisma.recruitmentStage.findMany.mockResolvedValue([]);
      prisma.recruitmentStage.createMany.mockResolvedValue({ count: 0 });
      prisma.recruitmentStage.findFirst.mockResolvedValue(null);

      await expect(
        service.createApplication('tenant-1', user, {
          ...applicationDto(),
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('keeps stage transition consistent when history creation fails', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
      prisma.recruitmentApplication.findFirst.mockResolvedValue(
        candidate({ currentStageId: 'stage-1' }),
      );
      prisma.recruitmentStage.findFirst.mockResolvedValue(
        stage({ id: 'stage-2', isDefault: false }),
      );
      prisma.$transaction.mockRejectedValue(new Error('rollback'));

      await expect(
        service.moveCandidateStage('tenant-1', user, 'candidate-1', 'stage-2'),
      ).rejects.toThrow('rollback');
    });
  });

  describe('screening', () => {
    it('refuses to move a candidate back to the entry stage', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
      prisma.recruitmentApplication.findFirst.mockResolvedValue(
        candidate({ currentStageId: 'stage-2' }),
      );
      prisma.recruitmentStage.findFirst.mockResolvedValue(
        stage({ id: 'stage-1', isDefault: true }),
      );

      await expect(
        service.moveCandidateStage('tenant-1', user, 'candidate-1', 'stage-1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    describe('score on candidate lists', () => {
      const answer = (
        decision: string | null,
        retiredAt: Date | null = null,
      ) => ({
        id: `answer-${Math.random()}`,
        questionId: 'question-1',
        questionSnapshot: 'Can you relocate?',
        answer: 'Yes',
        answerText: null,
        selectedOptions: ['Yes'],
        createdAt: new Date('2026-10-01T00:00:00Z'),
        screeningDecision: decision,
        screeningDecidedAt: null,
        question: { question: 'Can you relocate?', retiredAt },
      });
      const listed = (answers: unknown[]) =>
        candidate({
          skills: ['Payroll'],
          answers,
          vacancy: vacancy({
            details: { skills: { items: ['Payroll'] } },
            _count: { applications: 1, questions: 2 },
          }),
        });

      it('is the application score alone until an answer is decided', async () => {
        prisma.recruitmentApplication.findMany.mockResolvedValue([
          listed([answer(null)]),
        ]);
        prisma.recruitmentApplication.count.mockResolvedValue(1);

        const result = await service.listCandidates('tenant-1', {} as any);

        expect(result.items[0].matchScore).toBe(100);
      });

      it('blends in the screening once an answer is decided', async () => {
        prisma.recruitmentApplication.findMany.mockResolvedValue([
          listed([answer('ACCEPTED')]),
        ]);
        prisma.recruitmentApplication.count.mockResolvedValue(1);

        const result = await service.listCandidates('tenant-1', {} as any);

        // 100% application and 1 of 2 questions accepted.
        expect(result.items[0].matchScore).toBe(75);
      });

      it('ignores decisions on retired questions and hides the internal counts', async () => {
        prisma.recruitmentApplication.findMany.mockResolvedValue([
          listed([answer('ACCEPTED', new Date('2026-10-02T00:00:00Z'))]),
        ]);
        prisma.recruitmentApplication.count.mockResolvedValue(1);

        const result = await service.listCandidates('tenant-1', {} as any);

        expect(result.items[0].matchScore).toBe(100);
        expect(result.items[0].vacancy).not.toHaveProperty('_count.questions');
      });
    });

    describe('decisions', () => {
      it('records who decided on an answer and when', async () => {
        prisma.recruitmentApplicationAnswer.findFirst.mockResolvedValue({
          id: 'answer-1',
        });
        prisma.recruitmentApplicationAnswer.update.mockResolvedValue({});
        prisma.recruitmentApplication.findFirst.mockResolvedValue(candidate());

        await service.setScreeningDecision(
          'tenant-1',
          user,
          'candidate-1',
          'question-1',
          'ACCEPTED' as any,
        );

        expect(
          prisma.recruitmentApplicationAnswer.findFirst,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              tenantId: 'tenant-1',
              applicationId: 'candidate-1',
              questionId: 'question-1',
            }),
          }),
        );
        expect(prisma.recruitmentApplicationAnswer.update).toHaveBeenCalledWith(
          {
            where: { id: 'answer-1' },
            data: {
              screeningDecision: 'ACCEPTED',
              screeningDecidedAt: expect.any(Date),
              screeningDecidedByUserId: user.id,
            },
          },
        );
      });

      it('clears the decision, and who made it, when given null', async () => {
        prisma.recruitmentApplicationAnswer.findFirst.mockResolvedValue({
          id: 'answer-1',
        });
        prisma.recruitmentApplicationAnswer.update.mockResolvedValue({});
        prisma.recruitmentApplication.findFirst.mockResolvedValue(candidate());

        await service.setScreeningDecision(
          'tenant-1',
          user,
          'candidate-1',
          'question-1',
          null,
        );

        expect(prisma.recruitmentApplicationAnswer.update).toHaveBeenCalledWith(
          {
            where: { id: 'answer-1' },
            data: {
              screeningDecision: null,
              screeningDecidedAt: null,
              screeningDecidedByUserId: null,
            },
          },
        );
      });

      it('never changes the candidate stage', async () => {
        prisma.recruitmentApplicationAnswer.findFirst.mockResolvedValue({
          id: 'answer-1',
        });
        prisma.recruitmentApplicationAnswer.update.mockResolvedValue({});
        prisma.recruitmentApplication.findFirst.mockResolvedValue(candidate());

        await service.setScreeningDecision(
          'tenant-1',
          user,
          'candidate-1',
          'question-1',
          'DECLINED' as any,
        );

        expect(prisma.recruitmentApplication.update).not.toHaveBeenCalled();
        expect(prisma.recruitmentStageHistory.create).not.toHaveBeenCalled();
      });

      it('does not disclose answers of another tenant or a draft', async () => {
        prisma.recruitmentApplicationAnswer.findFirst.mockResolvedValue(null);

        await expect(
          service.setScreeningDecision(
            'tenant-1',
            user,
            'other',
            'question-1',
            'ACCEPTED' as any,
          ),
        ).rejects.toThrow(NotFoundException);
        expect(
          prisma.recruitmentApplicationAnswer.update,
        ).not.toHaveBeenCalled();
      });
    });

    describe('moving a vacancy to Screening', () => {
      const screeningStage = stage({
        id: 'stage-screening',
        name: 'Screening',
        normalizedName: 'screening',
        sortOrder: 2,
        isDefault: false,
      });

      beforeEach(() => {
        prisma.recruitmentVacancy.findFirst.mockResolvedValue({
          id: 'vacancy-1',
        });
        prisma.recruitmentStage.findFirst.mockImplementation(
          async (args: any) =>
            args.where.isDefault ? stage() : screeningStage,
        );
        prisma.recruitmentStage.findMany.mockResolvedValue([stage()]);
        prisma.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
      });

      it('moves only applicants in the entry stage and writes their history', async () => {
        prisma.recruitmentApplication.findMany.mockResolvedValue([
          { id: 'a-1' },
          { id: 'a-2' },
        ]);
        prisma.recruitmentApplication.updateMany.mockResolvedValue({
          count: 2,
        });
        prisma.recruitmentStageHistory.createMany.mockResolvedValue({
          count: 2,
        });

        const result = await service.moveVacancyApplicantsToScreening(
          'tenant-1',
          user,
          'vacancy-1',
        );

        expect(result).toEqual({ moved: 2 });
        expect(prisma.recruitmentApplication.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              tenantId: 'tenant-1',
              vacancyId: 'vacancy-1',
              currentStageId: 'stage-1',
              autoRejectedAt: null,
              status: RecruitmentApplicationStatus.SUBMITTED,
            }),
          }),
        );
        expect(prisma.recruitmentApplication.updateMany).toHaveBeenCalledWith({
          where: { id: { in: ['a-1', 'a-2'] } },
          data: { currentStageId: 'stage-screening' },
        });
        expect(prisma.recruitmentStageHistory.createMany).toHaveBeenCalledWith({
          data: [
            expect.objectContaining({
              applicationId: 'a-1',
              previousStageId: 'stage-1',
              newStageId: 'stage-screening',
              changedByUserId: user.id,
              changedByEmployeeId: 'employee-1',
            }),
            expect.objectContaining({ applicationId: 'a-2' }),
          ],
        });
      });

      it('does nothing when nobody is waiting in the entry stage', async () => {
        prisma.recruitmentApplication.findMany.mockResolvedValue([]);

        const result = await service.moveVacancyApplicantsToScreening(
          'tenant-1',
          user,
          'vacancy-1',
        );

        expect(result).toEqual({ moved: 0 });
        expect(prisma.recruitmentApplication.updateMany).not.toHaveBeenCalled();
        expect(
          prisma.recruitmentStageHistory.createMany,
        ).not.toHaveBeenCalled();
      });

      it('needs a Screening stage', async () => {
        prisma.recruitmentStage.findFirst.mockImplementation(
          async (args: any) => (args.where.isDefault ? stage() : null),
        );

        await expect(
          service.moveVacancyApplicantsToScreening(
            'tenant-1',
            user,
            'vacancy-1',
          ),
        ).rejects.toThrow(ConflictException);
      });

      it('does not touch another tenant vacancy', async () => {
        prisma.recruitmentVacancy.findFirst.mockResolvedValue(null);

        await expect(
          service.moveVacancyApplicantsToScreening('tenant-1', user, 'other'),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('cut-off', () => {
    const details = {
      skills: { items: ['Excel', 'Payroll'], required: false },
    };
    const applied = stage();
    const rejected = stage({
      id: 'stage-rejected',
      name: 'Rejected',
      normalizedName: 'rejected',
      sortOrder: 2,
      isDefault: false,
    });

    function mockStages() {
      prisma.recruitmentStage.findMany.mockResolvedValue([applied, rejected]);
      prisma.recruitmentStage.findFirst.mockImplementation(({ where }: any) =>
        Promise.resolve(where.isDefault ? applied : rejected),
      );
      prisma.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
    }

    const strong = {
      id: 'strong',
      currentStageId: 'stage-1',
      autoRejectedAt: null,
      skills: ['Excel', 'Payroll'],
      languages: [],
      yearsOfExperience: 3,
    };
    const weak = { ...strong, id: 'weak', skills: ['Excel'] };
    const weakRejected = {
      ...weak,
      id: 'weak-rejected',
      currentStageId: 'stage-rejected',
      autoRejectedAt: new Date('2026-10-02T00:00:00Z'),
    };

    it('moves applicants below the cut-off to Rejected and records why', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue({
        id: 'vacancy-1',
        details,
      });
      mockStages();
      prisma.recruitmentApplication.findMany.mockResolvedValue([strong, weak]);

      const result = await service.setVacancyCutoff(
        'tenant-1',
        user,
        'vacancy-1',
        { cutoffScore: 80 },
      );

      expect(result).toEqual({
        cutoffScore: 80,
        rejected: 1,
        restored: 0,
        applied: true,
      });
      expect(prisma.recruitmentApplication.update).toHaveBeenCalledWith({
        where: { id: 'weak' },
        data: expect.objectContaining({
          currentStageId: 'stage-rejected',
          autoRejectedScore: 50,
        }),
      });
      expect(prisma.recruitmentStageHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          applicationId: 'weak',
          newStageId: 'stage-rejected',
          note: 'Auto-rejected: 50% match, cut-off 80%',
        }),
      });
    });

    it('only reports the counts on a dry run', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue({
        id: 'vacancy-1',
        details,
      });
      mockStages();
      prisma.recruitmentApplication.findMany.mockResolvedValue([strong, weak]);

      const result = await service.setVacancyCutoff(
        'tenant-1',
        user,
        'vacancy-1',
        { cutoffScore: 80, dryRun: true },
      );

      expect(result).toEqual({
        cutoffScore: 80,
        rejected: 1,
        restored: 0,
        applied: false,
      });
      expect(prisma.recruitmentVacancy.update).not.toHaveBeenCalled();
      expect(prisma.recruitmentApplication.update).not.toHaveBeenCalled();
    });

    it('brings back auto-rejected applicants when the cut-off is cleared', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue({
        id: 'vacancy-1',
        details,
      });
      mockStages();
      prisma.recruitmentApplication.findMany.mockResolvedValue([
        strong,
        weakRejected,
      ]);

      const result = await service.setVacancyCutoff(
        'tenant-1',
        user,
        'vacancy-1',
        { cutoffScore: null },
      );

      expect(result).toEqual({
        cutoffScore: null,
        rejected: 0,
        restored: 1,
        applied: true,
      });
      expect(prisma.recruitmentApplication.update).toHaveBeenCalledWith({
        where: { id: 'weak-rejected' },
        data: {
          currentStageId: 'stage-1',
          autoRejectedAt: null,
          autoRejectedScore: null,
        },
      });
    });

    it('keeps auto-rejected applicants who are still below a lowered cut-off', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue({
        id: 'vacancy-1',
        details,
      });
      mockStages();
      prisma.recruitmentApplication.findMany.mockResolvedValue([weakRejected]);

      const result = await service.setVacancyCutoff(
        'tenant-1',
        user,
        'vacancy-1',
        { cutoffScore: 60 },
      );

      expect(result.restored).toBe(0);
      expect(prisma.recruitmentApplication.update).not.toHaveBeenCalled();
    });

    it('refuses a cut-off when the opening has nothing to score against', async () => {
      prisma.recruitmentVacancy.findFirst.mockResolvedValue({
        id: 'vacancy-1',
        details: {},
      });

      await expect(
        service.setVacancyCutoff('tenant-1', user, 'vacancy-1', {
          cutoffScore: 50,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a new applicant who scores below the cut-off on submit', async () => {
      prisma.recruitmentApplication.findFirst
        .mockResolvedValueOnce(
          draftApplication({
            ...applicationDto(),
            id: 'application-1',
            skills: ['Excel'],
            vacancy: vacancy({
              details,
              cutoffScore: 80,
              questions: [],
              _count: { applications: 0 },
            }),
          }),
        )
        .mockResolvedValueOnce(null);
      mockStages();
      prisma.recruitmentApplication.update.mockResolvedValue({});
      prisma.recruitmentStageHistory.create.mockResolvedValue({});
      prisma.recruitmentApplication.findFirstOrThrow.mockResolvedValue(
        candidate({ id: 'application-1', currentStageId: 'stage-rejected' }),
      );

      await service.submitPublicApplication('application-1', 'token');

      expect(prisma.recruitmentApplication.update).toHaveBeenCalledWith({
        where: { id: 'application-1' },
        data: expect.objectContaining({
          currentStageId: 'stage-rejected',
          autoRejectedScore: 50,
        }),
      });
    });
  });

  describe('interviews', () => {
    const future = '2099-01-01T10:00:00.000Z';

    beforeEach(() => {
      prisma.recruitmentApplication.findFirst.mockResolvedValue(candidate());
      prisma.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
    });

    it('lists interviews for a submitted candidate within the tenant', async () => {
      prisma.recruitmentInterview.findMany.mockResolvedValue([interview()]);

      const result = await service.listCandidateInterviews(
        'tenant-1',
        'candidate-1',
      );

      expect(prisma.recruitmentApplication.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            status: RecruitmentApplicationStatus.SUBMITTED,
          }),
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'interview-1',
          candidateId: 'candidate-1',
          scheduledBy: {
            id: 'employee-1',
            firstName: 'Efua',
            lastName: 'Sarpong',
          },
        }),
      );
    });

    it('does not list interviews for a draft or missing candidate', async () => {
      prisma.recruitmentApplication.findFirst.mockResolvedValue(null);

      await expect(
        service.listCandidateInterviews('tenant-1', 'candidate-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.recruitmentInterview.findMany).not.toHaveBeenCalled();
    });

    it('schedules a video interview with its platform and link', async () => {
      prisma.recruitmentInterview.create.mockResolvedValue(interview());

      await service.scheduleCandidateInterview(
        'tenant-1',
        user,
        'candidate-1',
        {
          mode: RecruitmentInterviewMode.VIDEO,
          scheduledAt: future,
          durationMinutes: 45,
          platform: ' Google Meet ',
          meetingLink: 'https://meet.google.com/abc',
          notes: '  Bring a laptop ',
        },
      );

      expect(prisma.recruitmentInterview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            applicationId: 'candidate-1',
            mode: RecruitmentInterviewMode.VIDEO,
            platform: 'Google Meet',
            meetingLink: 'https://meet.google.com/abc',
            phone: null,
            location: null,
            notes: 'Bring a laptop',
            createdByUserId: 'user-1',
            createdByEmployeeId: 'employee-1',
          }),
        }),
      );
    });

    describe('moving the candidate to the Interview stage', () => {
      const interviewStage = stage({
        id: 'stage-interview',
        name: 'Interview',
        normalizedName: 'interview',
        sortOrder: 3,
        isDefault: false,
      });
      const dto = {
        mode: RecruitmentInterviewMode.PHONE,
        scheduledAt: future,
        durationMinutes: 30,
        phone: '+233200000000',
      };

      function candidateAt(name: string, sortOrder: number, id = 'stage-x') {
        return candidate({
          currentStageId: id,
          currentStage: { normalizedName: name, sortOrder },
        });
      }

      beforeEach(() => {
        prisma.recruitmentStage.findFirst.mockResolvedValue(interviewStage);
        prisma.recruitmentInterview.create.mockResolvedValue(
          interview({ mode: RecruitmentInterviewMode.PHONE }),
        );
      });

      it('moves an earlier-stage candidate and records why', async () => {
        prisma.recruitmentApplication.findFirst.mockResolvedValue(
          candidateAt('applied', 1, 'stage-1'),
        );

        await service.scheduleCandidateInterview(
          'tenant-1',
          user,
          'candidate-1',
          dto,
        );

        expect(prisma.recruitmentApplication.update).toHaveBeenCalledWith({
          where: { id: 'candidate-1' },
          data: expect.objectContaining({ currentStageId: 'stage-interview' }),
        });
        expect(prisma.recruitmentStageHistory.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            previousStageId: 'stage-1',
            newStageId: 'stage-interview',
            note: 'Moved automatically: interview scheduled',
          }),
        });
      });

      it('also moves a rejected candidate', async () => {
        prisma.recruitmentApplication.findFirst.mockResolvedValue(
          candidateAt('rejected', 6, 'stage-rejected'),
        );

        await service.scheduleCandidateInterview(
          'tenant-1',
          user,
          'candidate-1',
          dto,
        );

        expect(prisma.recruitmentApplication.update).toHaveBeenCalledWith({
          where: { id: 'candidate-1' },
          data: expect.objectContaining({
            currentStageId: 'stage-interview',
            autoRejectedAt: null,
          }),
        });
      });

      it('leaves a candidate who is already past the Interview stage', async () => {
        prisma.recruitmentApplication.findFirst.mockResolvedValue(
          candidateAt('offer', 4, 'stage-offer'),
        );

        await service.scheduleCandidateInterview(
          'tenant-1',
          user,
          'candidate-1',
          dto,
        );

        expect(prisma.recruitmentApplication.update).not.toHaveBeenCalled();
        expect(prisma.recruitmentInterview.create).toHaveBeenCalled();
      });

      it('leaves a candidate already in the Interview stage', async () => {
        prisma.recruitmentApplication.findFirst.mockResolvedValue(
          candidateAt('interview', 3, 'stage-interview'),
        );

        await service.scheduleCandidateInterview(
          'tenant-1',
          user,
          'candidate-1',
          dto,
        );

        expect(prisma.recruitmentApplication.update).not.toHaveBeenCalled();
      });
    });

    it('drops fields that do not belong to the chosen mode', async () => {
      prisma.recruitmentInterview.create.mockResolvedValue(
        interview({ mode: RecruitmentInterviewMode.PHONE }),
      );

      await service.scheduleCandidateInterview(
        'tenant-1',
        user,
        'candidate-1',
        {
          mode: RecruitmentInterviewMode.PHONE,
          scheduledAt: future,
          durationMinutes: 30,
          phone: '+233201234567',
          platform: 'Zoom',
          meetingLink: 'https://zoom.us/j/1',
          location: 'Accra',
        },
      );

      expect(prisma.recruitmentInterview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phone: '+233201234567',
            platform: null,
            meetingLink: null,
            location: null,
          }),
        }),
      );
    });

    it.each([
      [
        'a video interview without a link',
        {
          mode: RecruitmentInterviewMode.VIDEO,
          platform: 'Zoom',
        },
      ],
      [
        'a video interview with a non-http link',
        {
          mode: RecruitmentInterviewMode.VIDEO,
          platform: 'Zoom',
          meetingLink: 'ftp://example.com',
        },
      ],
      [
        'a phone interview without a number',
        { mode: RecruitmentInterviewMode.PHONE },
      ],
      [
        'an in-person interview without a location',
        { mode: RecruitmentInterviewMode.IN_PERSON },
      ],
    ])('rejects %s', async (_label, channel) => {
      await expect(
        service.scheduleCandidateInterview('tenant-1', user, 'candidate-1', {
          scheduledAt: future,
          durationMinutes: 30,
          ...channel,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.recruitmentInterview.create).not.toHaveBeenCalled();
    });

    it('rejects an interview that starts in the past', async () => {
      await expect(
        service.scheduleCandidateInterview('tenant-1', user, 'candidate-1', {
          mode: RecruitmentInterviewMode.IN_PERSON,
          scheduledAt: '2000-01-01T10:00:00.000Z',
          durationMinutes: 30,
          location: 'Head Office',
        }),
      ).rejects.toThrow('future');
    });

    it('reschedules a scheduled interview and keeps the stored channel', async () => {
      prisma.recruitmentInterview.findFirst.mockResolvedValue(interview());
      prisma.recruitmentInterview.update.mockResolvedValue(interview());

      await service.updateCandidateInterview(
        'tenant-1',
        user,
        'candidate-1',
        'interview-1',
        { scheduledAt: future, durationMinutes: 60 },
      );

      expect(prisma.recruitmentInterview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'interview-1' },
          data: expect.not.objectContaining({ status: expect.anything() }),
        }),
      );
      expect(prisma.recruitmentInterview.update.mock.calls[0][0].data).toEqual(
        expect.objectContaining({
          durationMinutes: 60,
          platform: 'Google Meet',
          meetingLink: 'https://meet.google.com/abc',
        }),
      );
    });

    it('requires the new mode details when the mode changes', async () => {
      prisma.recruitmentInterview.findFirst.mockResolvedValue(interview());

      await expect(
        service.updateCandidateInterview(
          'tenant-1',
          user,
          'candidate-1',
          'interview-1',
          { mode: RecruitmentInterviewMode.PHONE },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.recruitmentInterview.update).not.toHaveBeenCalled();
    });

    it('completes an interview with feedback', async () => {
      prisma.recruitmentInterview.findFirst.mockResolvedValue(interview());
      prisma.recruitmentInterview.update.mockResolvedValue(
        interview({ status: RecruitmentInterviewStatus.COMPLETED }),
      );

      await service.updateCandidateInterview(
        'tenant-1',
        user,
        'candidate-1',
        'interview-1',
        {
          status: RecruitmentInterviewStatus.COMPLETED,
          feedback: ' Strong answers ',
        },
      );

      expect(prisma.recruitmentInterview.update.mock.calls[0][0].data).toEqual({
        status: RecruitmentInterviewStatus.COMPLETED,
        feedback: 'Strong answers',
      });
    });

    it('does not let a cancelled interview change again', async () => {
      prisma.recruitmentInterview.findFirst.mockResolvedValue(
        interview({ status: RecruitmentInterviewStatus.CANCELLED }),
      );

      await expect(
        service.updateCandidateInterview(
          'tenant-1',
          user,
          'candidate-1',
          'interview-1',
          { feedback: 'Too late' },
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('only accepts feedback on a completed interview', async () => {
      prisma.recruitmentInterview.findFirst.mockResolvedValue(
        interview({ status: RecruitmentInterviewStatus.COMPLETED }),
      );
      prisma.recruitmentInterview.update.mockResolvedValue(interview());

      await expect(
        service.updateCandidateInterview(
          'tenant-1',
          user,
          'candidate-1',
          'interview-1',
          { durationMinutes: 90 },
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      await service.updateCandidateInterview(
        'tenant-1',
        user,
        'candidate-1',
        'interview-1',
        { feedback: 'Recommended' },
      );
      expect(prisma.recruitmentInterview.update).toHaveBeenCalled();
    });

    describe('stage changes when an interview finishes', () => {
      const interviewStage = stage({
        id: 'stage-interview',
        name: 'Interview',
        normalizedName: 'interview',
        sortOrder: 3,
        isDefault: false,
      });
      const screening = stage({
        id: 'stage-screening',
        name: 'Screening',
        normalizedName: 'screening',
        sortOrder: 2,
        isDefault: false,
      });
      const offer = stage({
        id: 'stage-offer',
        name: 'Offer',
        normalizedName: 'offer',
        sortOrder: 4,
        isDefault: false,
      });

      beforeEach(() => {
        prisma.recruitmentApplication.findFirst.mockResolvedValue(
          candidate({
            currentStageId: 'stage-interview',
            currentStage: { normalizedName: 'interview', sortOrder: 3 },
          }),
        );
        prisma.recruitmentInterview.findFirst.mockResolvedValue(interview());
        prisma.recruitmentInterview.update.mockResolvedValue(
          interview({ status: RecruitmentInterviewStatus.COMPLETED }),
        );
        prisma.recruitmentInterview.count.mockResolvedValue(0);
        prisma.recruitmentStage.findFirst.mockImplementation(({ where }: any) =>
          Promise.resolve(
            [interviewStage, screening, offer].find(
              (s) =>
                s.id === where.id || s.normalizedName === where.normalizedName,
            ) ?? null,
          ),
        );
      });

      it('sends the candidate back to Screening when the interview is cancelled', async () => {
        await service.updateCandidateInterview(
          'tenant-1',
          user,
          'candidate-1',
          'interview-1',
          { status: RecruitmentInterviewStatus.CANCELLED },
        );

        expect(prisma.recruitmentApplication.update).toHaveBeenCalledWith({
          where: { id: 'candidate-1' },
          data: expect.objectContaining({ currentStageId: 'stage-screening' }),
        });
      });

      it('keeps the candidate in Interview when another interview is still booked', async () => {
        prisma.recruitmentInterview.count.mockResolvedValue(1);

        await service.updateCandidateInterview(
          'tenant-1',
          user,
          'candidate-1',
          'interview-1',
          { status: RecruitmentInterviewStatus.CANCELLED },
        );

        expect(prisma.recruitmentApplication.update).not.toHaveBeenCalled();
      });

      it('does not move a candidate who has already left Interview', async () => {
        prisma.recruitmentApplication.findFirst.mockResolvedValue(
          candidate({
            currentStageId: 'stage-offer',
            currentStage: { normalizedName: 'offer', sortOrder: 4 },
          }),
        );

        await service.updateCandidateInterview(
          'tenant-1',
          user,
          'candidate-1',
          'interview-1',
          { status: RecruitmentInterviewStatus.CANCELLED },
        );

        expect(prisma.recruitmentApplication.update).not.toHaveBeenCalled();
      });

      it('keeps the candidate in Interview when it is completed without a stage', async () => {
        await service.updateCandidateInterview(
          'tenant-1',
          user,
          'candidate-1',
          'interview-1',
          { status: RecruitmentInterviewStatus.COMPLETED },
        );

        expect(prisma.recruitmentApplication.update).not.toHaveBeenCalled();
      });

      it('moves the candidate to the stage chosen on completion', async () => {
        await service.updateCandidateInterview(
          'tenant-1',
          user,
          'candidate-1',
          'interview-1',
          {
            status: RecruitmentInterviewStatus.COMPLETED,
            stageId: 'stage-offer',
          },
        );

        expect(prisma.recruitmentApplication.update).toHaveBeenCalledWith({
          where: { id: 'candidate-1' },
          data: expect.objectContaining({ currentStageId: 'stage-offer' }),
        });
      });

      it('refuses Applied and Screening as a completion stage', async () => {
        await expect(
          service.updateCandidateInterview(
            'tenant-1',
            user,
            'candidate-1',
            'interview-1',
            {
              status: RecruitmentInterviewStatus.COMPLETED,
              stageId: 'stage-screening',
            },
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it('refuses a stage unless the interview is being completed', async () => {
        await expect(
          service.updateCandidateInterview(
            'tenant-1',
            user,
            'candidate-1',
            'interview-1',
            { stageId: 'stage-offer' },
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
      });
    });

    it('returns not found for an interview that is not on this candidate', async () => {
      prisma.recruitmentInterview.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCandidateInterview(
          'tenant-1',
          user,
          'candidate-1',
          'other-interview',
          { notes: 'x' },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
