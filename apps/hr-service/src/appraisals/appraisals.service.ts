import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppraisalCycleDto } from './dto/create-cycle.dto';
import { UpdateAppraisalCycleDto } from './dto/update-cycle.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { CreateAppraisalTemplateDto } from './dto/create-template.dto';
import { CreateAppraisalKpiDto } from './dto/create-kpi.dto';
import {
  assertHrAccess,
  hasPermissionRule,
  isCompanyAdminUser,
} from '../auth/access-scope';

type FinalRating =
  | 'Outstanding'
  | 'Very Good'
  | 'Good'
  | 'Satisfactory'
  | 'Needs Improvement';

function scoreToRating(score: number | null): FinalRating {
  if (score === null || score === undefined) return 'Needs Improvement';
  if (score >= 5) return 'Outstanding';
  if (score >= 4) return 'Very Good';
  if (score >= 3) return 'Good';
  if (score >= 2) return 'Satisfactory';
  return 'Needs Improvement';
}

function deriveOverallStatus(appraisal: {
  selfStatus: string;
  managerStatus: string;
  finalScore: number | null;
}): string {
  if (appraisal.managerStatus === 'SUBMITTED' && appraisal.finalScore !== null)
    return 'Finalized';
  if (appraisal.managerStatus === 'SUBMITTED') return 'ManagerSubmitted';
  if (appraisal.selfStatus === 'SUBMITTED') return 'SelfSubmitted';
  return 'NotStarted';
}

@Injectable()
export class AppraisalsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Cycles ─────────────────────────────────────────────────────────────────

  async createCycle(
    tenantId: string,
    createdBy: string,
    dto: CreateAppraisalCycleDto,
  ) {
    return this.prisma.appraisalCycle.create({
      data: {
        tenantId,
        createdBy,
        title: dto.title,
        description: dto.description,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        selfAssessmentDeadline: dto.selfAssessmentDeadline
          ? new Date(dto.selfAssessmentDeadline)
          : undefined,
        managerReviewDeadline: dto.managerReviewDeadline
          ? new Date(dto.managerReviewDeadline)
          : undefined,
        frequency: dto.frequency,
        departmentIds: dto.departmentIds ?? [],
        templateId: dto.templateId,
      },
      include: { _count: { select: { appraisals: true } } },
    });
  }

  async getCycles(tenantId: string) {
    return this.prisma.appraisalCycle.findMany({
      where: { tenantId },
      include: { _count: { select: { appraisals: true } } },
      orderBy: { startDate: 'desc' },
    });
  }

  async getCycle(tenantId: string, cycleId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
      include: { _count: { select: { appraisals: true } } },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');
    return cycle;
  }

  async updateCycle(
    tenantId: string,
    cycleId: string,
    dto: UpdateAppraisalCycleDto,
  ) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');

    return this.prisma.appraisalCycle.update({
      where: { id: cycleId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        ...(dto.selfAssessmentDeadline !== undefined && {
          selfAssessmentDeadline: dto.selfAssessmentDeadline
            ? new Date(dto.selfAssessmentDeadline)
            : null,
        }),
        ...(dto.managerReviewDeadline !== undefined && {
          managerReviewDeadline: dto.managerReviewDeadline
            ? new Date(dto.managerReviewDeadline)
            : null,
        }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency }),
        ...(dto.departmentIds && { departmentIds: dto.departmentIds }),
        ...(dto.templateId !== undefined && { templateId: dto.templateId }),
      },
      include: { _count: { select: { appraisals: true } } },
    });
  }

  async deleteCycle(tenantId: string, cycleId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');
    await this.prisma.appraisalCycle.delete({ where: { id: cycleId } });
    return { message: 'Cycle deleted' };
  }

  async startCycle(tenantId: string, cycleId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');

    const employees = await this.prisma.employee.findMany({
      where: { tenantId, employmentStatus: 'ACTIVE' },
    });

    for (const emp of employees) {
      await this.prisma.appraisal.upsert({
        where: { cycleId_employeeId: { cycleId, employeeId: emp.id } },
        update: {},
        create: {
          tenantId,
          cycleId,
          employeeId: emp.id,
          managerId: emp.managerId,
          status: 'IN_PROGRESS',
        },
      });
    }

    return {
      message: `Appraisal cycle started for ${employees.length} employees`,
    };
  }

  async getCycleResults(tenantId: string, cycleId: string) {
    const appraisals = await this.prisma.appraisal.findMany({
      where: { tenantId, cycleId },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            jobTitle: true,
            department: { select: { name: true } },
          },
        },
        manager: { select: { firstName: true, lastName: true } },
      },
    });

    const totalEmployees = appraisals.length;
    const reviewed = appraisals.filter((a) => a.managerStatus === 'SUBMITTED');
    const reviewedCount = reviewed.length;
    const completionRate =
      totalEmployees > 0
        ? Math.round((reviewedCount / totalEmployees) * 100)
        : 0;

    const ratingLabels: FinalRating[] = [
      'Outstanding',
      'Very Good',
      'Good',
      'Satisfactory',
      'Needs Improvement',
    ];

    const results = appraisals.map((a) => ({
      id: a.id,
      employeeId: a.employeeId,
      employeeName: `${a.employee.firstName} ${a.employee.lastName}`,
      department: a.employee.department?.name ?? '',
      jobTitle: a.employee.jobTitle ?? '',
      managerName: a.manager
        ? `${a.manager.firstName} ${a.manager.lastName}`
        : '',
      selfScore: a.selfScore ?? undefined,
      managerScore: a.managerScore ?? undefined,
      overallScore: a.finalScore ?? 0,
      finalRating: scoreToRating(a.finalScore),
      reviewCompletedAt: a.completedAt?.toISOString() ?? '',
    }));

    const ratingDistribution = ratingLabels.map((rating) => {
      const count = results.filter((r) => r.finalRating === rating).length;
      return {
        rating,
        count,
        percentage:
          totalEmployees > 0 ? Math.round((count / totalEmployees) * 100) : 0,
      };
    });

    return {
      totalEmployees,
      reviewedCount,
      completionRate,
      ratingDistribution,
      results,
    };
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────

  async getCycleKpis(tenantId: string, cycleId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');

    return this.prisma.appraisalKpi.findMany({
      where: { cycleId, tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createCycleKpi(
    tenantId: string,
    cycleId: string,
    actor: RequestUser,
    dto: CreateAppraisalKpiDto,
  ) {
    assertHrAccess(
      isCompanyAdminUser(actor) || hasPermissionRule(actor, 'appraisals:EDIT'),
    );

    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');

    return this.prisma.appraisalKpi.create({
      data: {
        tenantId,
        cycleId,
        title: dto.title,
        description: dto.description,
        weight: dto.weight,
        maxScore: dto.maxScore ?? 5,
        selfWeight: dto.selfWeight ?? 50,
        managerWeight: dto.managerWeight ?? 50,
      },
    });
  }

  async updateCycleKpi(
    tenantId: string,
    cycleId: string,
    kpiId: string,
    actor: RequestUser,
    dto: Partial<CreateAppraisalKpiDto>,
  ) {
    assertHrAccess(
      isCompanyAdminUser(actor) || hasPermissionRule(actor, 'appraisals:EDIT'),
    );

    const kpi = await this.prisma.appraisalKpi.findFirst({
      where: { id: kpiId, cycleId, tenantId },
    });
    if (!kpi) throw new NotFoundException('KPI not found');

    return this.prisma.appraisalKpi.update({
      where: { id: kpiId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.maxScore !== undefined && { maxScore: dto.maxScore }),
        ...(dto.selfWeight !== undefined && { selfWeight: dto.selfWeight }),
        ...(dto.managerWeight !== undefined && {
          managerWeight: dto.managerWeight,
        }),
      },
    });
  }

  async seedCycleFromTemplate(tenantId: string, cycleId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
      include: { kpis: true },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');
    if (!cycle.templateId)
      throw new BadRequestException('Cycle has no linked template');
    if (cycle.kpis.length > 0)
      throw new ConflictException(
        'Cycle already has KPIs. Remove existing KPIs before re-seeding.',
      );

    const template = await this.prisma.appraisalTemplate.findFirst({
      where: { id: cycle.templateId, tenantId },
      include: { kpis: true },
    });
    if (!template) throw new NotFoundException('Linked template not found');
    if (!template.kpis.length)
      throw new BadRequestException('Template has no KPIs to seed from');

    const seeded = await this.prisma.$transaction(
      template.kpis.map((kpi) =>
        this.prisma.appraisalKpi.create({
          data: {
            tenantId,
            cycleId,
            title: kpi.title,
            description: kpi.description,
            weight: kpi.weight,
            maxScore: kpi.maxScore,
            selfWeight: template.selfAssessmentWeight,
            managerWeight: template.managerAssessmentWeight,
          },
        }),
      ),
    );

    return { seeded: seeded.length, kpis: seeded };
  }

  // ── Templates ──────────────────────────────────────────────────────────────

  async getTemplates(tenantId: string, page = 1, search?: string) {
    const pageSize = 20;
    const skip = (page - 1) * pageSize;
    const where: any = { tenantId };
    if (search?.trim()) {
      where.name = { contains: search.trim(), mode: 'insensitive' };
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.appraisalTemplate.count({ where }),
      this.prisma.appraisalTemplate.findMany({
        where,
        include: { kpis: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      data,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      page,
    };
  }

  async createTemplate(tenantId: string, dto: CreateAppraisalTemplateDto) {
    return this.prisma.appraisalTemplate.create({
      data: {
        tenantId,
        name: dto.name,
        selfAssessmentWeight: dto.selfAssessmentWeight ?? 50,
        managerAssessmentWeight: dto.managerAssessmentWeight ?? 50,
        kpis: dto.kpis?.length
          ? {
              create: dto.kpis.map((k) => ({
                title: k.title,
                weight: k.weight,
                maxScore: k.maxScore ?? 5,
                description: k.description,
              })),
            }
          : undefined,
      },
      include: { kpis: true },
    });
  }

  async updateTemplate(
    tenantId: string,
    templateId: string,
    dto: Partial<CreateAppraisalTemplateDto>,
  ) {
    const template = await this.prisma.appraisalTemplate.findFirst({
      where: { id: templateId, tenantId },
    });
    if (!template) throw new NotFoundException('Template not found');

    const updated = await this.prisma.appraisalTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.selfAssessmentWeight !== undefined && {
          selfAssessmentWeight: dto.selfAssessmentWeight,
        }),
        ...(dto.managerAssessmentWeight !== undefined && {
          managerAssessmentWeight: dto.managerAssessmentWeight,
        }),
        ...(dto.kpis !== undefined && {
          kpis: {
            deleteMany: {},
            create: dto.kpis.map((k) => ({
              title: k.title,
              weight: k.weight,
              maxScore: k.maxScore ?? 5,
              description: k.description,
            })),
          },
        }),
      },
      include: { kpis: true },
    });

    return updated;
  }

  async deleteTemplate(tenantId: string, templateId: string) {
    const template = await this.prisma.appraisalTemplate.findFirst({
      where: { id: templateId, tenantId },
    });
    if (!template) throw new NotFoundException('Template not found');
    await this.prisma.appraisalTemplate.delete({ where: { id: templateId } });
    return { message: 'Template deleted' };
  }

  // ── Appraisals ─────────────────────────────────────────────────────────────

  async getAppraisals(tenantId: string, actor: RequestUser, cycleId: string) {
    const where: any = { tenantId, cycleId };

    if (!isCompanyAdminUser(actor)) {
      assertHrAccess(hasPermissionRule(actor, 'appraisals:VIEW'));
    }

    return this.prisma.appraisal.findMany({
      where,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            jobTitle: true,
            avatarUrl: true,
          },
        },
        cycle: { select: { title: true } },
      },
    });
  }

  async getAppraisal(tenantId: string, appraisalId: string) {
    const appraisal = await this.prisma.appraisal.findFirst({
      where: { id: appraisalId, tenantId },
      include: {
        employee: {
          select: { firstName: true, lastName: true, jobTitle: true },
        },
        cycle: {
          select: {
            title: true,
            startDate: true,
            endDate: true,
            managerReviewDeadline: true,
          },
        },
      },
    });

    if (!appraisal) throw new NotFoundException('Appraisal not found');

    const overallStatus = deriveOverallStatus(appraisal);

    const selfResponse =
      appraisal.selfStatus === 'SUBMITTED'
        ? {
            status: 'Submitted',
            kpiScores: [] as {
              kpiId: string;
              score: number;
              comment?: string;
            }[],
            sectionResponses: [],
            submittedAt: appraisal.selfSubmittedAt?.toISOString(),
            score: appraisal.selfScore,
            comment: appraisal.selfComment,
          }
        : null;

    const managerResponse =
      appraisal.managerStatus === 'SUBMITTED'
        ? {
            status: 'Submitted',
            kpiScores: [] as {
              kpiId: string;
              score: number;
              comment?: string;
            }[],
            sectionResponses: [],
            submittedAt: appraisal.managerSubmittedAt?.toISOString(),
            score: appraisal.managerScore,
            comment: appraisal.managerComment,
          }
        : null;

    const finalizedAppraisal =
      appraisal.finalScore !== null
        ? {
            overallScore: appraisal.finalScore,
            finalRating: scoreToRating(appraisal.finalScore),
            finalComment: appraisal.finalComment,
            finalizedAt: appraisal.completedAt?.toISOString(),
          }
        : null;

    return {
      ...appraisal,
      overallStatus,
      selfResponse,
      managerResponse,
      sections: [],
      finalizedAppraisal,
    };
  }

  async getMyAppraisals(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
    });
    if (!employee) throw new NotFoundException('Employee profile not found');

    const appraisals = await this.prisma.appraisal.findMany({
      where: { tenantId, employeeId: employee.id },
      include: {
        cycle: {
          select: {
            title: true,
            startDate: true,
            endDate: true,
            selfAssessmentDeadline: true,
            managerReviewDeadline: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return appraisals.map((a) => ({
      ...a,
      cycleName: a.cycle?.title ?? '',
      cycleStatus: 'InProgress',
      overallStatus: deriveOverallStatus(a),
      selfAssessmentDeadline:
        a.cycle?.selfAssessmentDeadline?.toISOString() ?? null,
    }));
  }

  async getTeamAppraisals(tenantId: string, userId: string) {
    const managerEmployee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
    });
    if (!managerEmployee) return [];

    const appraisals = await this.prisma.appraisal.findMany({
      where: { tenantId, managerId: managerEmployee.id },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        cycle: {
          select: {
            title: true,
            managerReviewDeadline: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return appraisals.map((a) => ({
      id: a.id,
      employeeId: a.employeeId,
      employeeName: `${a.employee.firstName} ${a.employee.lastName}`,
      cycleId: a.cycleId,
      cycleName: a.cycle?.title ?? '',
      selfSubmittedAt: a.selfSubmittedAt?.toISOString() ?? null,
      managerReviewDeadline:
        a.cycle?.managerReviewDeadline?.toISOString() ?? null,
      overallStatus: deriveOverallStatus(a),
    }));
  }

  async submitSelfAssessment(
    tenantId: string,
    appraisalId: string,
    userId: string,
    dto: SubmitReviewDto,
  ) {
    const appraisal = await this.prisma.appraisal.findFirst({
      where: { id: appraisalId, tenantId },
      include: { employee: true },
    });

    if (!appraisal) throw new NotFoundException('Appraisal not found');
    if (appraisal.employee.userId !== userId) {
      throw new BadRequestException(
        'You can only submit your own self-assessment',
      );
    }
    if (appraisal.selfStatus === 'SUBMITTED') {
      throw new BadRequestException('Self-assessment already submitted');
    }

    return this.prisma.appraisal.update({
      where: { id: appraisalId },
      data: {
        selfScore: dto.score,
        selfComment: dto.comment,
        selfStatus: 'SUBMITTED',
        selfSubmittedAt: new Date(),
      },
    });
  }

  async submitManagerReview(
    tenantId: string,
    appraisalId: string,
    reviewer: RequestUser,
    dto: SubmitReviewDto,
  ) {
    const appraisal = await this.prisma.appraisal.findFirst({
      where: { id: appraisalId, tenantId },
      include: { employee: { select: { id: true } } },
    });

    if (!appraisal) throw new NotFoundException('Appraisal not found');
    if (appraisal.managerStatus === 'SUBMITTED') {
      throw new BadRequestException('Manager review already submitted');
    }

    assertHrAccess(
      isCompanyAdminUser(reviewer) ||
        hasPermissionRule(reviewer, 'appraisals:EDIT'),
    );

    const finalScore = appraisal.selfScore
      ? Math.round((dto.score + appraisal.selfScore) / 2)
      : dto.score;

    return this.prisma.appraisal.update({
      where: { id: appraisalId },
      data: {
        managerId: reviewer.id,
        managerScore: dto.score,
        managerComment: dto.comment,
        managerStatus: 'SUBMITTED',
        managerSubmittedAt: new Date(),
        finalScore,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }
}
