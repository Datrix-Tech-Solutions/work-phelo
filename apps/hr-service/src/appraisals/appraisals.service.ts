import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { EmploymentStatus, Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppraisalCycleDto } from './dto/create-cycle.dto';
import { UpdateAppraisalCycleDto } from './dto/update-cycle.dto';
import { SubmitReviewDto, KpiScoreDto } from './dto/submit-review.dto';
import { CreateAppraisalTemplateDto } from './dto/create-template.dto';
import { CreateAppraisalKpiDto } from './dto/create-kpi.dto';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { NotificationsService } from '../notifications/notifications.service';
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

type PerformanceBandConfig = {
  outstandingThreshold: number;
  veryGoodThreshold: number;
  goodThreshold: number;
  satisfactoryThreshold: number;
};

const DEFAULT_APPRAISAL_ELIGIBLE_STATUSES = [
  EmploymentStatus.ACTIVE,
  EmploymentStatus.PROBATION,
] as const;
const APPRAISAL_ELIGIBLE_EMPLOYMENT_STATUSES = [
  EmploymentStatus.ACTIVE,
  EmploymentStatus.PROBATION,
  EmploymentStatus.SUSPENDED,
] as const;

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function differenceInCalendarDays(target: Date, now: Date): number {
  const targetDate = new Date(`${normalizeDateOnly(target)}T00:00:00.000Z`);
  const nowDate = new Date(`${normalizeDateOnly(now)}T00:00:00.000Z`);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (targetDate.getTime() - nowDate.getTime()) / millisecondsPerDay,
  );
}

function scoreToRating(
  score: number | null,
  bands: PerformanceBandConfig,
): FinalRating {
  if (score === null || score === undefined) return 'Needs Improvement';
  if (score >= bands.outstandingThreshold) return 'Outstanding';
  if (score >= bands.veryGoodThreshold) return 'Very Good';
  if (score >= bands.goodThreshold) return 'Good';
  if (score >= bands.satisfactoryThreshold) return 'Satisfactory';
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

function calcWeightedScore(
  kpiScores: { score: number; kpi: { weight: number; maxScore: number } }[],
): number {
  const totalWeight = kpiScores.reduce((s, k) => s + k.kpi.weight, 0);
  if (!totalWeight) return 0;
  return roundToTwoDecimals(
    kpiScores.reduce((sum, item) => {
      if (!item.kpi.maxScore) return sum;
      return (
        sum +
        roundToTwoDecimals(
          (item.score / item.kpi.maxScore) *
            (item.kpi.weight / totalWeight) *
            100,
        )
      );
    }, 0),
  );
}

function calcFinalScore(
  selfScore: number | null,
  managerScore: number,
  selfWeight: number,
  managerWeight: number,
): number {
  if (selfScore === null) return managerScore;
  return roundToTwoDecimals(
    selfScore * (selfWeight / 100) + managerScore * (managerWeight / 100),
  );
}

function validateTemplatePayload(
  dto: Pick<
    CreateAppraisalTemplateDto,
    'kpis' | 'selfAssessmentWeight' | 'managerAssessmentWeight'
  >,
) {
  const selfWeight = dto.selfAssessmentWeight ?? 40;
  const managerWeight = dto.managerAssessmentWeight ?? 60;
  const assessmentTotal = selfWeight + managerWeight;

  if (assessmentTotal !== 100) {
    throw new BadRequestException(
      `Self and manager weightings must total 100%. Current total is ${assessmentTotal}%`,
    );
  }

  const kpis = dto.kpis ?? [];
  const totalKpiWeight = kpis.reduce((sum, kpi) => sum + kpi.weight, 0);

  if (totalKpiWeight !== 100) {
    throw new BadRequestException(
      `KPI weights must total 100%. Current total is ${totalKpiWeight}%`,
    );
  }
}

@Injectable()
export class AppraisalsService {
  private readonly logger = new Logger(AppraisalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: RabbitMQPublisher,
    private readonly notificationsService: NotificationsService,
  ) {}

  private normalizeAppraisalEligibleStatuses(
    statuses?: string[] | null,
  ): EmploymentStatus[] {
    const allowed = new Set(APPRAISAL_ELIGIBLE_EMPLOYMENT_STATUSES);
    const normalized = Array.from(new Set(statuses ?? [])).filter((status) =>
      allowed.has(
        status as (typeof APPRAISAL_ELIGIBLE_EMPLOYMENT_STATUSES)[number],
      ),
    ) as EmploymentStatus[];

    return normalized.length
      ? normalized
      : [...DEFAULT_APPRAISAL_ELIGIBLE_STATUSES];
  }

  private async loadAppraisalEligibleStatuses(
    tenantId: string,
    cycleEmploymentStatuses?: string[] | null,
  ): Promise<EmploymentStatus[]> {
    const cycleStatuses = this.normalizeAppraisalEligibleStatuses(
      cycleEmploymentStatuses,
    );

    if ((cycleEmploymentStatuses ?? []).length > 0) {
      return cycleStatuses;
    }

    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: { appraisalEligibleStatuses: true },
    });

    return this.normalizeAppraisalEligibleStatuses(
      config?.appraisalEligibleStatuses,
    );
  }

  private async loadPerformanceBands(
    tenantId: string,
  ): Promise<PerformanceBandConfig> {
    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: {
        outstandingThreshold: true,
        veryGoodThreshold: true,
        goodThreshold: true,
        satisfactoryThreshold: true,
      },
    });

    return {
      outstandingThreshold: config?.outstandingThreshold ?? 90,
      veryGoodThreshold: config?.veryGoodThreshold ?? 80,
      goodThreshold: config?.goodThreshold ?? 70,
      satisfactoryThreshold: config?.satisfactoryThreshold ?? 60,
    };
  }

  private validateCycleDates(params: {
    startDate: Date;
    endDate: Date;
    selfAssessmentDeadline: Date;
    managerReviewDeadline: Date;
  }) {
    const {
      startDate,
      endDate,
      selfAssessmentDeadline,
      managerReviewDeadline,
    } = params;

    if (endDate < startDate) {
      throw new BadRequestException(
        'Cycle end date cannot be before cycle start date',
      );
    }

    if (
      selfAssessmentDeadline < startDate ||
      selfAssessmentDeadline > endDate
    ) {
      throw new BadRequestException(
        'Self assessment deadline must fall within the cycle start and end dates',
      );
    }

    if (
      managerReviewDeadline <= selfAssessmentDeadline ||
      managerReviewDeadline > endDate
    ) {
      throw new BadRequestException(
        'Manager review deadline must be after self assessment deadline and within the cycle end date',
      );
    }
  }

  private async ensureUniqueTemplateName(
    tenantId: string,
    name: string,
    excludeTemplateId?: string,
  ) {
    const existing = await this.prisma.appraisalTemplate.findFirst({
      where: {
        tenantId,
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(excludeTemplateId ? { id: { not: excludeTemplateId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A template with this name already exists');
    }
  }

  private async ensureUniqueCycleTitle(
    tenantId: string,
    title: string,
    excludeCycleId?: string,
  ) {
    const existing = await this.prisma.appraisalCycle.findFirst({
      where: {
        tenantId,
        title: { equals: title.trim(), mode: 'insensitive' },
        ...(excludeCycleId ? { id: { not: excludeCycleId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'An appraisal cycle with this name already exists',
      );
    }
  }

  private async ensureTemplateExists(tenantId: string, templateId: string) {
    const template = await this.prisma.appraisalTemplate.findFirst({
      where: { id: templateId, tenantId },
      include: { kpis: true },
    });

    if (!template) {
      throw new BadRequestException(
        'Selected appraisal template does not exist',
      );
    }

    return template;
  }

  private async ensureTemplateIsNotAssignedToActiveCycle(
    tenantId: string,
    templateId: string,
    action: 'updated' | 'deleted',
  ) {
    const activeCycle = await this.prisma.appraisalCycle.findFirst({
      where: {
        tenantId,
        templateId,
        status: 'IN_PROGRESS',
      },
      select: { id: true },
    });

    if (activeCycle) {
      throw new BadRequestException(
        action === 'deleted'
          ? 'This template is assigned to an active cycle and cannot be deleted'
          : 'This template is assigned to an active cycle and cannot be updated',
      );
    }
  }

  private assertCycleConfigurable(cycle: { status: string; title: string }) {
    if (cycle.status === 'IN_PROGRESS') {
      throw new BadRequestException(
        `Cycle "${cycle.title}" is already in progress and its KPIs can no longer be changed`,
      );
    }
    if (cycle.status === 'COMPLETED' || cycle.status === 'CANCELLED') {
      throw new BadRequestException(
        `Cycle "${cycle.title}" is no longer editable`,
      );
    }
  }

  private async seedCycleKpisFromTemplate(
    tenantId: string,
    cycleId: string,
    template: {
      kpis: {
        title: string;
        description: string | null;
        weight: number;
        maxScore: number;
      }[];
      selfAssessmentWeight: number;
      managerAssessmentWeight: number;
    },
  ) {
    if (!template.kpis.length) {
      throw new BadRequestException('Template has no KPIs to seed from');
    }

    return this.prisma.$transaction(
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
  }

  private async resolveCycleEmployees(tenantId: string, cycleId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');

    const eligibleEmploymentStatuses = await this.loadAppraisalEligibleStatuses(
      tenantId,
      cycle.employmentStatuses,
    );

    const employeeWhere: Record<string, unknown> = {
      tenantId,
      employmentStatus: { in: eligibleEmploymentStatuses },
    };

    if (cycle.employeeIds.length > 0) {
      employeeWhere.id = { in: cycle.employeeIds };
    } else {
      if (cycle.departmentIds.length > 0) {
        employeeWhere.departmentId = { in: cycle.departmentIds };
      }
      if (cycle.employmentTypes.length > 0) {
        employeeWhere.employmentType = { in: cycle.employmentTypes };
      }
    }

    const employees = await this.prisma.employee.findMany({
      where: employeeWhere,
      select: {
        id: true,
        userId: true,
        managerId: true,
        firstName: true,
        lastName: true,
      },
    });

    return { cycle, employees, eligibleEmploymentStatuses };
  }

  private async activateCycle(tenantId: string, cycleId: string) {
    const { cycle, employees, eligibleEmploymentStatuses } =
      await this.resolveCycleEmployees(tenantId, cycleId);

    if (cycle.status !== 'UPCOMING') {
      return {
        message: `Appraisal cycle ${cycle.title} is already ${cycle.status.toLowerCase()}`,
      };
    }

    if (!employees.length) {
      throw new BadRequestException(
        `No employees match this cycle's targeting rules. Eligible employment statuses currently in effect: ${eligibleEmploymentStatuses.join(', ')}`,
      );
    }

    if (cycle.templateId) {
      const existingKpis = await this.prisma.appraisalKpi.count({
        where: { tenantId, cycleId },
      });

      if (!existingKpis) {
        const template = await this.ensureTemplateExists(
          tenantId,
          cycle.templateId,
        );
        await this.seedCycleKpisFromTemplate(tenantId, cycleId, template);
      }
    }

    for (const emp of employees) {
      await this.prisma.appraisal.upsert({
        where: { cycleId_employeeId: { cycleId, employeeId: emp.id } },
        update: {
          status: 'IN_PROGRESS',
          managerId: emp.managerId,
        },
        create: {
          tenantId,
          cycleId,
          employeeId: emp.id,
          managerId: emp.managerId,
          status: 'IN_PROGRESS',
        },
      });
    }

    await this.prisma.appraisalCycle.update({
      where: { id: cycleId },
      data: {
        status: 'IN_PROGRESS',
        isActive: true,
        activatedAt: new Date(),
      },
    });

    const managerIds = Array.from(
      new Set(
        employees
          .map((emp) => emp.managerId)
          .filter((managerId): managerId is string => Boolean(managerId)),
      ),
    );
    const managers = managerIds.length
      ? await this.prisma.employee.findMany({
          where: { tenantId, id: { in: managerIds } },
          select: { userId: true },
        })
      : [];

    const notifications = employees
      .filter((emp) => emp.userId)
      .map((emp) => ({
        tenantId,
        userId: emp.userId as string,
        type: 'APPRAISAL_CYCLE_STARTED',
        message: `Your appraisal cycle "${cycle.title}" is now active.`,
        link: `/hr/appraisal/cycles/${cycleId}`,
      }))
      .concat(
        managers
          .filter((manager) => manager.userId)
          .map((manager) => ({
            tenantId,
            userId: manager.userId as string,
            type: 'APPRAISAL_CYCLE_STARTED',
            message: `An appraisal cycle "${cycle.title}" is now active for your team.`,
            link: `/hr/appraisal/cycles/${cycleId}`,
          })),
      );

    if (notifications.length) {
      await this.notificationsService.createMany(notifications);
    }

    return {
      message: `Appraisal cycle started for ${employees.length} employees`,
    };
  }

  // ── Cycles ─────────────────────────────────────────────────────────────────

  async createCycle(
    tenantId: string,
    createdBy: string,
    dto: CreateAppraisalCycleDto,
  ) {
    const template = await this.ensureTemplateExists(tenantId, dto.templateId);
    await this.ensureUniqueCycleTitle(tenantId, dto.title);

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const selfAssessmentDeadline = new Date(dto.selfAssessmentDeadline!);
    const managerReviewDeadline = new Date(dto.managerReviewDeadline!);

    this.validateCycleDates({
      startDate,
      endDate,
      selfAssessmentDeadline,
      managerReviewDeadline,
    });

    const cycleData: Prisma.AppraisalCycleCreateInput = {
      tenantId,
      createdBy,
      title: dto.title.trim(),
      description: dto.description,
      startDate,
      endDate,
      selfAssessmentDeadline,
      managerReviewDeadline,
      frequency: dto.frequency,
      departmentIds: dto.departmentIds ?? [],
      employmentTypes: dto.employmentTypes ?? [],
      employmentStatuses: (dto.employmentStatuses?.length
        ? dto.employmentStatuses
        : []) as EmploymentStatus[],
      employeeIds: dto.employeeIds ?? [],
      template: { connect: { id: dto.templateId } },
      selfAssessmentWeight: template.selfAssessmentWeight,
      managerAssessmentWeight: template.managerAssessmentWeight,
      status: 'UPCOMING',
      isActive: false,
    };

    return this.prisma.appraisalCycle.create({
      data: cycleData,
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
      include: { kpis: true },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');

    if (dto.title && dto.title.trim() !== cycle.title) {
      await this.ensureUniqueCycleTitle(tenantId, dto.title, cycleId);
    }

    const nextStartDate = dto.startDate
      ? new Date(dto.startDate)
      : cycle.startDate;
    const nextEndDate = dto.endDate ? new Date(dto.endDate) : cycle.endDate;
    const nextSelfAssessmentDeadline =
      dto.selfAssessmentDeadline !== undefined
        ? new Date(dto.selfAssessmentDeadline)
        : cycle.selfAssessmentDeadline;
    const nextManagerReviewDeadline =
      dto.managerReviewDeadline !== undefined
        ? new Date(dto.managerReviewDeadline)
        : cycle.managerReviewDeadline;

    if (!nextSelfAssessmentDeadline || !nextManagerReviewDeadline) {
      throw new BadRequestException(
        'Self assessment deadline and manager review deadline are required',
      );
    }

    this.validateCycleDates({
      startDate: nextStartDate,
      endDate: nextEndDate,
      selfAssessmentDeadline: nextSelfAssessmentDeadline,
      managerReviewDeadline: nextManagerReviewDeadline,
    });

    if (cycle.status === 'IN_PROGRESS') {
      const allowedKeys = ['selfAssessmentDeadline', 'managerReviewDeadline'];
      const incomingKeys = Object.keys(dto);
      if (incomingKeys.some((key) => !allowedKeys.includes(key))) {
        throw new BadRequestException(
          'Editing an in-progress cycle is restricted to deadline extensions only',
        );
      }

      if (
        dto.selfAssessmentDeadline &&
        cycle.selfAssessmentDeadline &&
        new Date(dto.selfAssessmentDeadline) < cycle.selfAssessmentDeadline
      ) {
        throw new BadRequestException(
          'Self assessment deadline can only be extended for an in-progress cycle',
        );
      }

      if (
        dto.managerReviewDeadline &&
        cycle.managerReviewDeadline &&
        new Date(dto.managerReviewDeadline) < cycle.managerReviewDeadline
      ) {
        throw new BadRequestException(
          'Manager review deadline can only be extended for an in-progress cycle',
        );
      }
    } else if (cycle.status !== 'UPCOMING') {
      throw new BadRequestException('Only upcoming cycles can be edited');
    }

    let templateUpdate:
      | {
          template: { connect: { id: string } };
          selfAssessmentWeight: number;
          managerAssessmentWeight: number;
        }
      | undefined;

    if (dto.templateId !== undefined) {
      if (cycle.kpis.length > 0 && dto.templateId !== cycle.templateId) {
        throw new BadRequestException(
          'Cannot change the appraisal template after cycle KPIs have been configured',
        );
      }

      const template = await this.ensureTemplateExists(
        tenantId,
        dto.templateId,
      );
      templateUpdate = {
        template: { connect: { id: template.id } },
        selfAssessmentWeight: template.selfAssessmentWeight,
        managerAssessmentWeight: template.managerAssessmentWeight,
      };
    }

    const updateData: Prisma.AppraisalCycleUpdateInput = {
      ...(dto.title && { title: dto.title.trim() }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.startDate && { startDate: nextStartDate }),
      ...(dto.endDate && { endDate: nextEndDate }),
      ...(dto.selfAssessmentDeadline !== undefined && {
        selfAssessmentDeadline: nextSelfAssessmentDeadline,
      }),
      ...(dto.managerReviewDeadline !== undefined && {
        managerReviewDeadline: nextManagerReviewDeadline,
      }),
      ...(dto.frequency !== undefined && { frequency: dto.frequency }),
      ...(dto.departmentIds && { departmentIds: dto.departmentIds }),
      ...(dto.employmentTypes && { employmentTypes: dto.employmentTypes }),
      ...(dto.employmentStatuses !== undefined && {
        employmentStatuses: (dto.employmentStatuses?.length
          ? dto.employmentStatuses
          : []) as EmploymentStatus[],
      }),
      ...(dto.employeeIds && { employeeIds: dto.employeeIds }),
      ...(templateUpdate ?? {}),
    };

    return this.prisma.appraisalCycle.update({
      where: { id: cycleId },
      data: updateData,
      include: { _count: { select: { appraisals: true } } },
    });
  }

  async deleteCycle(tenantId: string, cycleId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');
    if (cycle.status === 'IN_PROGRESS') {
      throw new BadRequestException('In-progress cycles cannot be deleted');
    }
    await this.prisma.appraisalCycle.delete({ where: { id: cycleId } });
    return { message: 'Cycle deleted' };
  }

  async startCycle(tenantId: string, cycleId: string) {
    return this.activateCycle(tenantId, cycleId);
  }

  async cancelCycle(tenantId: string, cycleId: string, reason: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
      include: {
        appraisals: {
          select: {
            employee: { select: { userId: true } },
            manager: { select: { userId: true } },
          },
        },
      },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');
    if (cycle.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Only in-progress cycles can be cancelled');
    }

    await this.prisma.$transaction([
      this.prisma.appraisalCycle.update({
        where: { id: cycleId },
        data: {
          status: 'CANCELLED',
          isActive: false,
          cancelledAt: new Date(),
          cancelledReason: reason,
        },
      }),
      this.prisma.appraisal.updateMany({
        where: { tenantId, cycleId, status: 'IN_PROGRESS' },
        data: { status: 'CANCELLED' },
      }),
    ]);

    const notifications = cycle.appraisals.flatMap((appraisal) => {
      const recipients = [
        appraisal.employee.userId,
        appraisal.manager?.userId ?? null,
      ].filter(Boolean) as string[];

      return recipients.map((userId) => ({
        tenantId,
        userId,
        type: 'APPRAISAL_CYCLE_CANCELLED',
        message: `The appraisal cycle "${cycle.title}" was cancelled. Reason: ${reason}`,
        link: `/hr/appraisal/cycles/${cycleId}`,
      }));
    });

    if (notifications.length) {
      await this.notificationsService.createMany(notifications);
    }

    return { message: 'Cycle cancelled' };
  }

  async completeExpiredCycles() {
    await this.prisma.appraisalCycle.updateMany({
      where: {
        status: 'IN_PROGRESS',
        endDate: { lt: new Date() },
      },
      data: {
        status: 'COMPLETED',
        isActive: false,
      },
    });
  }

  async sendPendingActionReminders() {
    const now = new Date();
    const appraisals = await this.prisma.appraisal.findMany({
      where: {
        status: 'IN_PROGRESS',
        cycle: { status: 'IN_PROGRESS' },
      },
      include: {
        cycle: {
          select: {
            title: true,
            selfAssessmentDeadline: true,
            managerReviewDeadline: true,
          },
        },
        employee: {
          select: {
            userId: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        manager: {
          select: {
            userId: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        reminderLogs: {
          select: { reminderType: true },
        },
      },
    });

    for (const appraisal of appraisals) {
      if (
        appraisal.selfStatus === 'PENDING' &&
        appraisal.cycle.selfAssessmentDeadline &&
        appraisal.employee.userId
      ) {
        const daysUntil = differenceInCalendarDays(
          appraisal.cycle.selfAssessmentDeadline,
          now,
        );
        const reminderType =
          daysUntil === 7
            ? 'SELF_7_DAYS'
            : daysUntil === 3
              ? 'SELF_3_DAYS'
              : daysUntil === 0
                ? 'SELF_DUE'
                : null;

        if (
          reminderType &&
          !appraisal.reminderLogs.some(
            (log) => log.reminderType === reminderType,
          )
        ) {
          await this.prisma.$transaction([
            this.prisma.appraisalReminderLog.create({
              data: {
                tenantId: appraisal.tenantId,
                appraisalId: appraisal.id,
                reminderType,
              },
            }),
            this.prisma.notification.create({
              data: {
                tenantId: appraisal.tenantId,
                userId: appraisal.employee.userId,
                type: 'APPRAISAL_SELF_REMINDER',
                message:
                  daysUntil === 0
                    ? `Your self assessment for "${appraisal.cycle.title}" is due today.`
                    : `Your self assessment for "${appraisal.cycle.title}" is due in ${daysUntil} days.`,
                link: `/hr/appraisal/cycles/${appraisal.cycleId}/self-assessment/${appraisal.id}`,
              },
            }),
          ]);

          if (appraisal.employee.email) {
            this.publisher
              .notificationAppraisalSelfReminder({
                tenantId: appraisal.tenantId,
                appraisalId: appraisal.id,
                cycleId: appraisal.cycleId,
                cycleTitle: appraisal.cycle.title,
                employeeEmail: appraisal.employee.email,
                employeeFirstName: appraisal.employee.firstName,
                deadline: normalizeDateOnly(
                  appraisal.cycle.selfAssessmentDeadline,
                ),
                daysRemaining: daysUntil,
              })
              .catch((error) =>
                this.logger.error(
                  `[appraisal] Failed to publish self reminder for ${appraisal.id}`,
                  error,
                ),
              );
          }
        }
      }

      if (
        appraisal.selfStatus === 'SUBMITTED' &&
        appraisal.managerStatus === 'PENDING' &&
        appraisal.cycle.managerReviewDeadline &&
        appraisal.manager?.userId
      ) {
        const daysUntil = differenceInCalendarDays(
          appraisal.cycle.managerReviewDeadline,
          now,
        );
        const reminderType =
          daysUntil === 7
            ? 'MANAGER_7_DAYS'
            : daysUntil === 3
              ? 'MANAGER_3_DAYS'
              : daysUntil === 0
                ? 'MANAGER_DUE'
                : null;

        if (
          reminderType &&
          !appraisal.reminderLogs.some(
            (log) => log.reminderType === reminderType,
          )
        ) {
          await this.prisma.$transaction([
            this.prisma.appraisalReminderLog.create({
              data: {
                tenantId: appraisal.tenantId,
                appraisalId: appraisal.id,
                reminderType,
              },
            }),
            this.prisma.notification.create({
              data: {
                tenantId: appraisal.tenantId,
                userId: appraisal.manager.userId,
                type: 'APPRAISAL_MANAGER_REMINDER',
                message:
                  daysUntil === 0
                    ? `${appraisal.employee.firstName} ${appraisal.employee.lastName}'s manager review for "${appraisal.cycle.title}" is due today.`
                    : `${appraisal.employee.firstName} ${appraisal.employee.lastName}'s manager review for "${appraisal.cycle.title}" is due in ${daysUntil} days.`,
                link: `/hr/appraisal/cycles/${appraisal.cycleId}/manager-review/${appraisal.id}`,
              },
            }),
          ]);

          if (appraisal.manager.email) {
            this.publisher
              .notificationAppraisalManagerReminder({
                tenantId: appraisal.tenantId,
                appraisalId: appraisal.id,
                cycleId: appraisal.cycleId,
                cycleTitle: appraisal.cycle.title,
                managerEmail: appraisal.manager.email,
                managerFirstName: appraisal.manager.firstName,
                employeeFirstName: appraisal.employee.firstName,
                employeeLastName: appraisal.employee.lastName,
                deadline: normalizeDateOnly(
                  appraisal.cycle.managerReviewDeadline,
                ),
                daysRemaining: daysUntil,
              })
              .catch((error) =>
                this.logger.error(
                  `[appraisal] Failed to publish manager reminder for ${appraisal.id}`,
                  error,
                ),
              );
          }
        }
      }
    }
  }

  async getCycleResults(tenantId: string, cycleId: string) {
    const bands = await this.loadPerformanceBands(tenantId);
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
      finalRating: scoreToRating(a.finalScore, bands),
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
    this.assertCycleConfigurable(cycle);

    return this.prisma.appraisalKpi.create({
      data: {
        tenantId,
        cycleId,
        title: dto.title,
        description: dto.description,
        weight: dto.weight,
        maxScore: dto.maxScore ?? 5,
        selfWeight: dto.selfWeight ?? cycle.selfAssessmentWeight,
        managerWeight: dto.managerWeight ?? cycle.managerAssessmentWeight,
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
      include: { cycle: true },
    });
    if (!kpi) throw new NotFoundException('KPI not found');
    this.assertCycleConfigurable(kpi.cycle);

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
    this.assertCycleConfigurable(cycle);
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
    const seeded = await this.seedCycleKpisFromTemplate(
      tenantId,
      cycleId,
      template,
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
    validateTemplatePayload(dto);
    await this.ensureUniqueTemplateName(tenantId, dto.name);
    const templateKpis = dto.kpis ?? [];

    return this.prisma.appraisalTemplate.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        selfAssessmentWeight: dto.selfAssessmentWeight ?? 40,
        managerAssessmentWeight: dto.managerAssessmentWeight ?? 60,
        kpis: {
          create: templateKpis.map((k) => ({
            title: k.title,
            weight: k.weight,
            maxScore: k.maxScore ?? 5,
            description: k.description,
          })),
        },
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
      include: { kpis: true },
    });
    if (!template) throw new NotFoundException('Template not found');
    await this.ensureTemplateIsNotAssignedToActiveCycle(
      tenantId,
      templateId,
      'updated',
    );

    if (dto.name && dto.name.trim() !== template.name) {
      await this.ensureUniqueTemplateName(tenantId, dto.name, templateId);
    }

    const nextTemplate = {
      selfAssessmentWeight:
        dto.selfAssessmentWeight ?? template.selfAssessmentWeight,
      managerAssessmentWeight:
        dto.managerAssessmentWeight ?? template.managerAssessmentWeight,
      kpis:
        dto.kpis ??
        template.kpis.map((kpi) => ({
          title: kpi.title,
          weight: kpi.weight,
          maxScore: kpi.maxScore,
          description: kpi.description ?? undefined,
        })),
    };

    validateTemplatePayload(nextTemplate);

    const updated = await this.prisma.appraisalTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
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
    await this.ensureTemplateIsNotAssignedToActiveCycle(
      tenantId,
      templateId,
      'deleted',
    );
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
    const bands = await this.loadPerformanceBands(tenantId);
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
        kpiScores: {
          include: {
            kpi: { select: { title: true, weight: true, maxScore: true } },
          },
        },
      },
    });

    if (!appraisal) throw new NotFoundException('Appraisal not found');

    const overallStatus = deriveOverallStatus(appraisal);

    const toKpiScoreShape = (reviewType: string) =>
      appraisal.kpiScores
        .filter((ks) => ks.reviewType === reviewType)
        .map((ks) => ({
          kpiId: ks.kpiId,
          title: ks.kpi.title,
          weight: ks.kpi.weight,
          maxScore: ks.kpi.maxScore,
          score: ks.score,
          comment: ks.comment ?? undefined,
        }));

    const selfResponse =
      appraisal.selfStatus === 'SUBMITTED'
        ? {
            status: 'Submitted',
            kpiScores: toKpiScoreShape('SELF'),
            submittedAt: appraisal.selfSubmittedAt?.toISOString(),
            score: appraisal.selfScore,
            comment: appraisal.selfComment,
          }
        : null;

    const managerResponse =
      appraisal.managerStatus === 'SUBMITTED'
        ? {
            status: 'Submitted',
            kpiScores: toKpiScoreShape('MANAGER'),
            submittedAt: appraisal.managerSubmittedAt?.toISOString(),
            score: appraisal.managerScore,
            comment: appraisal.managerComment,
          }
        : null;

    const finalizedAppraisal =
      appraisal.finalScore !== null
        ? {
            overallScore: appraisal.finalScore,
            finalRating: scoreToRating(appraisal.finalScore, bands),
            finalComment: appraisal.finalComment,
            finalizedAt: appraisal.completedAt?.toISOString(),
          }
        : null;

    return {
      ...appraisal,
      overallStatus,
      selfResponse,
      managerResponse,
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
            status: true,
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
      cycleStatus: a.cycle?.status ?? 'UPCOMING',
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
      include: {
        employee: {
          select: {
            userId: true,
            managerId: true,
            firstName: true,
            lastName: true,
          },
        },
        cycle: {
          select: {
            title: true,
            selfAssessmentDeadline: true,
            status: true,
          },
        },
      },
    });

    if (!appraisal) throw new NotFoundException('Appraisal not found');
    if (appraisal.employee.userId !== userId)
      throw new BadRequestException(
        'You can only submit your own self-assessment',
      );
    if (appraisal.selfStatus === 'SUBMITTED')
      throw new BadRequestException('Self-assessment already submitted');
    if (appraisal.cycle.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'This appraisal cycle is not currently active',
      );
    }
    if (
      appraisal.cycle.selfAssessmentDeadline &&
      new Date() > appraisal.cycle.selfAssessmentDeadline
    ) {
      throw new BadRequestException('The self assessment deadline has passed');
    }
    if (!dto.score && (!dto.kpiScores || !dto.kpiScores.length))
      throw new BadRequestException('Provide either a score or kpiScores');

    let selfScore = dto.score ?? 0;

    if (dto.kpiScores?.length) {
      await this.saveKpiScores(tenantId, appraisalId, dto.kpiScores, 'SELF');
      const kpisWithDetails = await this.loadKpiScoresWithKpi(
        appraisalId,
        'SELF',
      );
      selfScore = calcWeightedScore(kpisWithDetails);
    }

    const updated = await this.prisma.appraisal.update({
      where: { id: appraisalId },
      data: {
        selfScore,
        selfComment: dto.comment,
        selfStatus: 'SUBMITTED',
        selfSubmittedAt: new Date(),
      },
    });

    if (appraisal.managerId) {
      const manager = await this.prisma.employee.findFirst({
        where: { id: appraisal.managerId, tenantId },
        select: { email: true, firstName: true },
      });
      if (manager?.email) {
        this.publisher
          .notificationAppraisalSelfSubmitted({
            tenantId,
            appraisalId,
            cycleTitle: appraisal.cycle.title,
            employeeFirstName: appraisal.employee.firstName,
            employeeLastName: appraisal.employee.lastName,
            managerEmail: manager.email,
            managerFirstName: manager.firstName,
          })
          .catch((err) =>
            this.logger.error(
              `[appraisal] Failed to publish self-submitted event for ${appraisalId}`,
              err,
            ),
          );
      }
    }

    return updated;
  }

  async submitManagerReview(
    tenantId: string,
    appraisalId: string,
    reviewer: RequestUser,
    dto: SubmitReviewDto,
  ) {
    const appraisal = await this.prisma.appraisal.findFirst({
      where: { id: appraisalId, tenantId },
      include: {
        employee: {
          select: { email: true, firstName: true, lastName: true },
        },
        cycle: {
          select: {
            title: true,
            status: true,
            managerReviewDeadline: true,
            selfAssessmentWeight: true,
            managerAssessmentWeight: true,
          },
        },
      },
    });

    if (!appraisal) throw new NotFoundException('Appraisal not found');
    if (appraisal.selfStatus !== 'SUBMITTED')
      throw new BadRequestException(
        'Employee has not submitted their self-assessment yet',
      );
    if (appraisal.managerStatus === 'SUBMITTED')
      throw new BadRequestException('Manager review already submitted');
    if (appraisal.cycle.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'This appraisal cycle is not currently active',
      );
    }
    if (
      appraisal.cycle.managerReviewDeadline &&
      new Date() > appraisal.cycle.managerReviewDeadline
    ) {
      throw new BadRequestException('The manager review deadline has passed');
    }
    if (!dto.score && (!dto.kpiScores || !dto.kpiScores.length))
      throw new BadRequestException('Provide either a score or kpiScores');

    assertHrAccess(
      isCompanyAdminUser(reviewer) ||
        hasPermissionRule(reviewer, 'appraisals:EDIT'),
    );

    let managerScore = dto.score ?? 0;

    if (dto.kpiScores?.length) {
      await this.saveKpiScores(tenantId, appraisalId, dto.kpiScores, 'MANAGER');
      const kpisWithDetails = await this.loadKpiScoresWithKpi(
        appraisalId,
        'MANAGER',
      );
      managerScore = calcWeightedScore(kpisWithDetails);
    }

    const selfWeight = appraisal.cycle.selfAssessmentWeight ?? 40;
    const managerWeight = appraisal.cycle.managerAssessmentWeight ?? 60;
    const finalScore = calcFinalScore(
      appraisal.selfScore,
      managerScore,
      selfWeight,
      managerWeight,
    );
    const bands = await this.loadPerformanceBands(tenantId);
    const finalRating = scoreToRating(finalScore, bands);

    const updated = await this.prisma.appraisal.update({
      where: { id: appraisalId },
      data: {
        managerScore,
        managerComment: dto.comment,
        managerStatus: 'SUBMITTED',
        managerSubmittedAt: new Date(),
        finalScore,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    if (appraisal.employee.email) {
      this.publisher
        .notificationAppraisalManagerReviewed({
          tenantId,
          appraisalId,
          cycleTitle: appraisal.cycle.title,
          employeeEmail: appraisal.employee.email,
          employeeFirstName: appraisal.employee.firstName,
          finalScore,
          finalRating,
        })
        .catch((err) =>
          this.logger.error(
            `[appraisal] Failed to publish manager-reviewed event for ${appraisalId}`,
            err,
          ),
        );
    }

    return updated;
  }

  private async saveKpiScores(
    tenantId: string,
    appraisalId: string,
    kpiScores: KpiScoreDto[],
    reviewType: 'SELF' | 'MANAGER',
  ) {
    const uniqueKpiIds = [...new Set(kpiScores.map((ks) => ks.kpiId))];
    if (uniqueKpiIds.length !== kpiScores.length) {
      throw new BadRequestException(
        'Duplicate KPI scores are not allowed in a single submission',
      );
    }

    const appraisal = await this.prisma.appraisal.findFirst({
      where: { id: appraisalId, tenantId },
      select: { cycleId: true },
    });
    if (!appraisal) throw new NotFoundException('Appraisal not found');

    const allowedKpis = await this.prisma.appraisalKpi.findMany({
      where: {
        tenantId,
        cycleId: appraisal.cycleId,
        id: { in: uniqueKpiIds },
      },
      select: { id: true, title: true, maxScore: true },
    });

    if (allowedKpis.length !== uniqueKpiIds.length) {
      throw new BadRequestException(
        'One or more submitted KPIs are invalid for this appraisal',
      );
    }

    const kpiById = new Map(allowedKpis.map((kpi) => [kpi.id, kpi]));
    for (const submitted of kpiScores) {
      const kpi = kpiById.get(submitted.kpiId);
      if (!kpi) {
        throw new BadRequestException(
          'One or more submitted KPIs are invalid for this appraisal',
        );
      }

      if (submitted.score > kpi.maxScore) {
        throw new BadRequestException(
          `Score for "${kpi.title}" cannot exceed its maximum of ${kpi.maxScore}`,
        );
      }
    }

    await this.prisma.$transaction(
      kpiScores.map((ks) =>
        this.prisma.appraisalKpiScore.upsert({
          where: {
            appraisalId_kpiId_reviewType: {
              appraisalId,
              kpiId: ks.kpiId,
              reviewType,
            },
          },
          update: { score: ks.score, comment: ks.comment },
          create: {
            tenantId,
            appraisalId,
            kpiId: ks.kpiId,
            reviewType,
            score: ks.score,
            comment: ks.comment,
          },
        }),
      ),
    );
  }

  private async loadKpiScoresWithKpi(appraisalId: string, reviewType: string) {
    return this.prisma.appraisalKpiScore.findMany({
      where: { appraisalId, reviewType },
      include: { kpi: { select: { weight: true, maxScore: true } } },
    });
  }
}
