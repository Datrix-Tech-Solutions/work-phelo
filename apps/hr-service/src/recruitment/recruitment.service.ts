import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { RequestUser } from '@work-phelo/types';
import {
  Prisma,
  RecruitmentApplicationStatus,
  RecruitmentInterviewMode,
  RecruitmentInterviewStatus,
  RecruitmentQuestionType,
  RecruitmentSalaryType,
  RecruitmentVacancyStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeMatchScore } from './candidate-match';
import {
  CreateRecruitmentApplicationDto,
  QueryRecruitmentCandidatesDto,
  UpdateRecruitmentApplicationAnswersDto,
  UpdateRecruitmentApplicationBasicInfoDto,
  UpdateRecruitmentApplicationProfessionalInfoDto,
} from './dto/candidate.dto';
import {
  CreateRecruitmentInterviewDto,
  UpdateRecruitmentInterviewDto,
} from './dto/interview.dto';
import {
  CreateRecruitmentStageDto,
  UpdateRecruitmentStageDto,
} from './dto/stage.dto';
import {
  CreateRecruitmentVacancyDto,
  QueryPublicRecruitmentBoardDto,
  QueryPublicRecruitmentVacanciesDto,
  QueryRecruitmentVacanciesDto,
  RecruitmentVacancyQuestionDto,
  SetRecruitmentCutoffDto,
  UpdateRecruitmentVacancyDto,
} from './dto/vacancy.dto';
import {
  DEFAULT_RECRUITMENT_QUESTION_TYPE,
  questionBehaviour,
} from './question-types';
import { renderRequirementsText, VacancyDetails } from './vacancy-requirements';

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

const RECRUITMENT_INTERVIEW_INCLUDE = {
  createdByEmployee: {
    select: { id: true, firstName: true, lastName: true },
  },
} satisfies Prisma.RecruitmentInterviewInclude;

const RECRUITMENT_PUBLIC_APPLICATION_INCLUDE = {
  vacancy: {
    include: {
      department: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      questions: {
        where: { retiredAt: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  },
  currentStage: true,
  answers: {
    include: { question: true },
    orderBy: { createdAt: 'asc' },
  },
  _count: { select: { stageHistory: true } },
} satisfies Prisma.RecruitmentApplicationInclude;

const RECRUITMENT_VACANCY_INCLUDE = {
  department: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  questions: {
    where: { retiredAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  },
  _count: {
    select: {
      applications: {
        where: { status: RecruitmentApplicationStatus.SUBMITTED },
      },
    },
  },
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
    const salary = this.resolveSalary(null, dto);
    const details = this.normalizeDetails(dto.details);
    const closingDate = this.parseClosingDate(dto.closingDate);
    await this.assertDepartmentAndBranch(
      tenantId,
      dto.departmentId,
      dto.branchId,
    );
    if (dto.status === RecruitmentVacancyStatus.OPEN) {
      this.assertPublishable(dto);
    }

    const vacancy = await this.prisma.$transaction(async (tx) => {
      const created = await tx.recruitmentVacancy.create({
        data: {
          tenantId,
          companyName: this.optionalTrim(user.tenantName),
          title: this.optionalTrim(dto.title),
          departmentId: dto.departmentId ?? undefined,
          branchId: dto.branchId ?? undefined,
          location: this.optionalTrim(dto.location),
          city: this.optionalTrim(dto.city),
          jobType: dto.jobType,
          workMode: dto.workMode,
          vacancies: dto.vacancies,
          closingDate: closingDate ?? undefined,
          description: this.optionalTrim(dto.description),
          responsibilities: this.optionalTrim(dto.responsibilities),
          perksAndBenefits: this.optionalTrim(dto.perksAndBenefits),
          requirements: this.resolveRequirements(dto.requirements, details),
          details: (details ?? undefined) as Prisma.InputJsonValue | undefined,
          salaryType: salary.salaryType,
          salaryAmount: this.toDecimal(salary.salaryAmount),
          salaryMin: this.toDecimal(salary.salaryMin),
          salaryMax: this.toDecimal(salary.salaryMax),
          salaryCurrency: salary.salaryCurrency ?? undefined,
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
      ...(await this.acceptingApplicationsWhere()),
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
      items: await this.serializePublicVacancies(items),
      meta: { page, limit, total },
    };
  }

  /** Open vacancies across every company, for the public job board. */
  async listPublicBoard(query: QueryPublicRecruitmentBoardDto) {
    const page = this.page(query.page);
    const limit = this.limit(query.limit);
    const search = query.search?.trim();
    const where: Prisma.RecruitmentVacancyWhereInput = {
      AND: [
        await this.acceptingApplicationsWhere(),
        ...(search
          ? [
              {
                OR: [
                  { title: { contains: search, mode: 'insensitive' as const } },
                  {
                    location: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                  { city: { contains: search, mode: 'insensitive' as const } },
                  {
                    companyName: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
      ...(query.jobType ? { jobType: query.jobType } : {}),
      ...(query.workMode ? { workMode: query.workMode } : {}),
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
      items: await this.serializePublicVacancies(items),
      meta: { page, limit, total },
    };
  }

  async getPublicVacancy(tenantId: string, vacancyId: string) {
    const publicTenantId = this.requirePublicTenantId(tenantId);
    const vacancy = await this.prisma.recruitmentVacancy.findFirst({
      where: {
        tenantId: publicTenantId,
        id: vacancyId,
        ...(await this.acceptingApplicationsWhere()),
      },
      include: RECRUITMENT_VACANCY_INCLUDE,
    });
    if (!vacancy) throw new NotFoundException('Recruitment vacancy not found');
    const [serialized] = await this.serializePublicVacancies([vacancy]);
    return serialized;
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

    const salaryTouched =
      dto.salaryType !== undefined ||
      dto.salaryAmount !== undefined ||
      dto.salaryMin !== undefined ||
      dto.salaryMax !== undefined ||
      dto.salaryCurrency !== undefined;
    const salary = salaryTouched ? this.resolveSalary(existing, dto) : null;
    const details =
      dto.details === undefined
        ? undefined
        : this.normalizeDetails(dto.details);
    const closingDate =
      dto.closingDate === undefined
        ? undefined
        : this.parseClosingDate(dto.closingDate);
    await this.assertDepartmentAndBranch(
      tenantId,
      dto.departmentId,
      dto.branchId,
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
          ...(user.tenantName?.trim()
            ? { companyName: user.tenantName.trim() }
            : {}),
          ...(dto.title !== undefined
            ? { title: this.optionalTrim(dto.title) ?? null }
            : {}),
          ...(dto.location !== undefined
            ? { location: this.optionalTrim(dto.location) ?? null }
            : {}),
          ...(dto.jobType !== undefined ? { jobType: dto.jobType } : {}),
          ...(dto.description !== undefined
            ? { description: this.optionalTrim(dto.description) ?? null }
            : {}),
          ...(dto.responsibilities !== undefined
            ? {
                responsibilities:
                  this.optionalTrim(dto.responsibilities) ?? null,
              }
            : {}),
          ...(dto.perksAndBenefits !== undefined
            ? {
                perksAndBenefits:
                  this.optionalTrim(dto.perksAndBenefits) ?? null,
              }
            : {}),
          ...(dto.city !== undefined
            ? { city: this.optionalTrim(dto.city) ?? null }
            : {}),
          ...(dto.departmentId !== undefined
            ? { departmentId: dto.departmentId }
            : {}),
          ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
          ...(dto.workMode !== undefined ? { workMode: dto.workMode } : {}),
          ...(dto.vacancies !== undefined ? { vacancies: dto.vacancies } : {}),
          ...(closingDate !== undefined ? { closingDate } : {}),
          ...(details !== undefined
            ? {
                details: (details ?? Prisma.JsonNull) as
                  | Prisma.InputJsonValue
                  | typeof Prisma.JsonNull,
              }
            : {}),
          ...(dto.requirements !== undefined
            ? { requirements: this.optionalTrim(dto.requirements) ?? null }
            : details
              ? {
                  requirements:
                    this.resolveRequirements(undefined, details) ?? null,
                }
              : {}),
          ...(salary
            ? {
                salaryType: salary.salaryType,
                salaryAmount: this.toDecimal(salary.salaryAmount) ?? null,
                salaryMin: this.toDecimal(salary.salaryMin) ?? null,
                salaryMax: this.toDecimal(salary.salaryMax) ?? null,
                salaryCurrency: salary.salaryCurrency,
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

  /** Puts a closed vacancy back on the board. Applications and stage history are untouched. */
  async reopenVacancy(tenantId: string, user: RequestUser, vacancyId: string) {
    const existing = await this.prisma.recruitmentVacancy.findFirst({
      where: { tenantId, id: vacancyId },
    });
    if (!existing) throw new NotFoundException('Recruitment vacancy not found');
    if (existing.status !== RecruitmentVacancyStatus.CLOSED) {
      throw new ConflictException('Only closed vacancies can be reopened');
    }
    this.assertPublishable(existing);
    if (existing.closingDate && existing.closingDate < this.startOfTodayUtc()) {
      throw new BadRequestException(
        'The closing date has passed. Update the closing date before reopening',
      );
    }

    const vacancy = await this.prisma.recruitmentVacancy.update({
      where: { id: vacancyId },
      data: {
        status: RecruitmentVacancyStatus.OPEN,
        closedAt: null,
        closedByUserId: null,
        updatedByUserId: user.id,
      },
      include: RECRUITMENT_VACANCY_INCLUDE,
    });
    return this.serializeVacancy(vacancy);
  }

  /**
   * Sets or clears the vacancy's match-score cut-off and applies it to the applicants already
   * waiting in the entry stage: those below it move to Rejected, and applicants the cut-off
   * itself rejected earlier come back when they now clear it. Nobody a person has moved is
   * touched. With `dryRun` it only reports the counts.
   */
  async setVacancyCutoff(
    tenantId: string,
    user: RequestUser,
    vacancyId: string,
    dto: SetRecruitmentCutoffDto,
  ) {
    const vacancy = await this.prisma.recruitmentVacancy.findFirst({
      where: { tenantId, id: vacancyId },
      select: { id: true, details: true },
    });
    if (!vacancy) throw new NotFoundException('Recruitment vacancy not found');

    const cutoff = dto.cutoffScore;
    if (cutoff !== null) {
      const scoreable = computeMatchScore(
        { skills: [], languages: [], yearsOfExperience: null },
        vacancy.details,
      );
      if (scoreable === null) {
        throw new BadRequestException(
          'Add skills, minimum experience or languages to this opening before setting a cut-off',
        );
      }
    }

    const [defaultStage, rejectedStage] = await Promise.all([
      this.getDefaultStage(tenantId),
      this.findRejectedStage(tenantId),
    ]);
    if (!rejectedStage) {
      throw new ConflictException(
        'A "Rejected" recruitment stage is required to use a cut-off',
      );
    }

    const actorEmployee = await this.prisma.employee.findFirst({
      where: { tenantId, userId: user.id },
      select: { id: true },
    });

    const applicants = await this.prisma.recruitmentApplication.findMany({
      where: {
        tenantId,
        vacancyId,
        status: RecruitmentApplicationStatus.SUBMITTED,
        OR: [
          { currentStageId: defaultStage.id, autoRejectedAt: null },
          { currentStageId: rejectedStage.id, autoRejectedAt: { not: null } },
        ],
      },
      select: {
        id: true,
        currentStageId: true,
        autoRejectedAt: true,
        skills: true,
        languages: true,
        yearsOfExperience: true,
      },
    });

    const toReject: Array<{ id: string; score: number }> = [];
    const toRestore: Array<{ id: string; score: number | null }> = [];
    for (const applicant of applicants) {
      const score = computeMatchScore(applicant, vacancy.details);
      if (applicant.autoRejectedAt) {
        if (cutoff === null || score === null || score >= cutoff) {
          toRestore.push({ id: applicant.id, score });
        }
      } else if (cutoff !== null && score !== null && score < cutoff) {
        toReject.push({ id: applicant.id, score });
      }
    }

    if (dto.dryRun) {
      return {
        cutoffScore: cutoff,
        rejected: toReject.length,
        restored: toRestore.length,
        applied: false,
      };
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.recruitmentVacancy.update({
        where: { id: vacancyId },
        data: { cutoffScore: cutoff, updatedByUserId: user.id },
      });

      for (const { id, score } of toReject) {
        await tx.recruitmentApplication.update({
          where: { id },
          data: {
            currentStageId: rejectedStage.id,
            autoRejectedAt: now,
            autoRejectedScore: score,
          },
        });
        await tx.recruitmentStageHistory.create({
          data: {
            tenantId,
            applicationId: id,
            previousStageId: defaultStage.id,
            newStageId: rejectedStage.id,
            changedByUserId: user.id,
            changedByEmployeeId: actorEmployee?.id,
            note: `Auto-rejected: ${score}% match, cut-off ${cutoff}%`,
          },
        });
      }

      for (const { id, score } of toRestore) {
        await tx.recruitmentApplication.update({
          where: { id },
          data: {
            currentStageId: defaultStage.id,
            autoRejectedAt: null,
            autoRejectedScore: null,
          },
        });
        await tx.recruitmentStageHistory.create({
          data: {
            tenantId,
            applicationId: id,
            previousStageId: rejectedStage.id,
            newStageId: defaultStage.id,
            changedByUserId: user.id,
            changedByEmployeeId: actorEmployee?.id,
            note:
              cutoff === null
                ? 'Cut-off cleared'
                : `Back above cut-off: ${score}% match, cut-off ${cutoff}%`,
          },
        });
      }
    });

    return {
      cutoffScore: cutoff,
      rejected: toReject.length,
      restored: toRestore.length,
      applied: true,
    };
  }

  private findRejectedStage(tenantId: string) {
    return this.prisma.recruitmentStage.findFirst({
      where: { tenantId, normalizedName: this.normalizeName('Rejected') },
    });
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
      where: {
        tenantId,
        id: candidateId,
        status: RecruitmentApplicationStatus.SUBMITTED,
      },
      include: RECRUITMENT_CANDIDATE_INCLUDE,
    });
    if (!candidate)
      throw new NotFoundException('Recruitment candidate not found');
    return this.serializeCandidate(candidate);
  }

  async getCandidateDocuments(tenantId: string, candidateId: string) {
    const candidate = await this.prisma.recruitmentApplication.findFirst({
      where: {
        tenantId,
        id: candidateId,
        status: RecruitmentApplicationStatus.SUBMITTED,
      },
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
      where: {
        tenantId,
        id: candidateId,
        status: RecruitmentApplicationStatus.SUBMITTED,
      },
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
        data: {
          currentStageId: stageId,
          autoRejectedAt: null,
          autoRejectedScore: null,
        },
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

  async listCandidateInterviews(tenantId: string, candidateId: string) {
    await this.getCandidateForInterviews(tenantId, candidateId);
    const interviews = await this.prisma.recruitmentInterview.findMany({
      where: { tenantId, applicationId: candidateId },
      include: RECRUITMENT_INTERVIEW_INCLUDE,
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    });
    return interviews.map((interview) => this.serializeInterview(interview));
  }

  async scheduleCandidateInterview(
    tenantId: string,
    user: RequestUser,
    candidateId: string,
    dto: CreateRecruitmentInterviewDto,
  ) {
    const candidate = await this.getCandidateForInterviews(
      tenantId,
      candidateId,
    );
    const scheduledAt = this.parseInterviewTime(dto.scheduledAt);
    const channel = this.resolveInterviewChannel({
      mode: dto.mode,
      platform: dto.platform,
      meetingLink: dto.meetingLink,
      phone: dto.phone,
      location: dto.location,
    });
    const interviewStage = await this.stageForNewInterview(
      tenantId,
      candidate.currentStage,
    );

    const actorEmployee = await this.prisma.employee.findFirst({
      where: { tenantId, userId: user.id },
      select: { id: true },
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const interview = await tx.recruitmentInterview.create({
        data: {
          tenantId,
          applicationId: candidateId,
          mode: dto.mode,
          scheduledAt,
          durationMinutes: dto.durationMinutes,
          ...channel,
          notes: this.optionalTrim(dto.notes) ?? null,
          createdByUserId: user.id,
          createdByEmployeeId: actorEmployee?.id,
        },
        include: RECRUITMENT_INTERVIEW_INCLUDE,
      });
      if (interviewStage) {
        await tx.recruitmentApplication.update({
          where: { id: candidateId },
          data: {
            currentStageId: interviewStage.id,
            autoRejectedAt: null,
            autoRejectedScore: null,
          },
        });
        await tx.recruitmentStageHistory.create({
          data: {
            tenantId,
            applicationId: candidateId,
            previousStageId: candidate.currentStageId,
            newStageId: interviewStage.id,
            changedByUserId: user.id,
            changedByEmployeeId: actorEmployee?.id,
            note: 'Moved automatically: interview scheduled',
          },
        });
      }
      return interview;
    });
    return this.serializeInterview(created);
  }

  async updateCandidateInterview(
    tenantId: string,
    user: RequestUser,
    candidateId: string,
    interviewId: string,
    dto: UpdateRecruitmentInterviewDto,
  ) {
    const candidate = await this.getCandidateForInterviews(
      tenantId,
      candidateId,
    );
    const existing = await this.prisma.recruitmentInterview.findFirst({
      where: { tenantId, applicationId: candidateId, id: interviewId },
    });
    if (!existing) throw new NotFoundException('Interview not found');

    const data: Prisma.RecruitmentInterviewUpdateInput = {};
    const isScheduled =
      existing.status === RecruitmentInterviewStatus.SCHEDULED;

    if (dto.status === RecruitmentInterviewStatus.SCHEDULED && !isScheduled) {
      throw new ConflictException(
        'A completed or cancelled interview cannot be scheduled again',
      );
    }

    const changesDetails =
      dto.mode !== undefined ||
      dto.scheduledAt !== undefined ||
      dto.durationMinutes !== undefined ||
      dto.platform !== undefined ||
      dto.meetingLink !== undefined ||
      dto.phone !== undefined ||
      dto.location !== undefined ||
      dto.notes !== undefined;

    if (!isScheduled) {
      // Finished interviews keep their schedule; only the feedback can still be written.
      if (changesDetails || dto.status !== undefined) {
        throw new ConflictException('Only scheduled interviews can be changed');
      }
      if (existing.status !== RecruitmentInterviewStatus.COMPLETED) {
        throw new ConflictException(
          'Feedback can only be added to a completed interview',
        );
      }
    }

    if (changesDetails) {
      const mode = dto.mode ?? existing.mode;
      const modeChanged = dto.mode !== undefined && dto.mode !== existing.mode;
      // Values for the new mode must be sent when the mode changes; otherwise unsent fields keep
      // what is stored.
      const channel = this.resolveInterviewChannel({
        mode,
        platform: this.pickChannelValue(
          dto.platform,
          existing.platform,
          modeChanged,
        ),
        meetingLink: this.pickChannelValue(
          dto.meetingLink,
          existing.meetingLink,
          modeChanged,
        ),
        phone: this.pickChannelValue(dto.phone, existing.phone, modeChanged),
        location: this.pickChannelValue(
          dto.location,
          existing.location,
          modeChanged,
        ),
      });
      data.mode = mode;
      data.platform = channel.platform;
      data.meetingLink = channel.meetingLink;
      data.phone = channel.phone;
      data.location = channel.location;
    }
    if (dto.scheduledAt !== undefined) {
      data.scheduledAt = this.parseInterviewTime(dto.scheduledAt);
    }
    if (dto.durationMinutes !== undefined) {
      data.durationMinutes = dto.durationMinutes;
    }
    if (dto.notes !== undefined) {
      data.notes = this.optionalTrim(dto.notes) ?? null;
    }
    if (dto.feedback !== undefined) {
      data.feedback = this.optionalTrim(dto.feedback) ?? null;
    }
    if (dto.status !== undefined && dto.status !== existing.status) {
      data.status = dto.status;
    }

    const finishing = data.status as RecruitmentInterviewStatus | undefined;
    if (
      dto.stageId !== undefined &&
      finishing !== RecruitmentInterviewStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'A stage can only be chosen when completing an interview',
      );
    }
    const completionStage =
      dto.stageId !== undefined
        ? await this.requireCompletionStage(tenantId, dto.stageId)
        : null;

    const actorEmployee = await this.prisma.employee.findFirst({
      where: { tenantId, userId: user.id },
      select: { id: true },
    });
    const moveTo = async (
      tx: Prisma.TransactionClient,
      stageId: string,
      note: string,
    ) => {
      await tx.recruitmentApplication.update({
        where: { id: candidateId },
        data: {
          currentStageId: stageId,
          autoRejectedAt: null,
          autoRejectedScore: null,
        },
      });
      await tx.recruitmentStageHistory.create({
        data: {
          tenantId,
          applicationId: candidateId,
          previousStageId: candidate.currentStageId,
          newStageId: stageId,
          changedByUserId: user.id,
          changedByEmployeeId: actorEmployee?.id,
          note,
        },
      });
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const interview = await tx.recruitmentInterview.update({
        where: { id: interviewId },
        data,
        include: RECRUITMENT_INTERVIEW_INCLUDE,
      });

      if (completionStage && completionStage.id !== candidate.currentStageId) {
        await moveTo(
          tx,
          completionStage.id,
          `Moved to ${completionStage.name}: interview completed`,
        );
      } else if (finishing === RecruitmentInterviewStatus.CANCELLED) {
        // Cancelling sends the candidate back to Screening, unless they have moved on from
        // Interview or another interview is still booked.
        const inInterview =
          candidate.currentStage?.normalizedName ===
          this.normalizeName('Interview');
        if (inInterview) {
          const stillBooked = await tx.recruitmentInterview.count({
            where: {
              tenantId,
              applicationId: candidateId,
              status: RecruitmentInterviewStatus.SCHEDULED,
              id: { not: interviewId },
            },
          });
          const screening = await tx.recruitmentStage.findFirst({
            where: {
              tenantId,
              normalizedName: this.normalizeName('Screening'),
            },
          });
          if (stillBooked === 0 && screening) {
            await moveTo(
              tx,
              screening.id,
              'Moved to Screening: interview cancelled',
            );
          }
        }
      }
      return interview;
    });
    return this.serializeInterview(updated);
  }

  /** The stages a completed interview can move a candidate to: anything after Screening. */
  private async requireCompletionStage(tenantId: string, stageId: string) {
    const stage = await this.prisma.recruitmentStage.findFirst({
      where: { tenantId, id: stageId },
    });
    if (!stage) throw new NotFoundException('Recruitment stage not found');
    if (
      stage.isDefault ||
      stage.normalizedName === this.normalizeName('Screening')
    ) {
      throw new BadRequestException(
        'A completed interview cannot move a candidate back to Applied or Screening',
      );
    }
    return stage;
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
        ...(await this.acceptingApplicationsWhere()),
      },
      include: {
        questions: {
          where: { retiredAt: null },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!vacancy) throw new NotFoundException('Recruitment vacancy not found');

    this.assertApplicationComplete(dto, vacancy.questions, vacancy.details);
    await this.assertNoSubmittedDuplicate(
      tenantId,
      vacancyId,
      dto.email?.trim().toLowerCase(),
    );
    const initialStage = await this.getDefaultStage(tenantId);
    const actorEmployee = user
      ? await this.prisma.employee.findFirst({
          where: { tenantId, userId: user.id },
          select: { id: true },
        })
      : null;
    const answers = this.validateApplicationAnswers(
      vacancy.questions,
      dto.answers ?? [],
      true,
    );
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const application = await tx.recruitmentApplication.create({
        data: {
          tenantId,
          vacancyId,
          status: RecruitmentApplicationStatus.SUBMITTED,
          currentStageId: initialStage.id,
          submittedAt: now,
          appliedAt: now,
          firstName: dto.firstName?.trim(),
          lastName: dto.lastName?.trim(),
          email: dto.email?.trim().toLowerCase(),
          phone: this.optionalTrim(dto.phone),
          country: this.optionalTrim(dto.country),
          city: this.optionalTrim(dto.city),
          professionalSummary: this.optionalTrim(dto.professionalSummary),
          skills:
            dto.skills?.map((skill) => skill.trim()).filter(Boolean) ?? [],
          education: this.optionalTrim(dto.education),
          yearsOfExperience: dto.yearsOfExperience,
          currentJobTitle: this.optionalTrim(dto.currentJobTitle),
          currentEmployer: this.optionalTrim(dto.currentEmployer),
          highestEducationLevel: this.optionalTrim(dto.highestEducationLevel),
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
          languages: this.cleanList(dto.languages ?? []),
          certificates: this.cleanList(dto.certificates ?? []),
          ...this.professionalInfoData({
            educationHistory: dto.educationHistory,
            workHistory: dto.workHistory,
          }),
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
            answerText: answer.answerText,
            selectedOptions: answer.selectedOptions,
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
    const publicTenantId = this.requirePublicTenantId(tenantId);
    const vacancy = await this.prisma.recruitmentVacancy.findFirst({
      where: {
        tenantId: publicTenantId,
        id: vacancyId,
        ...(await this.acceptingApplicationsWhere()),
      },
      include: {
        questions: {
          where: { retiredAt: null },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!vacancy) throw new NotFoundException('Recruitment vacancy not found');

    const accessToken = this.createAccessToken();
    const answers = this.validateApplicationAnswers(
      vacancy.questions,
      dto.answers ?? [],
      false,
    );
    const application = await this.prisma.$transaction(async (tx) => {
      const draft = await tx.recruitmentApplication.create({
        data: {
          tenantId: publicTenantId,
          vacancyId,
          status: RecruitmentApplicationStatus.DRAFT,
          accessTokenHash: this.hashAccessToken(accessToken),
          ...this.basicInfoData(dto),
          ...this.professionalInfoData(dto),
        },
      });
      await this.replaceApplicationAnswers(
        tx,
        publicTenantId,
        draft.id,
        answers,
      );
      return tx.recruitmentApplication.findFirstOrThrow({
        where: { tenantId: publicTenantId, id: draft.id },
        include: RECRUITMENT_PUBLIC_APPLICATION_INCLUDE,
      });
    });

    return {
      application: this.serializePublicApplication(application),
      accessToken,
    };
  }

  async getPublicApplication(applicationId: string, accessToken?: string) {
    const application = await this.getDraftApplicationByToken(
      applicationId,
      accessToken,
    );
    return this.serializePublicApplication(application);
  }

  async updatePublicApplicationBasicInfo(
    applicationId: string,
    accessToken: string | undefined,
    dto: UpdateRecruitmentApplicationBasicInfoDto,
  ) {
    const draft = await this.getDraftApplicationByToken(
      applicationId,
      accessToken,
    );
    const updated = await this.prisma.recruitmentApplication.update({
      where: { id: draft.id },
      data: this.basicInfoData(dto),
      include: RECRUITMENT_PUBLIC_APPLICATION_INCLUDE,
    });
    return this.serializePublicApplication(updated);
  }

  async updatePublicApplicationProfessionalInfo(
    applicationId: string,
    accessToken: string | undefined,
    dto: UpdateRecruitmentApplicationProfessionalInfoDto,
  ) {
    const draft = await this.getDraftApplicationByToken(
      applicationId,
      accessToken,
    );
    const updated = await this.prisma.recruitmentApplication.update({
      where: { id: draft.id },
      data: this.professionalInfoData(dto),
      include: RECRUITMENT_PUBLIC_APPLICATION_INCLUDE,
    });
    return this.serializePublicApplication(updated);
  }

  async updatePublicApplicationAnswers(
    applicationId: string,
    accessToken: string | undefined,
    dto: UpdateRecruitmentApplicationAnswersDto,
  ) {
    const draft = await this.getDraftApplicationByToken(
      applicationId,
      accessToken,
    );
    const answers = this.validateApplicationAnswers(
      draft.vacancy.questions,
      dto.answers,
      false,
    );
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.replaceApplicationAnswers(
        tx,
        draft.tenantId,
        draft.id,
        answers,
      );
      return tx.recruitmentApplication.findFirstOrThrow({
        where: { tenantId: draft.tenantId, id: draft.id },
        include: RECRUITMENT_PUBLIC_APPLICATION_INCLUDE,
      });
    });
    return this.serializePublicApplication(updated);
  }

  async reviewPublicApplication(applicationId: string, accessToken?: string) {
    const draft = await this.getDraftApplicationByToken(
      applicationId,
      accessToken,
    );
    const missing = this.applicationMissingFields(
      draft,
      draft.vacancy.questions,
      draft.vacancy.details,
    );
    return {
      application: this.serializePublicApplication(draft),
      canSubmit: missing.length === 0,
      missing,
    };
  }

  async submitPublicApplication(applicationId: string, accessToken?: string) {
    const draft = await this.getDraftApplicationByToken(
      applicationId,
      accessToken,
    );
    const missing = this.applicationMissingFields(
      draft,
      draft.vacancy.questions,
      draft.vacancy.details,
    );
    if (missing.length > 0) {
      throw new BadRequestException({
        message: 'Recruitment application is incomplete',
        missing,
      });
    }
    await this.assertNoSubmittedDuplicate(
      draft.tenantId,
      draft.vacancyId,
      draft.email?.trim().toLowerCase(),
      draft.id,
    );
    const defaultStage = await this.getDefaultStage(draft.tenantId);
    const now = new Date();

    // A vacancy cut-off sends applicants who score below it straight to Rejected. If the tenant
    // has no Rejected stage the applicant is kept in the default stage rather than refused.
    const score = computeMatchScore(draft, draft.vacancy.details);
    const cutoff = draft.vacancy.cutoffScore;
    const rejectedStage =
      cutoff !== null && score !== null && score < cutoff
        ? await this.findRejectedStage(draft.tenantId)
        : null;
    const initialStage = rejectedStage ?? defaultStage;

    return this.prisma.$transaction(async (tx) => {
      await tx.recruitmentApplication.update({
        where: { id: draft.id },
        data: {
          status: RecruitmentApplicationStatus.SUBMITTED,
          currentStageId: initialStage.id,
          submittedAt: now,
          appliedAt: now,
          accessTokenHash: null,
          ...(rejectedStage
            ? { autoRejectedAt: now, autoRejectedScore: score }
            : {}),
        },
      });
      await tx.recruitmentStageHistory.create({
        data: {
          tenantId: draft.tenantId,
          applicationId: draft.id,
          previousStageId: null,
          newStageId: initialStage.id,
          changedByUserId: null,
          changedByEmployeeId: null,
          note: rejectedStage
            ? `Auto-rejected: ${score}% match, cut-off ${cutoff}%`
            : 'Initial application stage',
        },
      });

      const submitted = await tx.recruitmentApplication.findFirstOrThrow({
        where: {
          tenantId: draft.tenantId,
          id: draft.id,
          status: RecruitmentApplicationStatus.SUBMITTED,
        },
        include: RECRUITMENT_CANDIDATE_INCLUDE,
      });
      return this.serializeCandidate(submitted);
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
      const type = question.type ?? DEFAULT_RECRUITMENT_QUESTION_TYPE;
      const options = this.normalizeQuestionOptions(type, question.options);
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
            type,
            options,
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
          type,
          options,
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

  private async getDraftApplicationByToken(
    applicationId: string,
    accessToken?: string,
  ) {
    const tokenHash = accessToken
      ? this.hashAccessToken(accessToken)
      : undefined;
    if (!tokenHash) {
      throw new NotFoundException('Recruitment application not found');
    }

    const application = await this.prisma.recruitmentApplication.findFirst({
      where: {
        id: applicationId,
        accessTokenHash: tokenHash,
        status: RecruitmentApplicationStatus.DRAFT,
      },
      include: RECRUITMENT_PUBLIC_APPLICATION_INCLUDE,
    });
    if (!application) {
      throw new NotFoundException('Recruitment application not found');
    }
    if (
      application.vacancy.status !== RecruitmentVacancyStatus.OPEN ||
      this.isPastClosingDate(application.vacancy.closingDate)
    ) {
      throw new ConflictException('Recruitment vacancy is no longer open');
    }
    return application;
  }

  private basicInfoData(dto: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    country?: string;
    city?: string;
  }) {
    return {
      ...(dto.firstName !== undefined
        ? { firstName: this.optionalTrim(dto.firstName) }
        : {}),
      ...(dto.lastName !== undefined
        ? { lastName: this.optionalTrim(dto.lastName) }
        : {}),
      ...(dto.email !== undefined
        ? { email: this.optionalTrim(dto.email)?.toLowerCase() }
        : {}),
      ...(dto.phone !== undefined
        ? { phone: this.optionalTrim(dto.phone) }
        : {}),
      ...(dto.country !== undefined
        ? { country: this.optionalTrim(dto.country) }
        : {}),
      ...(dto.city !== undefined ? { city: this.optionalTrim(dto.city) } : {}),
    };
  }

  private professionalInfoData(dto: {
    professionalSummary?: string;
    skills?: string[];
    education?: string;
    yearsOfExperience?: number;
    currentJobTitle?: string;
    currentEmployer?: string;
    highestEducationLevel?: string;
    expectedSalary?: number;
    expectedSalaryCurrency?: string;
    noticePeriod?: string;
    resumeUrl?: string;
    resumeFileName?: string;
    coverLetterUrl?: string;
    coverLetterFileName?: string;
    portfolioUrl?: string;
    githubUrl?: string;
    languages?: string[];
    certificates?: string[];
    educationHistory?: Array<{
      level: string;
      qualification?: string;
      institution?: string;
    }>;
    workHistory?: Array<{
      role: string;
      company?: string;
      start?: string;
      end?: string;
    }>;
  }) {
    return {
      ...(dto.languages !== undefined
        ? { languages: this.cleanList(dto.languages) }
        : {}),
      ...(dto.certificates !== undefined
        ? { certificates: this.cleanList(dto.certificates) }
        : {}),
      ...(dto.educationHistory !== undefined
        ? {
            educationHistory: dto.educationHistory.map((entry) => ({
              level: entry.level,
              qualification: entry.qualification?.trim() ?? '',
              institution: entry.institution?.trim() ?? '',
            })) as Prisma.InputJsonValue,
          }
        : {}),
      ...(dto.workHistory !== undefined
        ? {
            workHistory: dto.workHistory
              .filter((entry) => entry.role.trim())
              .map((entry) => ({
                role: entry.role.trim(),
                company: entry.company?.trim() ?? '',
                start: entry.start ?? '',
                end: entry.end ?? '',
              })) as Prisma.InputJsonValue,
          }
        : {}),
      ...(dto.professionalSummary !== undefined
        ? { professionalSummary: this.optionalTrim(dto.professionalSummary) }
        : {}),
      ...(dto.skills !== undefined
        ? {
            skills: dto.skills.map((skill) => skill.trim()).filter(Boolean),
          }
        : {}),
      ...(dto.education !== undefined
        ? { education: this.optionalTrim(dto.education) }
        : {}),
      ...(dto.yearsOfExperience !== undefined
        ? { yearsOfExperience: dto.yearsOfExperience }
        : {}),
      ...(dto.currentJobTitle !== undefined
        ? { currentJobTitle: this.optionalTrim(dto.currentJobTitle) }
        : {}),
      ...(dto.currentEmployer !== undefined
        ? { currentEmployer: this.optionalTrim(dto.currentEmployer) }
        : {}),
      ...(dto.highestEducationLevel !== undefined
        ? {
            highestEducationLevel: this.optionalTrim(dto.highestEducationLevel),
          }
        : {}),
      ...(dto.expectedSalary !== undefined
        ? { expectedSalary: this.toDecimal(dto.expectedSalary) }
        : {}),
      ...(dto.expectedSalaryCurrency !== undefined
        ? {
            expectedSalaryCurrency: this.optionalTrim(
              dto.expectedSalaryCurrency,
            )?.toUpperCase(),
          }
        : {}),
      ...(dto.noticePeriod !== undefined
        ? { noticePeriod: this.optionalTrim(dto.noticePeriod) }
        : {}),
      ...(dto.resumeUrl !== undefined
        ? { resumeUrl: this.optionalTrim(dto.resumeUrl) }
        : {}),
      ...(dto.resumeFileName !== undefined
        ? { resumeFileName: this.optionalTrim(dto.resumeFileName) }
        : {}),
      ...(dto.coverLetterUrl !== undefined
        ? { coverLetterUrl: this.optionalTrim(dto.coverLetterUrl) }
        : {}),
      ...(dto.coverLetterFileName !== undefined
        ? { coverLetterFileName: this.optionalTrim(dto.coverLetterFileName) }
        : {}),
      ...(dto.portfolioUrl !== undefined
        ? { portfolioUrl: this.optionalTrim(dto.portfolioUrl) }
        : {}),
      ...(dto.githubUrl !== undefined
        ? { githubUrl: this.optionalTrim(dto.githubUrl) }
        : {}),
    };
  }

  private async replaceApplicationAnswers(
    tx: Prisma.TransactionClient,
    tenantId: string,
    applicationId: string,
    answers: Array<{
      questionId: string;
      questionSnapshot: string;
      answer: string;
      answerText: string | null;
      selectedOptions: string[];
    }>,
  ) {
    await tx.recruitmentApplicationAnswer.deleteMany({
      where: { tenantId, applicationId },
    });
    if (answers.length === 0) return;

    await tx.recruitmentApplicationAnswer.createMany({
      data: answers.map((answer) => ({
        tenantId,
        applicationId,
        questionId: answer.questionId,
        questionSnapshot: answer.questionSnapshot,
        answer: answer.answer,
        answerText: answer.answerText,
        selectedOptions: answer.selectedOptions,
      })),
    });
  }

  private validateApplicationAnswers(
    questions: Array<{
      id: string;
      question: string;
      type: RecruitmentQuestionType;
      options: Prisma.JsonValue | null;
      required: boolean;
    }>,
    answers: Array<{
      questionId: string;
      answer?: string;
      selectedOptions?: string[];
    }>,
    requireRequiredAnswers: boolean,
  ) {
    const activeQuestions = new Map(
      questions.map((question) => [question.id, question]),
    );
    const seen = new Set<string>();
    const normalizedAnswers: Array<{
      questionId: string;
      questionSnapshot: string;
      answer: string;
      answerText: string | null;
      selectedOptions: string[];
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
      const behaviour = questionBehaviour(question.type);
      const options =
        behaviour.kind === 'select' && behaviour.fixedOptions
          ? [...behaviour.fixedOptions]
          : this.readQuestionOptions(question.options);
      if (behaviour.kind === 'text') {
        const value = answer.answer?.trim();
        if (!value) {
          if (requireRequiredAnswers || question.required) {
            throw new BadRequestException(
              'Recruitment vacancy question answers cannot be empty',
            );
          }
          continue;
        }
        normalizedAnswers.push({
          questionId: answer.questionId,
          questionSnapshot: question.question,
          answer: value,
          answerText: value,
          selectedOptions: [],
        });
        continue;
      }

      const selectedOptions =
        answer.selectedOptions
          ?.map((option) => option.trim())
          .filter(Boolean) ?? [];
      if (selectedOptions.length === 0) {
        if (requireRequiredAnswers || question.required) {
          throw new BadRequestException(
            'Recruitment vacancy question selections cannot be empty',
          );
        }
        continue;
      }
      if (!behaviour.multiple && selectedOptions.length !== 1) {
        throw new BadRequestException(
          'This recruitment question accepts exactly one option',
        );
      }
      const invalidOption = selectedOptions.find(
        (option) => !options.includes(option),
      );
      if (invalidOption) {
        throw new BadRequestException(
          'Answer references an invalid recruitment vacancy question option',
        );
      }
      normalizedAnswers.push({
        questionId: answer.questionId,
        questionSnapshot: question.question,
        answer: selectedOptions.join(', '),
        answerText: null,
        selectedOptions,
      });
    }

    const answeredIds = new Set(
      normalizedAnswers.map((answer) => answer.questionId),
    );
    const missingRequired = questions.some(
      (question) => question.required && !answeredIds.has(question.id),
    );
    if (requireRequiredAnswers && missingRequired) {
      throw new BadRequestException(
        'Required recruitment vacancy questions must be answered',
      );
    }

    return normalizedAnswers;
  }

  private assertApplicationComplete(
    dto: CreateRecruitmentApplicationDto,
    questions: Array<{
      id: string;
      question: string;
      type: RecruitmentQuestionType;
      options: Prisma.JsonValue | null;
      required: boolean;
    }>,
    vacancyDetails: Prisma.JsonValue | null,
  ) {
    const missing = this.applicationMissingFields(
      {
        ...dto,
        answers: (dto.answers ?? []).map((answer) => ({
          questionId: answer.questionId,
          answer: answer.answer ?? '',
          answerText: answer.answer ?? null,
          selectedOptions: answer.selectedOptions ?? [],
        })),
      },
      questions,
      vacancyDetails,
    );
    if (missing.length > 0) {
      throw new BadRequestException({
        message: 'Recruitment application is incomplete',
        missing,
      });
    }
  }

  /** Which requirements the vacancy setup marked as required. A missing key is not required. */
  private requiredRequirements(details: Prisma.JsonValue | null) {
    const read = (key: string) => {
      const value =
        details && typeof details === 'object' && !Array.isArray(details)
          ? (details as Record<string, unknown>)[key]
          : undefined;
      return (
        !!value &&
        typeof value === 'object' &&
        (value as { required?: unknown }).required === true
      );
    };
    return {
      education: read('education'),
      experience: read('experience'),
      skills: read('skills'),
      languages: read('languages'),
      certificates: read('certificates'),
    };
  }

  private applicationMissingFields(
    application: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      phone?: string | null;
      country?: string | null;
      city?: string | null;
      yearsOfExperience?: number | null;
      currentJobTitle?: string | null;
      highestEducationLevel?: string | null;
      skills?: string[];
      languages?: string[];
      certificates?: string[];
      noticePeriod?: string | null;
      answers?: Array<{
        questionId: string;
        answer?: string | null;
        answerText?: string | null;
        selectedOptions?: string[];
      }>;
    },
    questions: Array<{
      id: string;
      question: string;
      type: RecruitmentQuestionType;
      options: Prisma.JsonValue | null;
      required: boolean;
    }>,
    vacancyDetails: Prisma.JsonValue | null = null,
  ) {
    const missing: Array<{ field: string; label: string }> = [];
    // Contact details, current job and notice period are asked on every application. The
    // rest is only required when the vacancy setup marked that requirement as required.
    const required = this.requiredRequirements(vacancyDetails);
    const requiredTextFields: Array<
      [string, string, string | null | undefined, boolean]
    > = [
      ['firstName', 'First name', application.firstName, true],
      ['lastName', 'Last name', application.lastName, true],
      ['email', 'Email', application.email, true],
      ['phone', 'Phone', application.phone, true],
      ['country', 'Country', application.country, true],
      ['city', 'City', application.city, true],
      [
        'currentJobTitle',
        'Current job title',
        application.currentJobTitle,
        true,
      ],
      ['noticePeriod', 'Notice period', application.noticePeriod, true],
      [
        'highestEducationLevel',
        'Highest education level',
        application.highestEducationLevel,
        required.education,
      ],
    ];

    for (const [field, label, value, isRequired] of requiredTextFields) {
      if (isRequired && !value?.trim()) missing.push({ field, label });
    }
    if (
      required.experience &&
      (application.yearsOfExperience === undefined ||
        application.yearsOfExperience === null)
    ) {
      missing.push({
        field: 'yearsOfExperience',
        label: 'Years of experience',
      });
    }
    const lists: Array<[string, string, string[] | undefined, boolean]> = [
      ['skills', 'Skills', application.skills, required.skills],
      ['languages', 'Languages', application.languages, required.languages],
      [
        'certificates',
        'Certificates',
        application.certificates,
        required.certificates,
      ],
    ];
    for (const [field, label, value, isRequired] of lists) {
      if (isRequired && (!value || value.length === 0)) {
        missing.push({ field, label });
      }
    }

    const answersByQuestionId = new Map(
      (application.answers ?? []).map((answer) => [answer.questionId, answer]),
    );
    for (const question of questions) {
      if (!question.required) continue;
      const answer = answersByQuestionId.get(question.id);
      const hasAnswer =
        questionBehaviour(question.type).kind === 'text'
          ? Boolean(answer?.answerText?.trim() || answer?.answer?.trim())
          : Boolean(answer?.selectedOptions?.length);
      if (!hasAnswer) {
        missing.push({
          field: `question:${question.id}`,
          label: question.question,
        });
      }
    }

    return missing;
  }

  private cleanList(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  }

  private async assertNoSubmittedDuplicate(
    tenantId: string,
    vacancyId: string,
    email?: string,
    excludingApplicationId?: string,
  ) {
    if (!email) return;
    const existing = await this.prisma.recruitmentApplication.findFirst({
      where: {
        tenantId,
        vacancyId,
        email,
        status: RecruitmentApplicationStatus.SUBMITTED,
        ...(excludingApplicationId
          ? { id: { not: excludingApplicationId } }
          : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'A submitted application already exists for this vacancy and email',
      );
    }
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
      status: RecruitmentApplicationStatus.SUBMITTED,
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
      closingDate: this.dateOnly(vacancy.closingDate),
      salaryAmount: this.decimalToNumber(vacancy.salaryAmount),
      salaryMin: this.decimalToNumber(vacancy.salaryMin),
      salaryMax: this.decimalToNumber(vacancy.salaryMax),
      applicantCount: vacancy._count.applications,
    };
  }

  /** Public vacancies plus whether each company carries the verified check mark. */
  private async serializePublicVacancies(
    vacancies: Prisma.RecruitmentVacancyGetPayload<{
      include: typeof RECRUITMENT_VACANCY_INCLUDE;
    }>[],
  ) {
    const tenantIds = [...new Set(vacancies.map((v) => v.tenantId))];
    const employers =
      tenantIds.length > 0
        ? await this.prisma.recruitmentEmployer.findMany({
            where: { tenantId: { in: tenantIds } },
            select: { tenantId: true, isVerified: true },
          })
        : [];
    const verified = new Map(employers.map((e) => [e.tenantId, e.isVerified]));
    return vacancies.map((vacancy) => ({
      ...this.serializePublicVacancy(vacancy),
      // Companies HR has no record of were set up by the platform.
      companyVerified: verified.get(vacancy.tenantId) ?? true,
    }));
  }

  private serializePublicVacancy(
    vacancy: Prisma.RecruitmentVacancyGetPayload<{
      include: typeof RECRUITMENT_VACANCY_INCLUDE;
    }>,
  ) {
    return {
      id: vacancy.id,
      tenantId: vacancy.tenantId,
      companyName: vacancy.companyName,
      title: vacancy.title,
      department: vacancy.department?.name ?? null,
      branch: vacancy.branch?.name ?? null,
      location: vacancy.location,
      city: vacancy.city,
      jobType: vacancy.jobType,
      workMode: vacancy.workMode,
      vacancies: vacancy.vacancies,
      closingDate: this.dateOnly(vacancy.closingDate),
      description: vacancy.description,
      responsibilities: vacancy.responsibilities,
      perksAndBenefits: vacancy.perksAndBenefits,
      requirements: vacancy.requirements,
      details: vacancy.details,
      salaryType: vacancy.salaryType,
      salaryAmount: this.decimalToNumber(vacancy.salaryAmount),
      salaryMin: this.decimalToNumber(vacancy.salaryMin),
      salaryMax: this.decimalToNumber(vacancy.salaryMax),
      salaryCurrency: vacancy.salaryCurrency,
      status: vacancy.status,
      createdAt: vacancy.createdAt,
      updatedAt: vacancy.updatedAt,
      questions: vacancy.questions.map((question) => ({
        id: question.id,
        question: question.question,
        type: question.type,
        options: this.readQuestionOptions(question.options),
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
    const { accessTokenHash: _accessTokenHash, ...safeCandidate } = candidate;
    return {
      ...safeCandidate,
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
        answerText: answer.answerText,
        selectedOptions: answer.selectedOptions,
        createdAt: answer.createdAt,
      })),
      documents: this.serializeCandidateDocuments(candidate),
    };
  }

  private serializePublicApplication(
    application: Prisma.RecruitmentApplicationGetPayload<{
      include: typeof RECRUITMENT_PUBLIC_APPLICATION_INCLUDE;
    }>,
  ) {
    const { accessTokenHash: _accessTokenHash, ...safeApplication } =
      application;
    return {
      ...safeApplication,
      expectedSalary: this.decimalToNumber(application.expectedSalary),
      vacancy: this.serializePublicVacancy({
        ...application.vacancy,
        _count: { applications: 0 },
      }),
      answers: application.answers.map((answer) => ({
        id: answer.id,
        questionId: answer.questionId,
        question: answer.questionSnapshot,
        currentQuestion: answer.question.question,
        answer: answer.answer,
        answerText: answer.answerText,
        selectedOptions: answer.selectedOptions,
        createdAt: answer.createdAt,
      })),
      documents: this.serializeCandidateDocuments(application),
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

  /**
   * Works out the salary columns for a vacancy from the request and, on update, the stored values.
   * FIXED keeps only salaryAmount, RANGE keeps min/max, and NEGOTIABLE / NON_DISCLOSED keep no amount.
   * When salaryType is omitted it is inferred from the amounts, so older callers keep working.
   */
  private resolveSalary(
    existing: {
      salaryType: RecruitmentSalaryType;
      salaryAmount: Prisma.Decimal | null;
      salaryMin: Prisma.Decimal | null;
      salaryMax: Prisma.Decimal | null;
      salaryCurrency: string | null;
    } | null,
    dto: {
      salaryType?: RecruitmentSalaryType;
      salaryAmount?: number;
      salaryMin?: number;
      salaryMax?: number;
      salaryCurrency?: string;
    },
  ) {
    const amount =
      dto.salaryAmount ?? this.decimalToNumber(existing?.salaryAmount) ?? null;
    const min =
      dto.salaryMin ?? this.decimalToNumber(existing?.salaryMin) ?? null;
    const max =
      dto.salaryMax ?? this.decimalToNumber(existing?.salaryMax) ?? null;
    const currency =
      this.optionalTrim(dto.salaryCurrency)?.toUpperCase() ??
      existing?.salaryCurrency ??
      null;

    let salaryType = dto.salaryType;
    if (!salaryType) {
      if (dto.salaryAmount !== undefined) {
        salaryType = RecruitmentSalaryType.FIXED;
      } else if (dto.salaryMin !== undefined || dto.salaryMax !== undefined) {
        salaryType = RecruitmentSalaryType.RANGE;
      } else {
        salaryType =
          existing?.salaryType ?? RecruitmentSalaryType.NON_DISCLOSED;
      }
    }

    if (
      salaryType === RecruitmentSalaryType.NEGOTIABLE ||
      salaryType === RecruitmentSalaryType.NON_DISCLOSED
    ) {
      return {
        salaryType,
        salaryAmount: null,
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
      };
    }

    if (!currency) {
      throw new BadRequestException(
        'salaryCurrency is required when a salary amount is set',
      );
    }

    if (salaryType === RecruitmentSalaryType.FIXED) {
      if (amount === null || amount <= 0) {
        throw new BadRequestException(
          'salaryAmount is required for a fixed salary',
        );
      }
      return {
        salaryType,
        salaryAmount: amount,
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: currency,
      };
    }

    if (min === null || max === null) {
      throw new BadRequestException(
        'salaryMin and salaryMax are required for a salary range',
      );
    }
    if (max < min) {
      throw new BadRequestException('salaryMax cannot be lower than salaryMin');
    }
    return {
      salaryType,
      salaryAmount: null,
      salaryMin: min,
      salaryMax: max,
      salaryCurrency: currency,
    };
  }

  /** Structured requirements as stored: empty lists and empty sections are dropped. */
  private normalizeDetails(
    input?: {
      education?: { levels: string[]; required?: boolean };
      experience?: { minYears?: number; maxYears?: number; required?: boolean };
      skills?: { items: string[]; required?: boolean };
      languages?: { items: string[]; required?: boolean };
      certificates?: { items: string[]; required?: boolean };
      documents?: {
        resume?: boolean;
        coverLetter?: boolean;
        portfolio?: boolean;
        github?: boolean;
      };
    } | null,
  ): VacancyDetails | null {
    if (!input) return null;
    const details: VacancyDetails = {};

    const levels = [...new Set(input.education?.levels ?? [])];
    if (input.education && levels.length > 0) {
      details.education = {
        levels,
        required: input.education.required ?? false,
      };
    }

    const experience = input.experience;
    if (
      experience &&
      (experience.minYears !== undefined || experience.maxYears !== undefined)
    ) {
      if (
        experience.minYears !== undefined &&
        experience.maxYears !== undefined &&
        experience.maxYears < experience.minYears
      ) {
        throw new BadRequestException(
          'Maximum years of experience cannot be lower than the minimum',
        );
      }
      details.experience = {
        ...(experience.minYears !== undefined
          ? { minYears: experience.minYears }
          : {}),
        ...(experience.maxYears !== undefined
          ? { maxYears: experience.maxYears }
          : {}),
        required: experience.required ?? false,
      };
    }

    const lists = ['skills', 'languages', 'certificates'] as const;
    for (const key of lists) {
      const requirement = input[key];
      if (!requirement) continue;
      const items = [
        ...new Set(
          requirement.items.map((item) => item.trim()).filter(Boolean),
        ),
      ];
      if (items.length > 0) {
        details[key] = { items, required: requirement.required ?? false };
      }
    }

    if (input.documents) {
      details.documents = {
        resume: input.documents.resume ?? true,
        coverLetter: input.documents.coverLetter ?? false,
        portfolio: input.documents.portfolio ?? false,
        github: input.documents.github ?? false,
      };
    }

    return Object.keys(details).length > 0 ? details : null;
  }

  /** The public `requirements` text: what was sent, otherwise generated from the structured details. */
  private resolveRequirements(
    requirements: string | null | undefined,
    details: VacancyDetails | null,
  ) {
    const explicit = this.optionalTrim(requirements);
    if (explicit) return explicit;
    if (!details) return undefined;
    return this.optionalTrim(renderRequirementsText(details));
  }

  /** `YYYY-MM-DD` to a UTC date; null clears. A closing date cannot be in the past. */
  private parseClosingDate(value?: string | null) {
    if (value === undefined || value === null) return value ?? null;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('closingDate must be a valid date');
    }
    if (date < this.startOfTodayUtc()) {
      throw new BadRequestException('closingDate cannot be in the past');
    }
    return date;
  }

  private startOfTodayUtc() {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  private isPastClosingDate(closingDate?: Date | null) {
    return !!closingDate && closingDate < this.startOfTodayUtc();
  }

  /** Open, and not past its closing date: the vacancies applicants can see and apply to. */
  /** Open, unexpired vacancies of companies that are not blocked. */
  private async acceptingApplicationsWhere(): Promise<Prisma.RecruitmentVacancyWhereInput> {
    const blocked = await this.prisma.recruitmentEmployer.findMany({
      where: { isBlocked: true },
      select: { tenantId: true },
    });
    return {
      ...(blocked.length > 0
        ? { NOT: { tenantId: { in: blocked.map((b) => b.tenantId) } } }
        : {}),
      status: RecruitmentVacancyStatus.OPEN,
      OR: [
        { closingDate: null },
        { closingDate: { gte: this.startOfTodayUtc() } },
      ],
    };
  }

  private async assertDepartmentAndBranch(
    tenantId: string,
    departmentId?: string | null,
    branchId?: string | null,
  ) {
    if (departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: departmentId, tenantId },
        select: { id: true },
      });
      if (!department) throw new NotFoundException('Department not found');
    }
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchId, tenantId },
        select: { id: true },
      });
      if (!branch) throw new NotFoundException('Branch not found');
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

  private normalizeQuestionOptions(
    type: RecruitmentQuestionType,
    options?: string[],
  ) {
    const behaviour = questionBehaviour(type);
    if (behaviour.kind === 'text') {
      return Prisma.JsonNull;
    }
    if (behaviour.fixedOptions) {
      return [...behaviour.fixedOptions];
    }
    const normalized = [
      ...new Set(options?.map((option) => option.trim()).filter(Boolean) ?? []),
    ];
    if (normalized.length === 0) {
      throw new BadRequestException(
        'Selectable recruitment questions require at least one option',
      );
    }
    if (normalized.length > 50) {
      throw new BadRequestException(
        'Recruitment vacancy questions cannot have more than 50 options',
      );
    }
    return normalized;
  }

  private readQuestionOptions(options: Prisma.JsonValue | null) {
    if (!Array.isArray(options)) return [];
    return options.filter(
      (option): option is string => typeof option === 'string',
    );
  }

  private createAccessToken() {
    return randomBytes(32).toString('base64url');
  }

  private hashAccessToken(accessToken: string) {
    return createHash('sha256').update(accessToken).digest('hex');
  }

  private async getCandidateForInterviews(
    tenantId: string,
    candidateId: string,
  ) {
    const candidate = await this.prisma.recruitmentApplication.findFirst({
      where: {
        tenantId,
        id: candidateId,
        status: RecruitmentApplicationStatus.SUBMITTED,
      },
      select: {
        id: true,
        currentStageId: true,
        currentStage: { select: { normalizedName: true, sortOrder: true } },
      },
    });
    if (!candidate)
      throw new NotFoundException('Recruitment candidate not found');
    return candidate;
  }

  /**
   * The Interview stage a candidate moves to when an interview is scheduled, or null to leave
   * them where they are: no Interview stage, already in it, or already past it (Offer, Hired).
   * A rejected candidate does move, since scheduling an interview is a recruiter's decision.
   */
  private async stageForNewInterview(
    tenantId: string,
    current: { normalizedName: string; sortOrder: number } | null,
  ) {
    const interview = await this.prisma.recruitmentStage.findFirst({
      where: { tenantId, normalizedName: this.normalizeName('Interview') },
    });
    if (!interview) return null;
    if (current) {
      if (current.normalizedName === interview.normalizedName) return null;
      const rejected =
        current.normalizedName === this.normalizeName('Rejected');
      if (!rejected && current.sortOrder > interview.sortOrder) return null;
    }
    return interview;
  }

  private parseInterviewTime(value: string) {
    const scheduledAt = new Date(value);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('scheduledAt must be a valid date-time');
    }
    if (scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        'Interviews must be scheduled in the future',
      );
    }
    return scheduledAt;
  }

  /** On a mode change nothing from the previous mode carries over; otherwise unsent keeps stored. */
  private pickChannelValue(
    sent: string | null | undefined,
    stored: string | null,
    modeChanged: boolean,
  ) {
    if (sent !== undefined) return sent;
    return modeChanged ? null : stored;
  }

  /**
   * Each mode needs one set of details and drops the rest, so an interview never carries a
   * stale link or number from a different mode.
   */
  private resolveInterviewChannel(input: {
    mode: RecruitmentInterviewMode;
    platform?: string | null;
    meetingLink?: string | null;
    phone?: string | null;
    location?: string | null;
  }) {
    const none = {
      platform: null as string | null,
      meetingLink: null as string | null,
      phone: null as string | null,
      location: null as string | null,
    };

    if (input.mode === RecruitmentInterviewMode.VIDEO) {
      const platform = this.optionalTrim(input.platform);
      const meetingLink = this.optionalTrim(input.meetingLink);
      if (!platform) {
        throw new BadRequestException(
          'platform is required for a video interview',
        );
      }
      if (!meetingLink) {
        throw new BadRequestException(
          'meetingLink is required for a video interview',
        );
      }
      if (!/^https?:\/\/\S+$/i.test(meetingLink)) {
        throw new BadRequestException(
          'meetingLink must be a valid http or https link',
        );
      }
      return { ...none, platform, meetingLink };
    }

    if (input.mode === RecruitmentInterviewMode.PHONE) {
      const phone = this.optionalTrim(input.phone);
      if (!phone) {
        throw new BadRequestException(
          'phone is required for a phone interview',
        );
      }
      return { ...none, phone };
    }

    const location = this.optionalTrim(input.location);
    if (!location) {
      throw new BadRequestException(
        'location is required for an in-person interview',
      );
    }
    return { ...none, location };
  }

  private serializeInterview(
    interview: Prisma.RecruitmentInterviewGetPayload<{
      include: typeof RECRUITMENT_INTERVIEW_INCLUDE;
    }>,
  ) {
    return {
      id: interview.id,
      candidateId: interview.applicationId,
      mode: interview.mode,
      status: interview.status,
      scheduledAt: interview.scheduledAt,
      durationMinutes: interview.durationMinutes,
      platform: interview.platform,
      meetingLink: interview.meetingLink,
      phone: interview.phone,
      location: interview.location,
      notes: interview.notes,
      feedback: interview.feedback,
      scheduledBy: interview.createdByEmployee,
      createdAt: interview.createdAt,
      updatedAt: interview.updatedAt,
    };
  }

  private optionalTrim(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private dateOnly(value?: Date | null) {
    return value ? value.toISOString().slice(0, 10) : null;
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
