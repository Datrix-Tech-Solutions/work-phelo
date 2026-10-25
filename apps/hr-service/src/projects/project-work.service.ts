import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { HR_PERMISSION_DENY_MESSAGE } from '../auth/access-scope';
import {
  CompleteSprintDto,
  CreateSubtaskDto,
  ObjectiveDto,
  SprintDto,
  UpdateSubtaskDto,
} from './dto/project-work.dto';
import { ProjectsService } from './projects.service';

const day = (value: Date | null) => value?.toISOString().slice(0, 10);

type SprintWithTasks = Prisma.ProjectSprintGetPayload<{
  include: { tasks: { select: { id: true } } };
}>;

/** Objectives, subtasks and sprints: how a project's tasks are grouped and broken down. */
@Injectable()
export class ProjectWorkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  private serializeSprint(sprint: SprintWithTasks) {
    const { tasks, startDate, endDate, completedAt, ...rest } = sprint;
    return {
      ...rest,
      startDate: day(startDate),
      endDate: day(endDate),
      completedAt: day(completedAt),
      taskIds: tasks.map((t) => t.id),
    };
  }

  private async requireManage(
    tenantId: string,
    projectId: string,
    user: RequestUser,
  ) {
    const access = await this.projects.getWorkAccess(tenantId, projectId, user);
    if (!access.canManage)
      throw new ForbiddenException(HR_PERMISSION_DENY_MESSAGE);
    return access;
  }

  /** Every given task must be in the project. */
  private async assertTasksInProject(
    tenantId: string,
    projectId: string,
    taskIds: string[],
  ) {
    if (taskIds.length === 0) return;
    const count = await this.prisma.projectTask.count({
      where: { tenantId, projectId, id: { in: taskIds } },
    });
    if (count !== taskIds.length) {
      throw new BadRequestException('A task does not belong to this project');
    }
  }

  // ── Objectives ──────────────────────────────────────────────────────

  async listObjectives(tenantId: string, projectId: string, user: RequestUser) {
    await this.projects.assertCanView(tenantId, projectId, user);
    return this.prisma.projectObjective.findMany({
      where: { tenantId, projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createObjective(
    tenantId: string,
    projectId: string,
    user: RequestUser,
    dto: ObjectiveDto,
  ) {
    await this.requireManage(tenantId, projectId, user);
    return this.prisma.projectObjective.create({
      data: {
        tenantId,
        projectId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
      },
    });
  }

  async updateObjective(
    tenantId: string,
    projectId: string,
    objectiveId: string,
    user: RequestUser,
    dto: ObjectiveDto,
  ) {
    await this.requireManage(tenantId, projectId, user);
    await this.findObjective(tenantId, projectId, objectiveId);
    return this.prisma.projectObjective.update({
      where: { id: objectiveId },
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
      },
    });
  }

  /** Removes the objective; its tasks stay, directly under the project. */
  async removeObjective(
    tenantId: string,
    projectId: string,
    objectiveId: string,
    user: RequestUser,
  ) {
    await this.requireManage(tenantId, projectId, user);
    await this.findObjective(tenantId, projectId, objectiveId);
    await this.prisma.projectObjective.delete({ where: { id: objectiveId } });
    return { message: 'Objective deleted successfully' };
  }

  private async findObjective(
    tenantId: string,
    projectId: string,
    objectiveId: string,
  ) {
    const objective = await this.prisma.projectObjective.findFirst({
      where: { id: objectiveId, tenantId, projectId },
      select: { id: true },
    });
    if (!objective) throw new NotFoundException('Objective not found');
  }

  // ── Subtasks ────────────────────────────────────────────────────────

  async listSubtasks(tenantId: string, projectId: string, user: RequestUser) {
    await this.projects.assertCanView(tenantId, projectId, user);
    return this.prisma.projectSubtask.findMany({
      where: { tenantId, projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Managers, and the people the task is assigned to, can work on its subtasks. */
  private async requireTaskWork(
    tenantId: string,
    projectId: string,
    taskId: string,
    user: RequestUser,
  ) {
    const access = await this.projects.getWorkAccess(tenantId, projectId, user);
    const task = await this.prisma.projectTask.findFirst({
      where: { id: taskId, tenantId, projectId },
      select: {
        assignedEmployeeId: true,
        assignees: { select: { employeeId: true } },
      },
    });
    if (!task) throw new NotFoundException('Project task not found');
    const assigned =
      !!access.employeeId &&
      (task.assignedEmployeeId === access.employeeId ||
        task.assignees.some((a) => a.employeeId === access.employeeId));
    if (!access.canManage && !assigned) {
      throw new ForbiddenException(HR_PERMISSION_DENY_MESSAGE);
    }
  }

  async createSubtask(
    tenantId: string,
    projectId: string,
    user: RequestUser,
    dto: CreateSubtaskDto,
  ) {
    await this.requireTaskWork(tenantId, projectId, dto.taskId, user);
    return this.prisma.projectSubtask.create({
      data: { tenantId, projectId, taskId: dto.taskId, name: dto.name.trim() },
    });
  }

  private async findSubtask(
    tenantId: string,
    projectId: string,
    subtaskId: string,
  ) {
    const subtask = await this.prisma.projectSubtask.findFirst({
      where: { id: subtaskId, tenantId, projectId },
    });
    if (!subtask) throw new NotFoundException('Subtask not found');
    return subtask;
  }

  async updateSubtask(
    tenantId: string,
    projectId: string,
    subtaskId: string,
    user: RequestUser,
    dto: UpdateSubtaskDto,
  ) {
    const subtask = await this.findSubtask(tenantId, projectId, subtaskId);
    await this.requireTaskWork(tenantId, projectId, subtask.taskId, user);
    return this.prisma.projectSubtask.update({
      where: { id: subtaskId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.done !== undefined ? { done: dto.done } : {}),
      },
    });
  }

  async removeSubtask(
    tenantId: string,
    projectId: string,
    subtaskId: string,
    user: RequestUser,
  ) {
    const subtask = await this.findSubtask(tenantId, projectId, subtaskId);
    await this.requireTaskWork(tenantId, projectId, subtask.taskId, user);
    await this.prisma.projectSubtask.delete({ where: { id: subtaskId } });
    return { message: 'Subtask deleted successfully' };
  }

  // ── Sprints ─────────────────────────────────────────────────────────

  private validateSprintDates(dto: SprintDto) {
    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException(
        'Sprint end date cannot be before start date',
      );
    }
  }

  async listSprints(tenantId: string, projectId: string, user: RequestUser) {
    await this.projects.assertCanView(tenantId, projectId, user);
    const sprints = await this.prisma.projectSprint.findMany({
      where: { tenantId, projectId },
      include: { tasks: { select: { id: true } } },
      orderBy: { startDate: 'asc' },
    });
    return sprints.map((s) => this.serializeSprint(s));
  }

  private async findSprint(
    tenantId: string,
    projectId: string,
    sprintId: string,
  ) {
    const sprint = await this.prisma.projectSprint.findFirst({
      where: { id: sprintId, tenantId, projectId },
      include: { tasks: { select: { id: true } } },
    });
    if (!sprint) throw new NotFoundException('Sprint not found');
    return sprint;
  }

  async createSprint(
    tenantId: string,
    projectId: string,
    user: RequestUser,
    dto: SprintDto,
  ) {
    await this.requireManage(tenantId, projectId, user);
    this.validateSprintDates(dto);
    await this.assertTasksInProject(tenantId, projectId, dto.taskIds);

    const id = await this.prisma.$transaction(async (tx) => {
      const sprint = await tx.projectSprint.create({
        data: {
          tenantId,
          projectId,
          name: dto.name.trim(),
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
        },
      });
      // A task is in at most one sprint, so adding it here takes it out of any other.
      await tx.projectTask.updateMany({
        where: { id: { in: dto.taskIds } },
        data: { sprintId: sprint.id },
      });
      return sprint.id;
    });
    return this.serializeSprint(await this.findSprint(tenantId, projectId, id));
  }

  async updateSprint(
    tenantId: string,
    projectId: string,
    sprintId: string,
    user: RequestUser,
    dto: SprintDto,
  ) {
    await this.requireManage(tenantId, projectId, user);
    await this.findSprint(tenantId, projectId, sprintId);
    this.validateSprintDates(dto);
    await this.assertTasksInProject(tenantId, projectId, dto.taskIds);

    await this.prisma.$transaction(async (tx) => {
      await tx.projectSprint.update({
        where: { id: sprintId },
        data: {
          name: dto.name.trim(),
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
        },
      });
      await tx.projectTask.updateMany({
        where: { sprintId, id: { notIn: dto.taskIds } },
        data: { sprintId: null },
      });
      await tx.projectTask.updateMany({
        where: { id: { in: dto.taskIds } },
        data: { sprintId },
      });
    });
    return this.serializeSprint(
      await this.findSprint(tenantId, projectId, sprintId),
    );
  }

  async removeSprint(
    tenantId: string,
    projectId: string,
    sprintId: string,
    user: RequestUser,
  ) {
    await this.requireManage(tenantId, projectId, user);
    await this.findSprint(tenantId, projectId, sprintId);
    await this.prisma.projectSprint.delete({ where: { id: sprintId } });
    return { message: 'Sprint deleted successfully' };
  }

  /** Marks the sprint completed. Only `keepTaskIds` stay in it; the rest go back to the backlog. */
  async completeSprint(
    tenantId: string,
    projectId: string,
    sprintId: string,
    user: RequestUser,
    dto: CompleteSprintDto,
  ) {
    await this.requireManage(tenantId, projectId, user);
    const sprint = await this.findSprint(tenantId, projectId, sprintId);
    if (sprint.completedAt) {
      throw new BadRequestException('This sprint is already completed');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.projectTask.updateMany({
        where: { sprintId, id: { notIn: dto.keepTaskIds } },
        data: { sprintId: null },
      });
      await tx.projectSprint.update({
        where: { id: sprintId },
        data: { completedAt: new Date() },
      });
    });
    return this.serializeSprint(
      await this.findSprint(tenantId, projectId, sprintId),
    );
  }
}
