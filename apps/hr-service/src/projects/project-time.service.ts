import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  ProjectTaskStatus,
  ProjectTimeSource,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { HR_PERMISSION_DENY_MESSAGE } from '../auth/access-scope';
import { StartTimerDto, TimeAmountDto } from './dto/project-time.dto';
import { ProjectsService } from './projects.service';

const toSeconds = (amount: TimeAmountDto) =>
  amount.hours * 3600 + amount.minutes * 60;

/** Time spent on a project's timed tasks, per person: a running timer, time added by hand, corrections. */
@Injectable()
export class ProjectTimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  /** The seconds each person has on each task of the project. A running timer counts up to now. */
  async summary(tenantId: string, projectId: string, user: RequestUser) {
    await this.projects.assertCanView(tenantId, projectId, user);
    const entries = await this.prisma.projectTimeEntry.findMany({
      where: { tenantId, projectId },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    const now = Date.now();
    const byKey = new Map<
      string,
      {
        taskId: string;
        employeeId: string;
        employeeName: string;
        seconds: number;
        runningSince: string | null;
      }
    >();
    for (const e of entries) {
      const key = `${e.taskId}:${e.employeeId}`;
      const row = byKey.get(key) ?? {
        taskId: e.taskId,
        employeeId: e.employeeId,
        employeeName: `${e.employee.firstName} ${e.employee.lastName}`,
        seconds: 0,
        runningSince: null,
      };
      if (e.source === ProjectTimeSource.TIMER && !e.endedAt && e.startedAt) {
        row.seconds += Math.max(
          0,
          Math.floor((now - e.startedAt.getTime()) / 1000),
        );
        row.runningSince = e.startedAt.toISOString();
      } else {
        row.seconds += e.seconds;
      }
      byKey.set(key, row);
    }
    return [...byKey.values()];
  }

  /** The caller, on a timed task they can work on. */
  private async requireTrack(
    tenantId: string,
    projectId: string,
    taskId: string,
    user: RequestUser,
  ) {
    const access = await this.projects.getWorkAccess(tenantId, projectId, user);
    if (!access.employeeId)
      throw new ForbiddenException(HR_PERMISSION_DENY_MESSAGE);
    const task = await this.prisma.projectTask.findFirst({
      where: { id: taskId, tenantId, projectId },
      select: {
        id: true,
        isTimed: true,
        status: true,
        assignedEmployeeId: true,
        assignees: { select: { employeeId: true } },
      },
    });
    if (!task) throw new NotFoundException('Project task not found');
    if (!task.isTimed) {
      throw new BadRequestException('Time is not tracked on this task');
    }
    const assigned =
      task.assignedEmployeeId === access.employeeId ||
      task.assignees.some((a) => a.employeeId === access.employeeId);
    if (!access.canManage && !assigned) {
      throw new ForbiddenException(HR_PERMISSION_DENY_MESSAGE);
    }
    return { employeeId: access.employeeId, task };
  }

  private async runningEntries(
    tenantId: string,
    employeeId: string,
    taskId?: string,
  ) {
    return this.prisma.projectTimeEntry.findMany({
      where: {
        tenantId,
        employeeId,
        source: ProjectTimeSource.TIMER,
        endedAt: null,
        ...(taskId ? { taskId } : {}),
      },
    });
  }

  private async stop(entry: { id: string; startedAt: Date | null }) {
    const now = new Date();
    await this.prisma.projectTimeEntry.update({
      where: { id: entry.id },
      data: {
        endedAt: now,
        seconds: entry.startedAt
          ? Math.max(
              0,
              Math.floor((now.getTime() - entry.startedAt.getTime()) / 1000),
            )
          : 0,
      },
    });
  }

  async start(
    tenantId: string,
    projectId: string,
    taskId: string,
    user: RequestUser,
    dto: StartTimerDto,
  ) {
    const { employeeId, task } = await this.requireTrack(
      tenantId,
      projectId,
      taskId,
      user,
    );
    if (task.status === ProjectTaskStatus.DONE) {
      throw new BadRequestException('A finished task can no longer be timed');
    }
    if ((await this.runningEntries(tenantId, employeeId, taskId)).length > 0) {
      return this.summary(tenantId, projectId, user);
    }
    if (dto.pauseOthers) {
      for (const entry of await this.runningEntries(tenantId, employeeId)) {
        await this.stop(entry);
      }
    }
    await this.prisma.projectTimeEntry.create({
      data: {
        tenantId,
        projectId,
        taskId,
        employeeId,
        source: ProjectTimeSource.TIMER,
        startedAt: new Date(),
      },
    });
    return this.summary(tenantId, projectId, user);
  }

  async pause(
    tenantId: string,
    projectId: string,
    taskId: string,
    user: RequestUser,
  ) {
    const { employeeId } = await this.requireTrack(
      tenantId,
      projectId,
      taskId,
      user,
    );
    for (const entry of await this.runningEntries(
      tenantId,
      employeeId,
      taskId,
    )) {
      await this.stop(entry);
    }
    return this.summary(tenantId, projectId, user);
  }

  /** The caller's time on the task, a running timer counted to now. */
  private async mySeconds(
    tenantId: string,
    taskId: string,
    employeeId: string,
  ) {
    const entries = await this.prisma.projectTimeEntry.findMany({
      where: { tenantId, taskId, employeeId },
    });
    const now = Date.now();
    return entries.reduce(
      (sum, e) =>
        e.source === ProjectTimeSource.TIMER && !e.endedAt && e.startedAt
          ? sum + Math.max(0, Math.floor((now - e.startedAt.getTime()) / 1000))
          : sum + e.seconds,
      0,
    );
  }

  /** Adds time worked without the timer to the caller's own time. */
  async add(
    tenantId: string,
    projectId: string,
    taskId: string,
    user: RequestUser,
    dto: TimeAmountDto,
  ) {
    const { employeeId } = await this.requireTrack(
      tenantId,
      projectId,
      taskId,
      user,
    );
    const seconds = toSeconds(dto);
    if (seconds <= 0)
      throw new BadRequestException('Enter the time that was worked');
    await this.prisma.projectTimeEntry.create({
      data: {
        tenantId,
        projectId,
        taskId,
        employeeId,
        source: ProjectTimeSource.MANUAL,
        seconds,
        note: 'Added by hand',
      },
    });
    return this.summary(tenantId, projectId, user);
  }

  /** Sets the caller's total time on the task by recording the difference as a correction. */
  async setMine(
    tenantId: string,
    projectId: string,
    taskId: string,
    user: RequestUser,
    dto: TimeAmountDto,
  ) {
    const { employeeId } = await this.requireTrack(
      tenantId,
      projectId,
      taskId,
      user,
    );
    const current = await this.mySeconds(tenantId, taskId, employeeId);
    const delta = toSeconds(dto) - current;
    if (delta !== 0) {
      await this.prisma.projectTimeEntry.create({
        data: {
          tenantId,
          projectId,
          taskId,
          employeeId,
          source: ProjectTimeSource.MANUAL,
          seconds: delta,
          note: 'Correction',
        },
      });
    }
    return this.summary(tenantId, projectId, user);
  }
}
