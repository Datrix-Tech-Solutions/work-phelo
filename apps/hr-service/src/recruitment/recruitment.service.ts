import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  Prisma,
  RecruitmentVacancyStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRecruitmentApplicationDto,
  QueryRecruitmentCandidatesDto,
} from './dto/candidate.dto';
import {
  CreateRecruitmentStageDto,
  UpdateRecruitmentStageDto,
} from './dto/stage.dto';
import {
  CreateRecruitmentVacancyDto,
  QueryPublicRecruitmentVacanciesDto,
  QueryRecruitmentVacanciesDto,
  RecruitmentVacancyQuestionDto,
  UpdateRecruitmentVacancyDto,
} from './dto/vacancy.dto';

const DEFAULT_RECRUITMENT_STAGES = [
  'Applied',
  'Screening',
  'Interview',
  'Offer',
  'Hired',
  'Rejected',
] as const;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const RECRUITMENT_CANDIDATE_INCLUDE = {
  vacancy: true,
  currentStage: true,
  answers: {
    include: { question: true },
    orderBy: { createdAt: 'asc' },
  },
  _count: { select: { stageHistory: true } },
} satisfies Prisma.RecruitmentApplicationInclude;

const RECRUITMENT_VACANCY_INCLUDE = {
  questions: {
    where: { retiredAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  },
  _count: { select: { applications: true } },
} satisfies Prisma.RecruitmentVacancyInclude;

@Injectable()
export class RecruitmentService {
  constructor(private readonly prisma: PrismaService) {}

  async listVacancies(tenantId: string, query: QueryRecruitmentVacanciesDto) {
    const page = this.page(query.page);
    const limit = this.limit(query.limit);
    const where: Prisma.RecruitmentVacancyWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { title: { contains: query.search.trim(), mode: 'insensitive' } },
              {
                location: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.recruitmentVacancy.findMany({
        where,
        include: RECRUITMENT_VACANCY_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.recruitmentVacancy.count({ where }),
    ]);

    return {
      items: items.map((item) => this.serializeVacancy(item)),
      meta: { page, limit, total },
    };
  }

  async createVacancy(
    tenantId: string,
    user: RequestUser,
    dto: CreateRecruitmentVacancyDto,
  ) {
    this.validateSalaryRange(dto.salaryMin, dto.salaryMax);
    if (dto.status === RecruitmentVacancyStatus.OPEN) {
      this.assertPublishable(dto);
    }

    const vacancy = await this.prisma.$transaction(async (tx) => {
      const created = await tx.recruitmentVacancy.create({
        data: {
          tenantId,
          title: this.optionalTrim(dto.title),
          location: this.optionalTrim(dto.location),
          jobType: dto.jobType,
          description: this.optionalTrim(dto.description),
          responsibilities: this.optionalTrim(dto.responsibilities),
          requirements: this.optionalTrim(dto.requirements),
          salaryMin: this.toDecimal(dto.salaryMin),
          salaryMax: this.toDecimal(dto.salaryMax),
          salaryCurrency: this.optionalTrim(dto.salaryCurrency)?.toUpperCase(),
          status: dto.status ?? RecruitmentVacancyStatus.DRAFT,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      if (dto.questions !== undefined) {
        await this.replaceVacancyQuestions(
          tx,
          tenantId,
          created.id,
          dto.questions,
        );
      }
      return tx.recruitmentVacancy.findFirstOrThrow({
        where: { tenantId, id: created.id },
        include: RECRUITMENT_VACANCY_INCLUDE,
      });
    });

    return this.serializeVacancy(vacancy);
  }

  async getVacancy(tenantId: string, vacancyId: string) {
    const vacancy = await this.prisma.recruitmentVacancy.findFirst({
      where: { tenantId, id: vacancyId },
      include: RECRUITMENT_VACANCY_INCLUDE,
    });
    if (!vacancy) throw new NotFoundException('Recruitment vacancy not found');
    return this.serializeVacancy(vacancy);
  }

  async listPublicVacancies(query: QueryPublicRecruitmentVacanciesDto) {
    const page = this.page(query.page);
    const limit = this.limit(query.limit);
    const tenantId = this.requirePublicTenantId(query.tenantId);
    const where: Prisma.RecruitmentVacancyWhereInput = {
      tenantId,
      status: RecruitmentVacancyStatus.OPEN,
      ...(query.search?.trim()
        ? {
            OR: [
              { title: { contains: query.search.trim(), mode: 'insensitive' } },
              {
                location: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.recruitmentVacancy.findMany({
        where,
        include: RECRUITMENT_VACANCY_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.recruitmentVacancy.count({ where }),
    ]);

    return {
      items: items.map((item) => this.serializePublicVacancy(item)),
      meta: { page, limit, total },
    };
  }

  async getPublicVacancy(tenantId: string, vacancyId: string) {
    const publicTenantId = this.requirePublicTenantId(tenantId);
    const vacancy = await this.prisma.recruitmentVacancy.findFirst({
      where: {
        tenantId: publicTenantId,
        id: vacancyId,
        status: RecruitmentVacancyStatus.OPEN,
      },
      include: RECRUITMENT_VACANCY_INCLUDE,
    });
    if (!vacancy) throw new NotFoundException('Recruitment vacancy not found');
    return this.serializePublicVacancy(vacancy);
  }

  async updateVacancy(
    tenantId: string,
    user: RequestUser,
    vacancyId: string,
    dto: UpdateRecruitmentVacancyDto,
  ) {
    const existing = await this.prisma.recruitmentVacancy.findFirst({
      where: { tenantId, id: vacancyId },
    });
    if (!existing) throw new NotFoundException('Recruitment vacancy not found');

    this.validateSalaryRange(
      dto.salaryMin ?? this.decimalToNumber(existing.salaryMin),
      dto.salaryMax ?? this.decimalToNumber(existing.salaryMax),
    );

    const next = {
      title: dto.title ?? existing.title ?? undefined,
      location: dto.location ?? existing.location ?? undefined,
      jobType: dto.jobType ?? existing.jobType ?? undefined,
      description: dto.description ?? existing.description ?? undefined,
    };
    if (dto.status === RecruitmentVacancyStatus.OPEN) {
      this.assertPublishable(next);
    }

    const vacancy = await this.prisma.$transaction(async (tx) => {
      await tx.recruitmentVacancy.update({
        where: { id: vacancyId },
        data: {
          ...(dto.title !== undefined
            ? { title: this.optionalTrim(dto.title) }
            : {}),
          ...(dto.location !== undefined
            ? { location: this.optionalTrim(dto.location) }
            : {}),
          ...(dto.jobType !== undefined ? { jobType: dto.jobType } : {}),
          ...(dto.description !== undefined
            ? { description: this.optionalTrim(dto.description) }
            : {}),
          ...(dto.responsibilities !== undefined
            ? { responsibilities: this.optionalTrim(dto.responsibilities) }
            : {}),
          ...(dto.requirements !== undefined
            ? { requirements: this.optionalTrim(dto.requirements) }
            : {}),
          ...(dto.salaryMin !== undefined
            ? { salaryMin: this.toDecimal(dto.salaryMin) }
            : {}),
          ...(dto.salaryMax !== undefined
            ? { salaryMax: this.toDecimal(dto.salaryMax) }
            : {}),
          ...(dto.salaryCurrency !== undefined
            ? {
                salaryCurrency: this.optionalTrim(
                  dto.salaryCurrency,
                )?.toUpperCase(),
              }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          updatedByUserId: user.id,
        },
      });
      if (dto.questions !== undefined) {
        await this.replaceVacancyQuestions(
          tx,
          tenantId,
          vacancyId,
          dto.questions,
        );
      }
      return tx.recruitmentVacancy.findFirstOrThrow({
        where: { tenantId, id: vacancyId },
        include: RECRUITMENT_VACANCY_INCLUDE,
      });
    });

    return this.serializeVacancy(vacancy);
  }

  async closeVacancy(tenantId: string, user: RequestUser, vacancyId: string) {
    await this.getVacancy(tenantId, vacancyId);
    const vacancy = await this.prisma.recruitmentVacancy.update({
      where: { id: vacancyId },
      data: {
        status: RecruitmentVacancyStatus.CLOSED,
        closedAt: new Date(),
        closedByUserId: user.id,
        updatedByUserId: user.id,
      },
      include: RECRUITMENT_VACANCY_INCLUDE,
    });
    return this.serializeVacancy(vacancy);
  }

  async listStages(tenantId: string) {
    await this.ensureDefaultStages(tenantId);
    return this.prisma.recruitmentStage.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createStage(tenantId: string, dto: CreateRecruitmentStageDto) {
    await this.ensureDefaultStages(tenantId);
    const normalizedName = this.normalizeName(dto.name);
    await this.assertStageNameAvailable(tenantId, normalizedName);
    const sortOrder =
      dto.sortOrder ?? (await this.nextStageSortOrder(tenantId));

    const stage = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.recruitmentStage.updateMany({
          where: { tenantId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.recruitmentStage.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          normalizedName,
          description: this.optionalTrim(dto.description),
          sortOrder,
          isDefault: dto.isDefault ?? false,
        },
      });
    });

    return stage;
  }

  async updateStage(
    tenantId: string,
    stageId: string,
    dto: UpdateRecruitmentStageDto,
  ) {
    const stage = await this.getStageOrThrow(tenantId, stageId);
    const normalizedName =
      dto.name !== undefined ? this.normalizeName(dto.name) : undefined;
    if (normalizedName && normalizedName !== stage.normalizedName) {
      await this.assertStageNameAvailable(tenantId, normalizedName);
    }
    if (dto.isDefault === false && stage.isDefault) {
      throw new ConflictException(
        'Choose another default recruitment stage before clearing this one',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.recruitmentStage.updateMany({
          where: { tenantId, isDefault: true, id: { not: stageId } },
          data: { isDefault: false },
        });
      }

      return tx.recruitmentStage.update({
        where: { id: stageId },
        data: {
          ...(dto.name !== undefined
            ? { name: dto.name.trim(), normalizedName }
            : {}),
          ...(dto.description !== undefined
            ? { description: this.optionalTrim(dto.description) }
            : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        },
      });
    });
  }

  async deleteStage(tenantId: string, stageId: string) {
    const stage = await this.getStageOrThrow(tenantId, stageId);
    const usage = await this.prisma.recruitmentApplication.count({
      where: { tenantId, currentStageId: stageId },
    });
    const historyUsage = await this.prisma.recruitmentStageHistory.count({
      where: {
        tenantId,
        OR: [{ previousStageId: stageId }, { newStageId: stageId }],
      },
    });
    if (usage > 0 || historyUsage > 0) {
      throw new ConflictException('Recruitment stage is in use');
    }

    return this.prisma.$transaction(async (tx) => {
      let replacement: { id: string } | null = null;
      if (stage.isDefault) {
        replacement = await tx.recruitmentStage.findFirst({
          where: { tenantId, id: { not: stageId } },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        });
        if (!replacement) {
          throw new ConflictException(
            'At least one recruitment stage is required',
          );
        }
      }

      const deleted = await tx.recruitmentStage.delete({
        where: { id: stageId },
      });
      if (replacement) {
        await tx.recruitmentStage.update({
          where: { id: replacement.id },
          data: { isDefault: true },
        });
      }
      return deleted;
    });
  }

  async listCandidates(tenantId: string, query: QueryRecruitmentCandidatesDto) {
    const page = this.page(query.page);
    const limit = this.limit(query.limit);
    const where = this.candidateWhere(tenantId, query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.recruitmentApplication.findMany({
        where,
        include: RECRUITMENT_CANDIDATE_INCLUDE,
        orderBy: [{ appliedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.recruitmentApplication.count({ where }),
    ]);

    return {
      items: items.map((candidate) => this.serializeCandidate(candidate)),
      meta: { page, limit, total },
    };
  }

  async getCandidate(tenantId: string, candidateId: string) {
    const candidate = await this.prisma.recruitmentApplication.findFirst({
      where: { tenantId, id: candidateId },
      include: RECRUITMENT_CANDIDATE_INCLUDE,
    });
    if (!candidate)
      throw new NotFoundException('Recruitment candidate not found');
    return this.serializeCandidate(candidate);
  }

  async getCandidateDocuments(tenantId: string, candidateId: string) {
    const candidate = await this.prisma.recruitmentApplication.findFirst({
      where: { tenantId, id: candidateId },
      select: {
        id: true,
        tenantId: true,
        vacancyId: true,
        resumeUrl: true,
        resumeFileName: true,
        coverLetterUrl: true,
        coverLetterFileName: true,
        portfolioUrl: true,
        githubUrl: true,
      },
    });
    if (!candidate)
      throw new NotFoundException('Recruitment candidate not found');
    return this.serializeCandidateDocuments(candidate);
  }

  async moveCandidateStage(
    tenantId: string,
    user: RequestUser,
    candidateId: string,
    stageId: string,
    note?: string,
  ) {
    const actorEmployee = await this.prisma.employee.findFirst({
      where: { tenantId, userId: user.id },
      select: { id: true },
    });

    const candidate = await this.prisma.recruitmentApplication.findFirst({
      where: { tenantId, id: candidateId },
      select: { id: true, currentStageId: true },
    });
    if (!candidate)
      throw new NotFoundException('Recruitment candidate not found');

    const targetStage = await this.prisma.recruitmentStage.findFirst({
      where: { tenantId, id: stageId },
      select: { id: true },
    });
    if (!targetStage)
      throw new NotFoundException('Recruitment stage not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.recruitmentApplication.update({
        where: { id: candidateId },
        data: { currentStageId: stageId },
      });
      await tx.recruitmentStageHistory.create({
        data: {
          tenantId,
          applicationId: candidateId,
          previousStageId: candidate.currentStageId,
          newStageId: stageId,
          changedByUserId: user.id,
          changedByEmployeeId: actorEmployee?.id,
          note: this.optionalTrim(note),
        },
      });

      const updated = await tx.recruitmentApplication.findFirstOrThrow({
        where: { tenantId, id: candidateId },
        include: RECRUITMENT_CANDIDATE_INCLUDE,
      });
      return this.serializeCandidate(updated);
    });
  }

  async getCandidateStageHistory(tenantId: string, candidateId: string) {
    await this.getCandidate(tenantId, candidateId);
    return this.prisma.recruitmentStageHistory.findMany({
      where: { tenantId, applicationId: candidateId },
      include: {
        previousStage: true,
        newStage: true,
        changedByEmployee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: [{ changedAt: 'asc' }, { id: 'asc' }],
    });
  }

  async createApplication(
    tenantId: string,
    user: RequestUser | null,
    dto: CreateRecruitmentApplicationDto,
  ) {
    if (!dto.vacancyId) {
      throw new BadRequestException('vacancyId is required');
    }
    const vacancyId = dto.vacancyId;
    const vacancy = await this.prisma.recruitmentVacancy.findFirst({
      where: {
        tenantId,
        id: vacancyId,
        status: RecruitmentVacancyStatus.OPEN,
      },
      include: {
        questions: {
          where: { retiredAt: null },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!vacancy) throw new NotFoundException('Recruitment vacancy not found');

    const initialStage = await this.getDefaultStage(tenantId);
    const actorEmployee = user
      ? await this.prisma.employee.findFirst({
          where: { tenantId, userId: user.id },
          select: { id: true },
        })
      : null;
    const answers = this.validateApplicationAnswers(vacancy.questions, dto);

    return this.prisma.$transaction(async (tx) => {
      const application = await tx.recruitmentApplication.create({
        data: {
          tenantId,
          vacancyId,
          currentStageId: initialStage.id,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email: dto.email.trim().toLowerCase(),
          phone: this.optionalTrim(dto.phone),
          professionalSummary: this.optionalTrim(dto.professionalSummary),
          skills:
            dto.skills?.map((skill) => skill.trim()).filter(Boolean) ?? [],
          education: this.optionalTrim(dto.education),
          expectedSalary: this.toDecimal(dto.expectedSalary),
          expectedSalaryCurrency: this.optionalTrim(
            dto.expectedSalaryCurrency,
          )?.toUpperCase(),
          noticePeriod: this.optionalTrim(dto.noticePeriod),
          resumeUrl: this.optionalTrim(dto.resumeUrl),
          resumeFileName: this.optionalTrim(dto.resumeFileName),
          coverLetterUrl: this.optionalTrim(dto.coverLetterUrl),
          coverLetterFileName: this.optionalTrim(dto.coverLetterFileName),
          portfolioUrl: this.optionalTrim(dto.portfolioUrl),
          githubUrl: this.optionalTrim(dto.githubUrl),
        },
      });
      if (answers.length > 0) {
        await tx.recruitmentApplicationAnswer.createMany({
          data: answers.map((answer) => ({
            tenantId,
            applicationId: application.id,
            questionId: answer.questionId,
            questionSnapshot: answer.questionSnapshot,
            answer: answer.answer,
          })),
        });
      }
      await tx.recruitmentStageHistory.create({
        data: {
          tenantId,
          applicationId: application.id,
          previousStageId: null,
          newStageId: initialStage.id,
          changedByUserId: user?.id,
          changedByEmployeeId: actorEmployee?.id,
          note: 'Initial application stage',
        },
      });

      const created = await tx.recruitmentApplication.findFirstOrThrow({
        where: { tenantId, id: application.id },
        include: RECRUITMENT_CANDIDATE_INCLUDE,
      });
      return this.serializeCandidate(created);
    });
  }

  async createPublicApplication(
    tenantId: string,
    vacancyId: string,
    dto: CreateRecruitmentApplicationDto,
  ) {
    return this.createApplication(this.requirePublicTenantId(tenantId), null, {
      ...dto,
      vacancyId,
    });
  }

  private async ensureDefaultStages(tenantId: string) {
    let existing = await this.prisma.recruitmentStage.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' },
    });
    if (existing.length === 0) {
      await this.prisma.recruitmentStage.createMany({
        data: DEFAULT_RECRUITMENT_STAGES.map((name, index) => ({
          tenantId,
          name,
          normalizedName: this.normalizeName(name),
          sortOrder: index + 1,
          isDefault: index === 0,
        })),
        skipDuplicates: true,
      });
      existing = await this.prisma.recruitmentStage.findMany({
        where: { tenantId },
        orderBy: { sortOrder: 'asc' },
      });
    }

    if (!existing.some((stage) => stage.isDefault) && existing[0]) {
      await this.prisma.recruitmentStage.update({
        where: { id: existing[0].id },
        data: { isDefault: true },
      });
    }
  }

  private async getDefaultStage(tenantId: string) {
    await this.ensureDefaultStages(tenantId);
    const stage = await this.prisma.recruitmentStage.findFirst({
      where: { tenantId, isDefault: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (!stage)
      throw new ConflictException('No default recruitment stage found');
    return stage;
  }

  private async replaceVacancyQuestions(
    tx: Prisma.TransactionClient,
    tenantId: string,
    vacancyId: string,
    questions: RecruitmentVacancyQuestionDto[],
  ) {
    const existing = await tx.recruitmentVacancyQuestion.findMany({
      where: { tenantId, vacancyId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((question) => question.id));
    const retainedIds = new Set<string>();
    const now = new Date();

    for (const [index, question] of questions.entries()) {
      const questionText = question.question.trim();
      const sortOrder = question.sortOrder ?? index + 1;
      if (question.id) {
        if (!existingIds.has(question.id)) {
          throw new NotFoundException('Recruitment vacancy question not found');
        }
        if (retainedIds.has(question.id)) {
          throw new BadRequestException(
            'Duplicate recruitment vacancy question id',
          );
        }
        retainedIds.add(question.id);
        await tx.recruitmentVacancyQuestion.update({
          where: { id: question.id },
          data: {
            question: questionText,
            required: question.required ?? false,
            sortOrder,
            retiredAt: null,
          },
        });
        continue;
      }

      await tx.recruitmentVacancyQuestion.create({
        data: {
          tenantId,
          vacancyId,
          question: questionText,
          required: question.required ?? false,
          sortOrder,
        },
      });
    }

    const retiredIds = existing
      .map((question) => question.id)
      .filter((questionId) => !retainedIds.has(questionId));
    if (retiredIds.length > 0) {
      await tx.recruitmentVacancyQuestion.updateMany({
        where: {
          tenantId,
          vacancyId,
          retiredAt: null,
          id: { in: retiredIds },
        },
        data: { retiredAt: now },
      });
    }
  }

  private validateApplicationAnswers(
    questions: Array<{
      id: string;
      question: string;
      required: boolean;
    }>,
    dto: CreateRecruitmentApplicationDto,
  ) {
    const activeQuestions = new Map(
      questions.map((question) => [question.id, question]),
    );
    const answers = dto.answers ?? [];
    const seen = new Set<string>();
    const normalizedAnswers: Array<{
      questionId: string;
      questionSnapshot: string;
      answer: string;
    }> = [];

    for (const answer of answers) {
      if (seen.has(answer.questionId)) {
        throw new BadRequestException(
          'Duplicate answer for recruitment vacancy question',
        );
      }
      seen.add(answer.questionId);
      const question = activeQuestions.get(answer.questionId);
      if (!question) {
        throw new BadRequestException(
          'Answer references an invalid recruitment vacancy question',
        );
      }
      const value = answer.answer.trim();
      if (!value) {
        throw new BadRequestException(
          'Recruitment vacancy question answers cannot be empty',
        );
      }
      normalizedAnswers.push({
        questionId: answer.questionId,
        questionSnapshot: question.question,
        answer: value,
      });
    }

    const answeredIds = new Set(
      normalizedAnswers.map((answer) => answer.questionId),
    );
    const missingRequired = questions.some(
      (question) => question.required && !answeredIds.has(question.id),
    );
    if (missingRequired) {
      throw new BadRequestException(
        'Required recruitment vacancy questions must be answered',
      );
    }

    return normalizedAnswers;
  }

  private async getStageOrThrow(tenantId: string, stageId: string) {
    const stage = await this.prisma.recruitmentStage.findFirst({
      where: { tenantId, id: stageId },
    });
    if (!stage) throw new NotFoundException('Recruitment stage not found');
    return stage;
  }

  private async assertStageNameAvailable(
    tenantId: string,
    normalizedName: string,
  ) {
    const existing = await this.prisma.recruitmentStage.findUnique({
      where: { tenantId_normalizedName: { tenantId, normalizedName } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A recruitment stage with this name exists');
    }
  }

  private async nextStageSortOrder(tenantId: string) {
    const aggregate = await this.prisma.recruitmentStage.aggregate({
      where: { tenantId },
      _max: { sortOrder: true },
    });
    return (aggregate._max.sortOrder ?? 0) + 1;
  }

  private candidateWhere(
    tenantId: string,
    query: QueryRecruitmentCandidatesDto,
  ): Prisma.RecruitmentApplicationWhereInput {
    const appliedAt: Prisma.DateTimeFilter = {};
    if (query.appliedFrom) appliedAt.gte = new Date(query.appliedFrom);
    if (query.appliedTo) appliedAt.lte = new Date(query.appliedTo);

    const search = query.search?.trim();
    return {
      tenantId,
      ...(query.vacancyId ? { vacancyId: query.vacancyId } : {}),
      ...(query.stageId ? { currentStageId: query.stageId } : {}),
      ...(Object.keys(appliedAt).length > 0 ? { appliedAt } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private serializeVacancy(
    vacancy: Prisma.RecruitmentVacancyGetPayload<{
      include: typeof RECRUITMENT_VACANCY_INCLUDE;
    }>,
  ) {
    return {
      ...vacancy,
      salaryMin: this.decimalToNumber(vacancy.salaryMin),
      salaryMax: this.decimalToNumber(vacancy.salaryMax),
      applicantCount: vacancy._count.applications,
    };
  }

  private serializePublicVacancy(
    vacancy: Prisma.RecruitmentVacancyGetPayload<{
      include: typeof RECRUITMENT_VACANCY_INCLUDE;
    }>,
  ) {
    return {
      id: vacancy.id,
      tenantId: vacancy.tenantId,
      title: vacancy.title,
      location: vacancy.location,
      jobType: vacancy.jobType,
      description: vacancy.description,
      responsibilities: vacancy.responsibilities,
      requirements: vacancy.requirements,
      salaryMin: this.decimalToNumber(vacancy.salaryMin),
      salaryMax: this.decimalToNumber(vacancy.salaryMax),
      salaryCurrency: vacancy.salaryCurrency,
      status: vacancy.status,
      createdAt: vacancy.createdAt,
      updatedAt: vacancy.updatedAt,
      questions: vacancy.questions.map((question) => ({
        id: question.id,
        question: question.question,
        required: question.required,
        sortOrder: question.sortOrder,
      })),
    };
  }

  private serializeCandidate(
    candidate: Prisma.RecruitmentApplicationGetPayload<{
      include: typeof RECRUITMENT_CANDIDATE_INCLUDE;
    }>,
  ) {
    return {
      ...candidate,
      expectedSalary: this.decimalToNumber(candidate.expectedSalary),
      vacancy: {
        ...candidate.vacancy,
        salaryMin: this.decimalToNumber(candidate.vacancy.salaryMin),
        salaryMax: this.decimalToNumber(candidate.vacancy.salaryMax),
      },
      answers: candidate.answers.map((answer) => ({
        id: answer.id,
        questionId: answer.questionId,
        question: answer.questionSnapshot,
        currentQuestion: answer.question.question,
        answer: answer.answer,
        createdAt: answer.createdAt,
      })),
      documents: this.serializeCandidateDocuments(candidate),
    };
  }

  private serializeCandidateDocuments(candidate: {
    id: string;
    tenantId: string;
    vacancyId: string;
    resumeUrl: string | null;
    resumeFileName: string | null;
    coverLetterUrl: string | null;
    coverLetterFileName: string | null;
    portfolioUrl: string | null;
    githubUrl: string | null;
  }) {
    return {
      candidateId: candidate.id,
      tenantId: candidate.tenantId,
      vacancyId: candidate.vacancyId,
      resume: candidate.resumeUrl
        ? {
            url: candidate.resumeUrl,
            fileName: candidate.resumeFileName,
          }
        : null,
      coverLetter: candidate.coverLetterUrl
        ? {
            url: candidate.coverLetterUrl,
            fileName: candidate.coverLetterFileName,
          }
        : null,
      portfolioUrl: candidate.portfolioUrl,
      githubUrl: candidate.githubUrl,
    };
  }

  private assertPublishable(input: {
    title?: string | null;
    location?: string | null;
    jobType?: unknown;
    description?: string | null;
  }) {
    if (
      !input.title?.trim() ||
      !input.location?.trim() ||
      !input.jobType ||
      !input.description?.trim()
    ) {
      throw new BadRequestException(
        'Open vacancies require title, location, jobType and description',
      );
    }
  }

  private validateSalaryRange(min?: number | null, max?: number | null) {
    if (
      min !== undefined &&
      max !== undefined &&
      min !== null &&
      max !== null
    ) {
      if (max < min) {
        throw new BadRequestException(
          'salaryMax cannot be lower than salaryMin',
        );
      }
    }
  }

  private page(page?: number) {
    return Math.max(page ?? DEFAULT_PAGE, 1);
  }

  private limit(limit?: number) {
    return Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  }

  private normalizeName(value: string) {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private optionalTrim(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private toDecimal(value?: number | null) {
    return value === undefined || value === null
      ? undefined
      : new Prisma.Decimal(value);
  }

  private decimalToNumber(value?: Prisma.Decimal | null) {
    return value instanceof Prisma.Decimal ? value.toNumber() : value;
  }

  private requirePublicTenantId(value?: string) {
    const tenantId = value?.trim();
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    return tenantId;
  }
}
