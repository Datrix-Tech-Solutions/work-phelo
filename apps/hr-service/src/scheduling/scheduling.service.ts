import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs every day at 01:00 UTC.
   *
   * PROBATION → ACTIVE
   * Any employee whose probationEndsAt is today or in the past and is still
   * in PROBATION status gets automatically promoted to ACTIVE.
   *
   * CONTRACT expiry flag
   * Any CONTRACT employee whose contractEndDate has passed and is still
   * ACTIVE or PROBATION gets marked SUSPENDED with offboardReason
   * 'CONTRACT_ENDED' so HR can action it. We don't fully auto-offboard
   * because the clearance checklist still needs to be completed.
   */
  /**
   * Runs at 00:01 UTC on 1 January every year.
   *
   * Creates fresh leave balance records for the new year for every
   * non-offboarded employee. Uses the same upsert-with-empty-update pattern
   * so it is idempotent and safe to run multiple times.
   */
  @Cron('1 0 1 1 *')
  async rolloverLeaveBalances() {
    const year = new Date().getFullYear();
    this.logger.log(`[scheduler] Starting leave balance rollover for ${year}`);

    const tenants = await this.prisma.employee.groupBy({
      by: ['tenantId'],
      where: { employmentStatus: { not: 'OFFBOARDED' } },
    });

    let totalEmployees = 0;

    for (const { tenantId } of tenants) {
      const [employees, leaveTypes] = await Promise.all([
        this.prisma.employee.findMany({
          where: { tenantId, employmentStatus: { not: 'OFFBOARDED' } },
          select: { id: true, employmentType: true },
        }),
        this.prisma.leaveType.findMany({
          where: { tenantId, isActive: true },
        }),
      ]);

      for (const emp of employees) {
        for (const lt of leaveTypes) {
          if (
            lt.applicableTo.length > 0 &&
            !lt.applicableTo.includes(emp.employmentType)
          ) {
            continue;
          }

          await this.prisma.leaveBalance.upsert({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId: emp.id,
                leaveTypeId: lt.id,
                year,
              },
            },
            update: {},
            create: {
              tenantId,
              employeeId: emp.id,
              leaveTypeId: lt.id,
              year,
              totalDays: lt.daysAllowed,
              usedDays: 0,
              pendingDays: 0,
              remainingDays: lt.daysAllowed,
            },
          });
        }
      }

      totalEmployees += employees.length;
    }

    this.logger.log(
      `[scheduler] Leave balance rollover complete — ${totalEmployees} employee(s) across ${tenants.length} tenant(s) for year ${year}`,
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async runDailyStatusTransitions() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await Promise.all([
      this.promoteFromProbation(today),
      this.flagExpiredContracts(today),
    ]);
  }

  // ── Probation → Active ────────────────────────────────────────────────────

  private async promoteFromProbation(today: Date) {
    const expired = await this.prisma.employee.findMany({
      where: {
        employmentStatus: 'PROBATION',
        probationEndsAt: { lte: today },
      },
      select: { id: true, email: true, tenantId: true },
    });

    if (expired.length === 0) return;

    const ids = expired.map((e) => e.id);
    const now = new Date();

    await this.prisma.employee.updateMany({
      where: { id: { in: ids } },
      data: {
        employmentStatus: 'ACTIVE',
        statusChangedAt: now,
        statusChangedById: 'system',
        statusChangedByEmail: 'system',
      },
    });

    this.logger.log(
      `[scheduler] Promoted ${expired.length} employee(s) from PROBATION → ACTIVE: ${expired.map((e) => e.email).join(', ')}`,
    );
  }

  // ── Contract expiry ───────────────────────────────────────────────────────

  private async flagExpiredContracts(today: Date) {
    const expired = await this.prisma.employee.findMany({
      where: {
        employmentType: 'CONTRACT',
        employmentStatus: { in: ['ACTIVE', 'PROBATION'] },
        contractEndDate: { lte: today },
      },
      select: { id: true, email: true, tenantId: true },
    });

    if (expired.length === 0) return;

    const ids = expired.map((e) => e.id);
    const now = new Date();

    await this.prisma.employee.updateMany({
      where: { id: { in: ids } },
      data: {
        employmentStatus: 'SUSPENDED',
        offboardReason: 'CONTRACT_ENDED',
        statusChangedAt: now,
        statusChangedById: 'system',
        statusChangedByEmail: 'system',
      },
    });

    this.logger.log(
      `[scheduler] Flagged ${expired.length} CONTRACT employee(s) as expired: ${expired.map((e) => e.email).join(', ')}`,
    );
  }
}
