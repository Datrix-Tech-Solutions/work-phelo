import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAppraisalGroupDto,
  GroupGoalDto,
  UpdateAppraisalGroupDto,
} from './dto/group.dto';

const groupInclude = {
  goals: { orderBy: { id: 'asc' } },
} satisfies Prisma.AppraisalGroupInclude;

type GroupRow = Prisma.AppraisalGroupGetPayload<{
  include: typeof groupInclude;
}>;

@Injectable()
export class AppraisalGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  private view(group: GroupRow, inCycle: boolean) {
    return {
      id: group.id,
      name: group.name,
      employeeIds: group.employeeIds,
      goals: group.goals.map((g) => ({ goalId: g.goalId, weight: g.weight })),
      inCycle,
    };
  }

  private async assertNameFree(
    tenantId: string,
    name: string,
    ignoreId?: string,
  ) {
    const clash = await this.prisma.appraisalGroup.findFirst({
      where: {
        tenantId,
        name: { equals: name, mode: 'insensitive' },
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException('A group with this name already exists');
    }
  }

  /** The goals exist, none is listed twice and the weights total 100. */
  private async assertGoals(tenantId: string, goals: GroupGoalDto[]) {
    const ids = goals.map((g) => g.goalId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('A goal is listed more than once');
    }
    const found = await this.prisma.appraisalGoal.count({
      where: { tenantId, id: { in: ids } },
    });
    if (found !== ids.length) {
      throw new BadRequestException('One or more goals do not exist');
    }
    if (goals.reduce((sum, g) => sum + g.weight, 0) !== 100) {
      throw new BadRequestException('The goal weights must total 100');
    }
  }

  private async assertEmployees(tenantId: string, employeeIds: string[]) {
    const found = await this.prisma.employee.count({
      where: { tenantId, id: { in: employeeIds } },
    });
    if (found !== new Set(employeeIds).size) {
      throw new BadRequestException('One or more employees do not exist');
    }
  }

  async list(tenantId: string) {
    const groups = await this.prisma.appraisalGroup.findMany({
      where: { tenantId },
      include: { ...groupInclude, _count: { select: { cycleGroups: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return groups.map(({ _count, ...group }) =>
      this.view(group, _count.cycleGroups > 0),
    );
  }

  async create(tenantId: string, userId: string, dto: CreateAppraisalGroupDto) {
    const name = dto.name.trim();
    await this.assertNameFree(tenantId, name);
    await this.assertGoals(tenantId, dto.goals);
    await this.assertEmployees(tenantId, dto.employeeIds);
    const group = await this.prisma.appraisalGroup.create({
      data: {
        tenantId,
        name,
        employeeIds: dto.employeeIds,
        createdBy: userId,
        goals: {
          create: dto.goals.map((g) => ({
            tenantId,
            goalId: g.goalId,
            weight: g.weight,
          })),
        },
      },
      include: groupInclude,
    });
    return this.view(group, false);
  }

  async update(
    tenantId: string,
    groupId: string,
    dto: UpdateAppraisalGroupDto,
  ) {
    const group = await this.prisma.appraisalGroup.findFirst({
      where: { id: groupId, tenantId },
      select: { id: true, name: true },
    });
    if (!group) throw new NotFoundException('Group not found');

    const name = dto.name?.trim();
    if (name && name.toLowerCase() !== group.name.toLowerCase()) {
      await this.assertNameFree(tenantId, name, groupId);
    }
    if (dto.goals) await this.assertGoals(tenantId, dto.goals);
    if (dto.employeeIds) {
      await this.assertEmployees(tenantId, dto.employeeIds);
    }

    // A cycle copies the group when it starts, so a running cycle is unaffected by this edit.
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.goals) {
        await tx.appraisalGroupGoal.deleteMany({ where: { groupId } });
        await tx.appraisalGroupGoal.createMany({
          data: dto.goals.map((g) => ({
            tenantId,
            groupId,
            goalId: g.goalId,
            weight: g.weight,
          })),
        });
      }
      return tx.appraisalGroup.update({
        where: { id: groupId },
        data: {
          ...(name ? { name } : {}),
          ...(dto.employeeIds ? { employeeIds: dto.employeeIds } : {}),
        },
        include: groupInclude,
      });
    });
    const inCycle = await this.prisma.appraisalCycleGroup.count({
      where: { tenantId, groupId },
    });
    return this.view(updated, inCycle > 0);
  }

  async remove(tenantId: string, groupId: string) {
    const group = await this.prisma.appraisalGroup.findFirst({
      where: { id: groupId, tenantId },
      select: { id: true },
    });
    if (!group) throw new NotFoundException('Group not found');
    const inCycle = await this.prisma.appraisalCycleGroup.count({
      where: { tenantId, groupId },
    });
    if (inCycle > 0) {
      throw new ConflictException(
        'This group is part of a cycle and cannot be deleted',
      );
    }
    await this.prisma.appraisalGroup.delete({ where: { id: groupId } });
    return { deleted: true };
  }
}
