import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  HR_PERMISSION_DENY_MESSAGE,
  hasPermissionRule,
  isCompanyAdminUser,
} from '../auth/access-scope';
import { AppraisalObjectivesService } from './appraisal-objectives.service';
import {
  CreateGoalCycleDto,
  ObjectiveRatingDto,
  UpdateGoalCycleDto,
} from './dto/cycle.dto';
import { linkedInCycleWindow, startOfUtcDay } from './objective-window';
import { overallScore, sideScore, type ObjectiveRatings } from './score';

const can = (user: RequestUser, ...rules: string[]) =>
  isCompanyAdminUser(user) || rules.some((r) => hasPermissionRule(user, r));

const isHr = (user: RequestUser) =>
  can(user, 'appraisals:VIEW', 'appraisals:CREATE', 'appraisal-settings:EDIT');
/** Anyone who runs or approves appraisals sees every team review, not just their own reports. */
const reviewsAll = (user: RequestUser) =>
  can(
    user,
    'appraisals:APPROVE',
    'appraisals:CREATE',
    'appraisal-settings:EDIT',
  );

type AssessmentStatus =
  | 'NOT_STARTED'
  | 'SELF_SUBMITTED'
  | 'MANAGER_SUBMITTED'
  | 'FINALIZED';

const cycleInclude = {
  goals: {
    include: {
      goal: {
        select: {
          name: true,
          selfAssessmentWeight: true,
          managerAssessmentWeight: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.AppraisalCycleInclude;

type CycleWithGoals = Prisma.AppraisalCycleGetPayload<{
  include: typeof cycleInclude;
}>;

const day = (date: Date) => date.toISOString().slice(0, 10);

@Injectable()
export class AppraisalGoalCyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectives: AppraisalObjectivesService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Cycles ─────────────────────────────────────────────────────────────────

  private cycleView(cycle: CycleWithGoals) {
    const status =
      cycle.status === 'IN_PROGRESS'
        ? 'ACTIVE'
        : cycle.status === 'COMPLETED'
          ? 'CLOSED'
          : cycle.status;
    return {
      id: cycle.id,
      title: cycle.title,
      description: cycle.description ?? undefined,
      frequency: cycle.frequency ?? '',
      startDate: day(cycle.startDate),
      endDate: day(cycle.endDate),
      selfAssessmentDeadline: cycle.selfAssessmentDeadline
        ? day(cycle.selfAssessmentDeadline)
        : '',
      managerReviewDeadline: cycle.managerReviewDeadline
        ? day(cycle.managerReviewDeadline)
        : '',
      goalIds: cycle.goals.map((g) => g.goalId),
      status,
      cancelledReason: cycle.cancelledReason ?? undefined,
      cancelledAt: cycle.cancelledAt ? day(cycle.cancelledAt) : undefined,
      closedAt: cycle.closedAt ? day(cycle.closedAt) : undefined,
    };
  }

  private async loadCycle(tenantId: string, cycleId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
      include: cycleInclude,
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');
    return cycle;
  }

  /** Cycles made before goals existed ran on templates; they stay as history and cannot be run. */
  private assertRunnable(cycle: CycleWithGoals) {
    if (cycle.goals.length === 0) {
      throw new BadRequestException(
        'This cycle was created from a template and can no longer be run',
      );
    }
  }

  private async assertTitleFree(
    tenantId: string,
    title: string,
    ignoreId?: string,
  ) {
    const clash = await this.prisma.appraisalCycle.findFirst({
      where: {
        tenantId,
        title: { equals: title.trim(), mode: 'insensitive' },
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(
        'An appraisal cycle with this name already exists',
      );
    }
  }

  private validateDates(p: {
    startDate: Date;
    endDate: Date;
    selfAssessmentDeadline: Date;
    managerReviewDeadline: Date;
  }) {
    if (p.endDate < p.startDate) {
      throw new BadRequestException(
        'Cycle end date cannot be before cycle start date',
      );
    }
    if (
      p.selfAssessmentDeadline < p.startDate ||
      p.selfAssessmentDeadline > p.endDate
    ) {
      throw new BadRequestException(
        'Self assessment deadline must fall within the cycle start and end dates',
      );
    }
    if (
      p.managerReviewDeadline <= p.selfAssessmentDeadline ||
      p.managerReviewDeadline > p.endDate
    ) {
      throw new BadRequestException(
        'Manager review deadline must be after self assessment deadline and within the cycle end date',
      );
    }
  }

  private async assertGoalsExist(tenantId: string, goalIds: string[]) {
    const found = await this.prisma.appraisalGoal.count({
      where: { tenantId, id: { in: goalIds } },
    });
    if (found !== new Set(goalIds).size) {
      throw new BadRequestException('One or more goals do not exist');
    }
  }

  async listCycles(tenantId: string) {
    const cycles = await this.prisma.appraisalCycle.findMany({
      where: { tenantId, goals: { some: {} } },
      include: cycleInclude,
      orderBy: { createdAt: 'desc' },
    });
    const appraisals = await this.prisma.appraisal.findMany({
      where: { tenantId, cycleId: { in: cycles.map((c) => c.id) } },
      select: {
        cycleId: true,
        status: true,
        selfStatus: true,
        managerStatus: true,
      },
    });
    return cycles.map((cycle) => {
      const own = appraisals.filter((a) => a.cycleId === cycle.id);
      // Two steps per employee: the self-assessment and the manager's review.
      const done = own.reduce(
        (sum, a) =>
          sum +
          (a.selfStatus === 'SUBMITTED' ? 1 : 0) +
          (a.managerStatus === 'SUBMITTED' ? 1 : 0),
        0,
      );
      return {
        ...this.cycleView(cycle),
        stats: {
          employees: own.length,
          done,
          allApproved:
            own.length > 0 && own.every((a) => a.status === 'COMPLETED'),
        },
      };
    });
  }

  async getCycle(tenantId: string, cycleId: string) {
    return this.cycleView(await this.loadCycle(tenantId, cycleId));
  }

  async createCycle(tenantId: string, userId: string, dto: CreateGoalCycleDto) {
    await this.assertTitleFree(tenantId, dto.title);
    await this.assertGoalsExist(tenantId, dto.goalIds);
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const selfAssessmentDeadline = new Date(dto.selfAssessmentDeadline);
    const managerReviewDeadline = new Date(dto.managerReviewDeadline);
    this.validateDates({
      startDate,
      endDate,
      selfAssessmentDeadline,
      managerReviewDeadline,
    });

    const cycle = await this.prisma.appraisalCycle.create({
      data: {
        tenantId,
        createdBy: userId,
        title: dto.title.trim(),
        description: dto.description,
        frequency: dto.frequency,
        startDate,
        endDate,
        selfAssessmentDeadline,
        managerReviewDeadline,
        status: 'UPCOMING',
        isActive: false,
        goals: {
          create: dto.goalIds.map((goalId) => ({ tenantId, goalId })),
        },
      },
      include: cycleInclude,
    });
    return this.cycleView(cycle);
  }

  async updateCycle(
    tenantId: string,
    cycleId: string,
    dto: UpdateGoalCycleDto,
  ) {
    const cycle = await this.loadCycle(tenantId, cycleId);
    this.assertRunnable(cycle);
    if (cycle.status === 'CANCELLED' || cycle.status === 'CLOSED') {
      throw new BadRequestException(
        'This cycle has ended and cannot be edited',
      );
    }

    const { title, description, ...rest } = dto;
    const started = cycle.status !== 'UPCOMING';
    if (started && Object.values(rest).some((v) => v !== undefined)) {
      throw new BadRequestException(
        'Once a cycle has started only its name and description can change',
      );
    }
    if (title && title.trim().toLowerCase() !== cycle.title.toLowerCase()) {
      await this.assertTitleFree(tenantId, title, cycleId);
    }

    const startDate = rest.startDate
      ? new Date(rest.startDate)
      : cycle.startDate;
    const endDate = rest.endDate ? new Date(rest.endDate) : cycle.endDate;
    const selfAssessmentDeadline = rest.selfAssessmentDeadline
      ? new Date(rest.selfAssessmentDeadline)
      : cycle.selfAssessmentDeadline;
    const managerReviewDeadline = rest.managerReviewDeadline
      ? new Date(rest.managerReviewDeadline)
      : cycle.managerReviewDeadline;
    if (!started) {
      if (!selfAssessmentDeadline || !managerReviewDeadline) {
        throw new BadRequestException('Both deadlines are required');
      }
      this.validateDates({
        startDate,
        endDate,
        selfAssessmentDeadline,
        managerReviewDeadline,
      });
      if (rest.goalIds) await this.assertGoalsExist(tenantId, rest.goalIds);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.appraisalCycle.update({
        where: { id: cycleId },
        data: {
          ...(title ? { title: title.trim() } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(started
            ? {}
            : {
                frequency: rest.frequency ?? cycle.frequency,
                startDate,
                endDate,
                selfAssessmentDeadline,
                managerReviewDeadline,
              }),
        },
      });
      if (!started && rest.goalIds) {
        await tx.appraisalCycleGoal.deleteMany({ where: { cycleId } });
        await tx.appraisalCycleGoal.createMany({
          data: rest.goalIds.map((goalId) => ({ tenantId, cycleId, goalId })),
        });
      }
    });
    return this.getCycle(tenantId, cycleId);
  }

  async deleteCycle(tenantId: string, cycleId: string) {
    const cycle = await this.loadCycle(tenantId, cycleId);
    const expired =
      cycle.status === 'IN_PROGRESS' && cycle.endDate < new Date();
    if (
      cycle.status === 'CLOSED' ||
      (cycle.status === 'IN_PROGRESS' && !expired)
    ) {
      throw new BadRequestException(
        'Only upcoming, expired or cancelled cycles can be deleted',
      );
    }
    await this.prisma.$transaction([
      this.prisma.appraisal.deleteMany({ where: { tenantId, cycleId } }),
      this.prisma.appraisalCycle.delete({ where: { id: cycleId } }),
    ]);
    return { message: 'Cycle deleted' };
  }

  /**
   * Starting copies each goal's name and weights onto the cycle, so editing a goal later never changes it,
   * and makes an assessment for every employee a goal covers who has a counting objective.
   */
  async startCycle(tenantId: string, cycleId: string, actor: RequestUser) {
    const cycle = await this.loadCycle(tenantId, cycleId);
    this.assertRunnable(cycle);
    if (cycle.status !== 'UPCOMING') {
      throw new BadRequestException('Only upcoming cycles can be started');
    }

    const goals = await this.prisma.appraisalGoal.findMany({
      where: { tenantId, id: { in: cycle.goals.map((g) => g.goalId) } },
    });
    const covered = [...new Set(goals.flatMap((g) => g.employeeIds))];
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, id: { in: covered } },
      select: { id: true, userId: true, managerId: true },
    });
    const counting = await this.objectives.employeesWithObjectives(
      tenantId,
      cycle,
      employees.map((e) => e.id),
    );
    const recipients = employees.filter((e) => counting.has(e.id));
    if (recipients.length === 0) {
      throw new BadRequestException(
        'No employee covered by these goals has an objective in this period',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const goal of goals) {
        await tx.appraisalCycleGoal.updateMany({
          where: { cycleId, goalId: goal.id },
          data: {
            goalName: goal.name,
            selfAssessmentWeight: goal.selfAssessmentWeight,
            managerAssessmentWeight: goal.managerAssessmentWeight,
          },
        });
      }
      for (const employee of recipients) {
        await tx.appraisal.upsert({
          where: { cycleId_employeeId: { cycleId, employeeId: employee.id } },
          update: { status: 'IN_PROGRESS', managerId: employee.managerId },
          create: {
            tenantId,
            cycleId,
            employeeId: employee.id,
            managerId: employee.managerId,
            status: 'IN_PROGRESS',
          },
        });
      }
      await tx.appraisalCycle.update({
        where: { id: cycleId },
        data: {
          status: 'IN_PROGRESS',
          isActive: true,
          activatedAt: new Date(),
        },
      });
    });

    const toNotify = recipients.filter((e) => e.userId);
    if (toNotify.length) {
      await this.notifications.createMany(
        toNotify.map((e) => ({
          tenantId,
          userId: e.userId as string,
          type: 'APPRAISAL_CYCLE_STARTED',
          message: `Your appraisal cycle "${cycle.title}" is now active.`,
          link: `/${actor.tenantSlug}/hr/appraisal/cycles/${cycleId}`,
        })),
      );
    }
    return {
      message: `Appraisal cycle started for ${recipients.length} employees`,
      skipped: employees.length - recipients.length,
    };
  }

  /** Ending early brings the end date forward to today, but never before the start. */
  private endedToday(cycle: { startDate: Date; endDate: Date }) {
    const today = new Date(startOfUtcDay(new Date()));
    const on = today < cycle.startDate ? cycle.startDate : today;
    return { on, endDate: cycle.endDate > on ? on : cycle.endDate };
  }

  async closeCycle(tenantId: string, cycleId: string) {
    const cycle = await this.loadCycle(tenantId, cycleId);
    this.assertRunnable(cycle);
    if (cycle.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Only in-progress cycles can be closed');
    }
    const { on, endDate } = this.endedToday(cycle);
    await this.prisma.appraisalCycle.update({
      where: { id: cycleId },
      data: { status: 'CLOSED', isActive: false, closedAt: on, endDate },
    });
    return this.getCycle(tenantId, cycleId);
  }

  /** Cancelling voids the cycle: every assessment and rating in it is deleted. */
  async cancelCycle(tenantId: string, cycleId: string, reason: string) {
    const cycle = await this.loadCycle(tenantId, cycleId);
    this.assertRunnable(cycle);
    if (cycle.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Only in-progress cycles can be cancelled');
    }
    const affected = await this.prisma.appraisal.findMany({
      where: { tenantId, cycleId },
      select: {
        employee: { select: { userId: true } },
        manager: { select: { userId: true } },
      },
    });
    const { on, endDate } = this.endedToday(cycle);
    await this.prisma.$transaction([
      this.prisma.appraisal.deleteMany({ where: { tenantId, cycleId } }),
      this.prisma.appraisalCycle.update({
        where: { id: cycleId },
        data: {
          status: 'CANCELLED',
          isActive: false,
          cancelledAt: on,
          cancelledReason: reason,
          endDate,
        },
      }),
    ]);

    const userIds = new Set(
      affected
        .flatMap((a) => [a.employee.userId, a.manager?.userId])
        .filter((id): id is string => !!id),
    );
    if (userIds.size) {
      await this.notifications.createMany(
        [...userIds].map((userId) => ({
          tenantId,
          userId,
          type: 'APPRAISAL_CYCLE_CANCELLED',
          message: `The appraisal cycle "${cycle.title}" was cancelled. Reason: ${reason}`,
        })),
      );
    }
    return { message: 'Cycle cancelled' };
  }

  // ── Assessments ────────────────────────────────────────────────────────────

  private async viewsFor(
    tenantId: string,
    appraisals: Prisma.AppraisalGetPayload<object>[],
  ) {
    if (appraisals.length === 0) return [];
    const cycleIds = [...new Set(appraisals.map((a) => a.cycleId))];
    const cycles = await this.prisma.appraisalCycle.findMany({
      where: { tenantId, id: { in: cycleIds } },
      include: cycleInclude,
    });
    const scores = await this.prisma.appraisalObjectiveScore.findMany({
      where: { tenantId, appraisalId: { in: appraisals.map((a) => a.id) } },
    });
    const objectives = await this.prisma.appraisalObjective.findMany({
      where: {
        tenantId,
        OR: [
          {
            employeeId: {
              in: [...new Set(appraisals.map((a) => a.employeeId))],
            },
            goalId: {
              in: cycles.flatMap((c) => c.goals.map((g) => g.goalId)),
            },
          },
          { id: { in: appraisals.flatMap((a) => a.objectiveIds) } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    return appraisals.map((a) => {
      const cycle = cycles.find((c) => c.id === a.cycleId);
      const mine = scores.filter((s) => s.appraisalId === a.id);
      const ratingsOf = (type: string) =>
        Object.fromEntries(
          mine
            .filter((s) => s.reviewType === type)
            .map((s) => [
              s.objectiveId,
              { score: s.score, comment: s.comment ?? '' },
            ]),
        );
      const frozen = a.objectiveIds.length > 0;
      const entries = (cycle?.goals ?? [])
        .map((cg) => ({
          goal: {
            id: cg.goalId,
            name: cg.goalName ?? cg.goal.name,
            selfAssessmentWeight:
              cg.selfAssessmentWeight ?? cg.goal.selfAssessmentWeight,
            managerAssessmentWeight:
              cg.managerAssessmentWeight ?? cg.goal.managerAssessmentWeight,
          },
          objectives: objectives
            .filter(
              (o) =>
                o.goalId === cg.goalId &&
                (frozen
                  ? a.objectiveIds.includes(o.id)
                  : o.employeeId === a.employeeId &&
                    !!cycle &&
                    linkedInCycleWindow(o.linkedAt, cycle)),
            )
            .map((o) => ({ id: o.id, name: o.name })),
        }))
        .filter((e) => e.objectives.length > 0);

      const status: AssessmentStatus =
        a.status === 'COMPLETED'
          ? 'FINALIZED'
          : a.managerStatus === 'SUBMITTED'
            ? 'MANAGER_SUBMITTED'
            : a.selfStatus === 'SUBMITTED'
              ? 'SELF_SUBMITTED'
              : 'NOT_STARTED';
      return {
        id: a.id,
        cycleId: a.cycleId,
        employeeId: a.employeeId,
        managerId: a.managerId,
        status,
        selfRatings: ratingsOf('SELF'),
        managerRatings: ratingsOf('MANAGER'),
        managerComment: a.managerComment ?? undefined,
        hrComment: a.finalizationNote ?? undefined,
        rejectionReason:
          a.selfStatus === 'SUBMITTED' &&
          a.managerStatus === 'PENDING' &&
          a.reopenReason
            ? a.reopenReason
            : undefined,
        entries,
      };
    });
  }

  private async actorEmployeeId(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { tenantId, userId },
      select: { id: true },
    });
    return employee?.id ?? null;
  }

  async listAssessments(tenantId: string, actor: RequestUser, cycleId: string) {
    if (!isHr(actor)) throw new ForbiddenException(HR_PERMISSION_DENY_MESSAGE);
    const appraisals = await this.prisma.appraisal.findMany({
      where: { tenantId, cycleId },
    });
    return this.viewsFor(tenantId, appraisals);
  }

  async myAssessments(tenantId: string, actor: RequestUser) {
    const employeeId = await this.actorEmployeeId(tenantId, actor.id);
    if (!employeeId) return [];
    const appraisals = await this.prisma.appraisal.findMany({
      where: { tenantId, employeeId, cycle: { goals: { some: {} } } },
      orderBy: { createdAt: 'desc' },
    });
    return this.viewsFor(tenantId, appraisals);
  }

  /** A person's finished and in-progress assessments, for HR or for the person themselves. */
  async employeeAssessments(
    tenantId: string,
    actor: RequestUser,
    employeeId: string,
  ) {
    const own = (await this.actorEmployeeId(tenantId, actor.id)) === employeeId;
    if (!own && !isHr(actor)) {
      throw new ForbiddenException(HR_PERMISSION_DENY_MESSAGE);
    }
    const appraisals = await this.prisma.appraisal.findMany({
      where: { tenantId, employeeId, cycle: { goals: { some: {} } } },
      orderBy: { createdAt: 'desc' },
    });
    return this.viewsFor(tenantId, appraisals);
  }

  async teamAssessments(tenantId: string, actor: RequestUser) {
    const employeeId = await this.actorEmployeeId(tenantId, actor.id);
    const appraisals = await this.prisma.appraisal.findMany({
      where: {
        tenantId,
        selfStatus: 'SUBMITTED',
        cycle: { goals: { some: {} } },
        ...(reviewsAll(actor) ? {} : { managerId: employeeId ?? '__none__' }),
      },
      orderBy: { createdAt: 'desc' },
    });
    return this.viewsFor(tenantId, appraisals);
  }

  private async loadAppraisal(tenantId: string, appraisalId: string) {
    const appraisal = await this.prisma.appraisal.findFirst({
      where: { id: appraisalId, tenantId },
      include: { cycle: { include: cycleInclude } },
    });
    if (!appraisal) throw new NotFoundException('Appraisal not found');
    return appraisal;
  }

  async getAssessment(
    tenantId: string,
    actor: RequestUser,
    appraisalId: string,
  ) {
    const appraisal = await this.loadAppraisal(tenantId, appraisalId);
    const me = await this.actorEmployeeId(tenantId, actor.id);
    const allowed =
      isHr(actor) ||
      reviewsAll(actor) ||
      me === appraisal.employeeId ||
      me === appraisal.managerId;
    if (!allowed) throw new ForbiddenException(HR_PERMISSION_DENY_MESSAGE);
    const { cycle: _cycle, ...row } = appraisal;
    void _cycle;
    return (await this.viewsFor(tenantId, [row]))[0];
  }

  private assertOpen(cycle: CycleWithGoals) {
    if (cycle.status !== 'IN_PROGRESS' && cycle.status !== 'CLOSED') {
      throw new BadRequestException('This cycle is not accepting reviews');
    }
  }

  private toRatings(ratings: ObjectiveRatingDto[]): ObjectiveRatings {
    return Object.fromEntries(ratings.map((r) => [r.objectiveId, r]));
  }

  async submitSelf(
    tenantId: string,
    actor: RequestUser,
    appraisalId: string,
    ratings: ObjectiveRatingDto[],
  ) {
    const appraisal = await this.loadAppraisal(tenantId, appraisalId);
    this.assertOpen(appraisal.cycle);
    const me = await this.actorEmployeeId(tenantId, actor.id);
    if (me !== appraisal.employeeId) {
      throw new ForbiddenException(HR_PERMISSION_DENY_MESSAGE);
    }
    if (appraisal.selfStatus === 'SUBMITTED') {
      throw new ConflictException('The self-assessment was already submitted');
    }

    const counting = await this.objectives.forCycle(
      tenantId,
      appraisal.cycleId,
      appraisal.employeeId,
    );
    const ids = ratings.map((r) => r.objectiveId);
    await this.objectives.assertRateable(
      tenantId,
      appraisal.cycleId,
      appraisal.employeeId,
      ids,
    );
    if (counting.some((o) => !ids.includes(o.id))) {
      throw new BadRequestException('Every objective needs a rating');
    }

    const selfScore = sideScore(
      [
        {
          goal: { selfAssessmentWeight: 0, managerAssessmentWeight: 0 },
          objectives: counting,
        },
      ],
      this.toRatings(ratings),
    );
    await this.prisma.$transaction(async (tx) => {
      await this.saveScores(tx, tenantId, appraisalId, 'SELF', ratings);
      await tx.appraisal.update({
        where: { id: appraisalId },
        data: {
          objectiveIds: ids,
          selfStatus: 'SUBMITTED',
          selfSubmittedAt: new Date(),
          selfScore,
        },
      });
    });
    return this.getAssessment(tenantId, actor, appraisalId);
  }

  async submitManager(
    tenantId: string,
    actor: RequestUser,
    appraisalId: string,
    ratings: ObjectiveRatingDto[],
    comment?: string,
  ) {
    const appraisal = await this.loadAppraisal(tenantId, appraisalId);
    this.assertOpen(appraisal.cycle);
    const me = await this.actorEmployeeId(tenantId, actor.id);
    if (me !== appraisal.managerId && !reviewsAll(actor)) {
      throw new ForbiddenException(HR_PERMISSION_DENY_MESSAGE);
    }
    if (appraisal.selfStatus !== 'SUBMITTED') {
      throw new BadRequestException('The employee has not submitted yet');
    }
    if (appraisal.managerStatus === 'SUBMITTED') {
      throw new ConflictException('The review was already submitted');
    }
    const frozen = appraisal.objectiveIds;
    const ids = ratings.map((r) => r.objectiveId);
    if (
      ids.length !== frozen.length ||
      frozen.some((id) => !ids.includes(id))
    ) {
      throw new BadRequestException(
        'Rate exactly the objectives the employee rated',
      );
    }

    const view = (await this.viewsFor(tenantId, [appraisal]))[0];
    const managerRatings = this.toRatings(ratings);
    const managerScore = sideScore(view.entries, managerRatings);
    const finalScore = overallScore(
      view.entries,
      view.selfRatings,
      managerRatings,
    );
    await this.prisma.$transaction(async (tx) => {
      await this.saveScores(tx, tenantId, appraisalId, 'MANAGER', ratings);
      await tx.appraisal.update({
        where: { id: appraisalId },
        data: {
          status: 'PENDING_FINALIZATION',
          managerStatus: 'SUBMITTED',
          managerSubmittedAt: new Date(),
          managerComment: comment?.trim() || null,
          managerScore,
          finalScore,
        },
      });
    });
    return this.getAssessment(tenantId, actor, appraisalId);
  }

  /** Approving the last open assessment closes the cycle by itself. */
  async finalize(
    tenantId: string,
    actor: RequestUser,
    appraisalId: string,
    note?: string,
  ) {
    const appraisal = await this.loadAppraisal(tenantId, appraisalId);
    if (appraisal.status !== 'PENDING_FINALIZATION') {
      throw new BadRequestException('This review is not waiting for approval');
    }
    await this.prisma.appraisal.update({
      where: { id: appraisalId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        finalizedAt: new Date(),
        finalizedBy: actor.id,
        finalizationNote: note?.trim() || null,
      },
    });
    const open = await this.prisma.appraisal.count({
      where: {
        tenantId,
        cycleId: appraisal.cycleId,
        status: { not: 'COMPLETED' },
      },
    });
    if (open === 0 && appraisal.cycle.status === 'IN_PROGRESS') {
      await this.closeCycle(tenantId, appraisal.cycleId);
    }
    return this.getAssessment(tenantId, actor, appraisalId);
  }

  private async saveScores(
    tx: Prisma.TransactionClient,
    tenantId: string,
    appraisalId: string,
    reviewType: 'SELF' | 'MANAGER',
    ratings: ObjectiveRatingDto[],
  ) {
    for (const r of ratings) {
      await tx.appraisalObjectiveScore.upsert({
        where: {
          appraisalId_objectiveId_reviewType: {
            appraisalId,
            objectiveId: r.objectiveId,
            reviewType,
          },
        },
        update: { score: r.score, comment: r.comment?.trim() || null },
        create: {
          tenantId,
          appraisalId,
          objectiveId: r.objectiveId,
          reviewType,
          score: r.score,
          comment: r.comment?.trim() || null,
        },
      });
    }
  }
}
