import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../prisma/generated/client';
import { RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  HR_PERMISSION_DENY_MESSAGE,
  hasPermissionRule,
  isCompanyAdminUser,
} from '../auth/access-scope';
import { cycleWindowBounds, type CycleWindow } from './objective-window';
import {
  CreateAppraisalObjectiveDto,
  CreateGoalObjectivesDto,
  GoalObjectiveInputDto,
  LinkAppraisalObjectiveDto,
} from './dto/objective.dto';

const can = (user: RequestUser, ...rules: string[]) =>
  isCompanyAdminUser(user) || rules.some((r) => hasPermissionRule(user, r));

@Injectable()
export class AppraisalObjectivesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Who may add or change objectives for an employee: the employee themselves (create:own_objective),
   * HR, or a team reviewer for their own reports (create:objective_for_others; appraisal-reviews:EDIT is enough).
   */
  private async assertCanActFor(
    tenantId: string,
    actor: RequestUser,
    employeeId: string,
  ) {
    const target = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      select: { id: true, userId: true, managerId: true },
    });
    if (!target) throw new NotFoundException('Employee not found');

    if (target.userId === actor.id) {
      if (!can(actor, 'self-appraisals:CREATE')) {
        throw new ForbiddenException(HR_PERMISSION_DENY_MESSAGE);
      }
      return target;
    }

    if (!can(actor, 'appraisal-reviews:CREATE', 'appraisal-reviews:EDIT')) {
      throw new ForbiddenException(HR_PERMISSION_DENY_MESSAGE);
    }
    const isHr = can(actor, 'appraisals:CREATE', 'appraisal-settings:EDIT');
    if (!isHr) {
      const actorEmployee = await this.prisma.employee.findFirst({
        where: { tenantId, userId: actor.id },
        select: { id: true },
      });
      if (!actorEmployee || target.managerId !== actorEmployee.id) {
        throw new ForbiddenException(HR_PERMISSION_DENY_MESSAGE);
      }
    }
    return target;
  }

  private async assertGoal(tenantId: string, goalId: string) {
    const goal = await this.prisma.appraisalGoal.findFirst({
      where: { id: goalId, tenantId },
      select: { id: true },
    });
    if (!goal) throw new NotFoundException('Goal not found');
  }

  async create(
    tenantId: string,
    actor: RequestUser,
    dto: CreateAppraisalObjectiveDto,
  ) {
    const employeeId =
      dto.employeeId ??
      (
        await this.prisma.employee.findFirst({
          where: { tenantId, userId: actor.id },
          select: { id: true },
        })
      )?.id;
    if (!employeeId) throw new NotFoundException('Employee profile not found');

    await this.assertCanActFor(tenantId, actor, employeeId);
    if (dto.goalId) await this.assertGoal(tenantId, dto.goalId);

    return this.prisma.appraisalObjective.create({
      data: {
        tenantId,
        employeeId,
        goalId: dto.goalId ?? null,
        name: dto.name.trim(),
        createdBy: actor.id,
        linkedAt: dto.goalId ? new Date() : null,
        comments: {
          create: (dto.comments ?? [])
            .map((body) => body.trim())
            .filter(Boolean)
            .map((body) => ({ tenantId, body, createdBy: actor.id })),
        },
      },
      include: { comments: true },
    });
  }

  async listForEmployee(
    tenantId: string,
    actor: RequestUser,
    employeeId: string,
  ) {
    const target = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      select: { userId: true },
    });
    if (!target) throw new NotFoundException('Employee not found');
    if (target.userId !== actor.id && !can(actor, 'appraisals:VIEW')) {
      await this.assertCanActFor(tenantId, actor, employeeId);
    }
    const objectives = await this.prisma.appraisalObjective.findMany({
      where: { tenantId, employeeId },
      include: {
        comments: { orderBy: { createdAt: 'asc' } },
        goal: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return this.withCreatorNames(tenantId, objectives);
  }

  /** createdBy is a user id; show the person's name. */
  private async withCreatorNames<T extends { createdBy: string }>(
    tenantId: string,
    objectives: T[],
  ) {
    const creators = await this.prisma.employee.findMany({
      where: {
        tenantId,
        userId: { in: [...new Set(objectives.map((o) => o.createdBy))] },
      },
      select: { userId: true, firstName: true, lastName: true },
    });
    const nameOf = new Map(
      creators.map((c) => [c.userId, `${c.firstName} ${c.lastName}`]),
    );
    return objectives.map((o) => ({
      ...o,
      createdByName: nameOf.get(o.createdBy) ?? 'Administrator',
    }));
  }

  /** Every objective under a goal, across its employees, for the goal's details page. */
  async listForGoal(tenantId: string, goalId: string) {
    await this.assertGoal(tenantId, goalId);
    const objectives = await this.prisma.appraisalObjective.findMany({
      where: { tenantId, goalId },
      include: {
        comments: { orderBy: { createdAt: 'asc' } },
        goal: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return this.withCreatorNames(tenantId, objectives);
  }

  /**
   * Check a set of objectives, each with its own employees, can be set under a goal, and expand
   * them into one assignment per employee and objective. Nothing is written. Two objectives with the
   * same name that share an employee give that employee it once.
   */
  async resolveAssignments(
    tenantId: string,
    actor: RequestUser,
    goalEmployeeIds: string[],
    drafts: GoalObjectiveInputDto[],
  ) {
    const onGoal = new Set(goalEmployeeIds);
    const seen = new Set<string>();
    const assignments: { employeeId: string; name: string }[] = [];
    for (const draft of drafts) {
      const name = draft.name.trim();
      if (!name) throw new BadRequestException('An objective needs a name');
      for (const employeeId of draft.employeeIds) {
        if (!onGoal.has(employeeId)) {
          throw new BadRequestException(
            'Objectives can only be given to employees on the goal',
          );
        }
        const id = `${employeeId}:${name.toLowerCase()}`;
        if (seen.has(id)) continue;
        seen.add(id);
        assignments.push({ employeeId, name });
      }
    }

    // Every person it is for must be one the caller may set objectives for.
    const people = [...new Set(assignments.map((a) => a.employeeId))];
    await Promise.all(
      people.map((employeeId) =>
        this.assertCanActFor(tenantId, actor, employeeId),
      ),
    );
    return assignments;
  }

  /** The rows to insert for resolved assignments under a goal. */
  objectiveRows(
    tenantId: string,
    actor: RequestUser,
    goalId: string,
    assignments: { employeeId: string; name: string }[],
  ): Prisma.AppraisalObjectiveCreateManyInput[] {
    const linkedAt = new Date();
    return assignments.map((a) => ({
      tenantId,
      employeeId: a.employeeId,
      goalId,
      name: a.name,
      createdBy: actor.id,
      linkedAt,
    }));
  }

  /** Set several objectives under an existing goal, each for its own employees, in one go. */
  async createForGoal(
    tenantId: string,
    actor: RequestUser,
    dto: CreateGoalObjectivesDto,
  ) {
    const goal = await this.prisma.appraisalGoal.findFirst({
      where: { id: dto.goalId, tenantId },
      select: { id: true, employeeIds: true },
    });
    if (!goal) throw new NotFoundException('Goal not found');

    const assignments = await this.resolveAssignments(
      tenantId,
      actor,
      goal.employeeIds,
      dto.objectives,
    );
    const { count } = await this.prisma.appraisalObjective.createMany({
      data: this.objectiveRows(tenantId, actor, goal.id, assignments),
    });
    return { created: count };
  }

  /**
   * Link the objective to a goal (or unlink with no goalId). The date it is linked is the date cycles
   * compare against. Once it has been rated its goal can no longer change.
   */
  async link(
    tenantId: string,
    actor: RequestUser,
    objectiveId: string,
    dto: LinkAppraisalObjectiveDto,
  ) {
    const objective = await this.prisma.appraisalObjective.findFirst({
      where: { id: objectiveId, tenantId },
      include: { _count: { select: { scores: true } } },
    });
    if (!objective) throw new NotFoundException('Objective not found');
    await this.assertCanActFor(tenantId, actor, objective.employeeId);

    if (objective._count.scores > 0) {
      throw new ConflictException(
        'This objective has been rated, so its goal can no longer change',
      );
    }
    const goalId = dto.goalId ?? null;
    if (goalId) await this.assertGoal(tenantId, goalId);
    if (goalId === objective.goalId) return objective;

    return this.prisma.appraisalObjective.update({
      where: { id: objectiveId },
      data: { goalId, linkedAt: goalId ? new Date() : null },
    });
  }

  async addComment(
    tenantId: string,
    actor: RequestUser,
    objectiveId: string,
    body: string,
  ) {
    const objective = await this.prisma.appraisalObjective.findFirst({
      where: { id: objectiveId, tenantId },
      select: { employeeId: true },
    });
    if (!objective) throw new NotFoundException('Objective not found');
    await this.assertCanActFor(tenantId, actor, objective.employeeId);
    return this.prisma.appraisalObjectiveComment.create({
      data: { tenantId, objectiveId, body: body.trim(), createdBy: actor.id },
    });
  }

  /** An employee's objectives that count for a cycle: under one of its goals and linked while its dates were running. */
  async forCycle(tenantId: string, cycleId: string, employeeId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
      include: { goals: { select: { goalId: true } } },
    });
    if (!cycle) throw new NotFoundException('Cycle not found');
    const { from, to } = cycleWindowBounds(cycle);
    return this.prisma.appraisalObjective.findMany({
      where: {
        tenantId,
        employeeId,
        goalId: { in: cycle.goals.map((g) => g.goalId) },
        linkedAt: { gte: from, lt: to },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Which of these employees have at least one objective that counts for the cycle. */
  async employeesWithObjectives(
    tenantId: string,
    cycle: CycleWindow & { goals: { goalId: string }[] },
    employeeIds: string[],
  ) {
    const { from, to } = cycleWindowBounds(cycle);
    const rows = await this.prisma.appraisalObjective.findMany({
      where: {
        tenantId,
        employeeId: { in: employeeIds },
        goalId: { in: cycle.goals.map((g) => g.goalId) },
        linkedAt: { gte: from, lt: to },
      },
      select: { employeeId: true },
      distinct: ['employeeId'],
    });
    return new Set(rows.map((r) => r.employeeId));
  }

  /** The database cannot see the cycle's dates, so every rating goes through here first. */
  async assertRateable(
    tenantId: string,
    cycleId: string,
    employeeId: string,
    objectiveIds: string[],
  ) {
    const allowed = new Set(
      (await this.forCycle(tenantId, cycleId, employeeId)).map((o) => o.id),
    );
    const outside = objectiveIds.filter((id) => !allowed.has(id));
    if (outside.length > 0) {
      throw new BadRequestException(
        'Some objectives do not count for this cycle',
      );
    }
  }
}
