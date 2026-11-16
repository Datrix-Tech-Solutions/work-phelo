import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeaveService } from '../leave/leave.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmployeeSyncRecoveryCronService {
  private readonly logger = new Logger(EmployeeSyncRecoveryCronService.name);
  private offboardCursor?: { updatedAt: Date; id: string };
  private scanningOffboards = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly leaveService: LeaveService,
    private readonly rabbitmq: RabbitMQPublisher,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async reconcileMissingLeaveBalances() {
    const year = new Date().getFullYear();
    const employees = await this.prisma.employee.findMany({
      where: {
        employmentStatus: { not: 'OFFBOARDED' },
        leaveBalances: { none: { year } },
      },
      select: {
        id: true,
        tenantId: true,
      },
      take: 100,
      orderBy: { createdAt: 'asc' },
    });

    if (employees.length === 0) {
      return;
    }

    for (const employee of employees) {
      try {
        await this.leaveService.initializeLeaveBalances(
          employee.tenantId,
          employee.id,
          year,
        );
        this.logger.log(
          `[recovery] Initialised missing leave balances for employee ${employee.id} (${year})`,
        );
      } catch (error) {
        this.logger.error(
          `[recovery] Failed to initialise leave balances for employee ${employee.id}`,
          error,
        );
      }
    }
  }

  private offboardPage(cursor?: { updatedAt: Date; id: string }) {
    return this.prisma.employee.findMany({
      where: {
        employmentStatus: 'OFFBOARDED',
        userId: { not: null },
        ...(cursor
          ? {
              OR: [
                { updatedAt: { gt: cursor.updatedAt } },
                { updatedAt: cursor.updatedAt, id: { gt: cursor.id } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        email: true,
        offboardReason: true,
        updatedAt: true,
      },
      take: 100,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async reconcileOffboardedAuthAccess() {
    if (this.scanningOffboards) return;
    this.scanningOffboards = true;
    try {
      let employees = await this.offboardPage(this.offboardCursor);
      if (!employees.length && this.offboardCursor) {
        this.offboardCursor = undefined;
        employees = await this.offboardPage();
      }

      if (employees.length === 0) {
        return;
      }

      // A restart may revisit a page, but repeatedly inactive accounts cannot pin the scan.
      const last = employees[employees.length - 1];
      this.offboardCursor = { updatedAt: last.updatedAt, id: last.id };

      const employeesByTenant = new Map<string, typeof employees>();

      for (const employee of employees) {
        const tenantEmployees = employeesByTenant.get(employee.tenantId) ?? [];
        tenantEmployees.push(employee);
        employeesByTenant.set(employee.tenantId, tenantEmployees);
      }

      for (const [tenantId, tenantEmployees] of employeesByTenant.entries()) {
        const userIds = tenantEmployees
          .map((employee) => employee.userId)
          .filter((userId): userId is string => Boolean(userId));

        if (userIds.length === 0) {
          continue;
        }

        try {
          const statuses = await this.rabbitmq.authGetUserStatuses({
            tenantId,
            userIds,
          });
          // Include legacy INACTIVE identities so they acquire the protected offboarding marker.
          const activeUserIds = new Set(
            statuses.map((status) => status.userId),
          );

          for (const employee of tenantEmployees) {
            if (!employee.userId || !activeUserIds.has(employee.userId)) {
              continue;
            }

            try {
              await this.rabbitmq.authDeactivateEmployeeAccess({
                tenantId,
                userId: employee.userId,
                email: employee.email ?? undefined,
                reason: employee.offboardReason ?? 'OFFBOARDED',
              });
              this.logger.log(
                `[recovery] Deactivated auth access for offboarded employee ${employee.id}`,
              );
            } catch (error) {
              this.logger.error(
                `[recovery] Failed to deactivate auth access for employee ${employee.id}`,
                error,
              );
            }
          }
        } catch (error) {
          this.logger.error(
            `[recovery] Failed to fetch auth statuses for offboarded users in tenant ${tenantId}`,
            error,
          );
        }
      }
    } finally {
      this.scanningOffboards = false;
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async reconcilePendingEmployeeInviteRollbacks() {
    const rollbackTasks = await this.prisma.employeeInviteRollbackTask.findMany(
      {
        take: 100,
        orderBy: { createdAt: 'asc' },
      },
    );

    if (rollbackTasks.length === 0) {
      return;
    }

    for (const task of rollbackTasks) {
      try {
        // A later retry may have created a real employee for this email; never delete that invite.
        const employee = await this.prisma.employee.findUnique({
          where: {
            tenantId_email: { tenantId: task.tenantId, email: task.email },
          },
          select: { id: true },
        });
        if (employee) {
          await this.prisma.employeeInviteRollbackTask.delete({
            where: { id: task.id },
          });
          continue;
        }

        await this.rabbitmq.authDeletePendingEmployeeInvite({
          tenantId: task.tenantId,
          userId: task.userId ?? undefined,
          email: task.email,
        });

        await this.prisma.employeeInviteRollbackTask.delete({
          where: { id: task.id },
        });

        this.logger.log(
          `[recovery] Deleted stranded auth invite for rollback task ${task.id}`,
        );
      } catch (error) {
        await this.prisma.employeeInviteRollbackTask.update({
          where: { id: task.id },
          data: {
            attemptCount: { increment: 1 },
            lastError: error instanceof Error ? error.message : String(error),
            lastAttemptAt: new Date(),
          },
        });

        this.logger.error(
          `[recovery] Failed to delete stranded auth invite for rollback task ${task.id}`,
          error,
        );
      }
    }
  }
}
