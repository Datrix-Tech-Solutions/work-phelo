import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppraisalsService } from './appraisals.service';

@Injectable()
export class AppraisalsCronService {
  private readonly logger = new Logger(AppraisalsCronService.name);

  constructor(private readonly appraisalsService: AppraisalsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runDailyLifecycleJobs() {
    this.logger.log('Running daily appraisal lifecycle jobs...');

    try {
      await this.appraisalsService.completeExpiredCycles();
      await this.appraisalsService.sendPendingActionReminders();
    } catch (error) {
      this.logger.error('Failed to run appraisal lifecycle jobs', error);
    }
  }
}
