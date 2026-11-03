import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AppraisalObjectivesService } from './appraisal-objectives.service';
import { CreateAppraisalGoalDto, UpdateAppraisalGoalDto } from './dto/goal.dto';

@Injectable()
export class AppraisalGoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectives: AppraisalObjectivesService,
  ) {}

  private async assertNameFree(
    tenantId: string,
    name: string,
    ignoreId?: string,
  ) {
    const clash = await this.prisma.appraisalGoal.findFirst({
      where: {
        tenantId,
        name: { equals: name, mode: 'insensitive' },
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException('A goal with this name already exists');
    }
  }

  async list(tenantId: string) {
    const goals = await this.prisma.appraisalGoal.findMany({
      where: { tenantId },
      include: { _count: { select: { cycleGoals: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return goals.map(({ _count, ...goal }) => ({
      ...goal,
      managerAssessmentWeight: goal.managerAssessmentWeight,
      inCycle: _count.cycleGoals > 0,
    }));
  }

  /**
   * Creates the goal and, when given, its objectives together: the checks run first, then everything
   * is written in one transaction, so a goal never ends up with only some of its objectives.
   */
  async create(
    tenantId: string,
    actor: RequestUser,
    dto: CreateAppraisalGoalDto,
  ) {
    const name = dto.name.trim();
    await this.assertNameFree(tenantId, name);
    const employeeIds = dto.employeeIds ?? [];
    const assignments = dto.objectives?.length
      ? await this.objectives.resolveAssignments(
          tenantId,
          actor,
          employeeIds,
          dto.objectives,
        )
      : [];

    return this.prisma.$transaction(async (tx) => {
      const goal = await tx.appraisalGoal.create({
        data: {
          tenantId,
          name,
          selfAssessmentWeight: dto.selfAssessmentWeight,
          managerAssessmentWeight: 100 - dto.selfAssessmentWeight,
          employeeIds,
          createdBy: actor.id,
        },
      });
      if (assignments.length > 0) {
        await tx.appraisalObjective.createMany({
          data: this.objectives.objectiveRows(
            tenantId,
            actor,
            goal.id,
            assignments,
          ),
        });
      }
      return goal;
    });
  }

  /** New objectives given on an update are added; the ones the goal already has are left alone. */
  async update(
    tenantId: string,
    actor: RequestUser,
    goalId: string,
    dto: UpdateAppraisalGoalDto,
  ) {
    const goal = await this.prisma.appraisalGoal.findFirst({
      where: { id: goalId, tenantId },
    });
    if (!goal) throw new NotFoundException('Goal not found');

    const name = dto.name?.trim();
    if (name && name.toLowerCase() !== goal.name.toLowerCase()) {
      await this.assertNameFree(tenantId, name, goalId);
    }
    // Objectives can go to anyone on the goal once this update has been applied.
    const assignments = dto.objectives?.length
      ? await this.objectives.resolveAssignments(
          tenantId,
          actor,
          dto.employeeIds ?? goal.employeeIds,
          dto.objectives,
        )
      : [];

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.appraisalGoal.update({
        where: { id: goalId },
        data: {
          ...(name ? { name } : {}),
          ...(dto.selfAssessmentWeight !== undefined
            ? {
                selfAssessmentWeight: dto.selfAssessmentWeight,
                managerAssessmentWeight: 100 - dto.selfAssessmentWeight,
              }
            : {}),
          ...(dto.employeeIds ? { employeeIds: dto.employeeIds } : {}),
        },
      });
      if (assignments.length > 0) {
        await tx.appraisalObjective.createMany({
          data: this.objectives.objectiveRows(
            tenantId,
            actor,
            goalId,
            assignments,
          ),
        });
      }
      return updated;
    });
  }

  /**
   * A goal that is in a cycle cannot be deleted. Otherwise its objectives are kept but orphaned:
   * the goal and the date they were linked are cleared together, since linkedAt means nothing without a goal.
   */
  async remove(tenantId: string, goalId: string) {
    const goal = await this.prisma.appraisalGoal.findFirst({
      where: { id: goalId, tenantId },
      select: { id: true },
    });
    if (!goal) throw new NotFoundException('Goal not found');

    const inCycle = await this.prisma.appraisalCycleGoal.count({
      where: { tenantId, goalId },
    });
    if (inCycle > 0) {
      throw new ConflictException(
        'This goal is part of a cycle and cannot be deleted',
      );
    }

    await this.prisma.$transaction([
      this.prisma.appraisalObjective.updateMany({
        where: { tenantId, goalId },
        data: { goalId: null, linkedAt: null },
      }),
      this.prisma.appraisalGoal.delete({ where: { id: goalId } }),
    ]);
    return { deleted: true };
  }
}
