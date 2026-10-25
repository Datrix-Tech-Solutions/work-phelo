import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppraisalGoalDto, UpdateAppraisalGoalDto } from './dto/goal.dto';

@Injectable()
export class AppraisalGoalsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(tenantId: string, userId: string, dto: CreateAppraisalGoalDto) {
    const name = dto.name.trim();
    await this.assertNameFree(tenantId, name);
    return this.prisma.appraisalGoal.create({
      data: {
        tenantId,
        name,
        selfAssessmentWeight: dto.selfAssessmentWeight,
        managerAssessmentWeight: 100 - dto.selfAssessmentWeight,
        employeeIds: dto.employeeIds ?? [],
        createdBy: userId,
      },
    });
  }

  async update(tenantId: string, goalId: string, dto: UpdateAppraisalGoalDto) {
    const goal = await this.prisma.appraisalGoal.findFirst({
      where: { id: goalId, tenantId },
    });
    if (!goal) throw new NotFoundException('Goal not found');

    const name = dto.name?.trim();
    if (name && name.toLowerCase() !== goal.name.toLowerCase()) {
      await this.assertNameFree(tenantId, name, goalId);
    }
    return this.prisma.appraisalGoal.update({
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
