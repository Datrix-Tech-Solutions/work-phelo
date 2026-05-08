import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SYSTEM_ACTOR_EMAIL, SYSTEM_ACTOR_ID } from '../common/system-actor';

@Injectable()
export class EmployeeStatusCronService {
  private readonly logger = new Logger(EmployeeStatusCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkProbationStatuses() {
    this.logger.log('Starting daily check for expired probation periods...');

    try {
      const now = new Date();

      const { count } = await this.prisma.employee.updateMany({
        where: {
          employmentStatus: 'PROBATION',
          probationEndsAt: {
            lte: now,
          },
        },
        data: {
          employmentStatus: 'ACTIVE',
          statusChangedAt: now,
          statusChangedById: SYSTEM_ACTOR_ID,
          statusChangedByEmail: SYSTEM_ACTOR_EMAIL,
        },
      });

      this.logger.log(
        `Successfully promoted ${count} employee(s) from PROBATION to ACTIVE.`,
      );
    } catch (error) {
      this.logger.error('Failed to process probation status updates', error);
    }
  }
}
