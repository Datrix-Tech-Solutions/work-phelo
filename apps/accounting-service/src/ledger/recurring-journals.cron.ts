import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RecurringJournalsService } from './recurring-journals.service';

@Injectable()
export class RecurringJournalsCron {
  private readonly logger = new Logger(RecurringJournalsCron.name);

  constructor(private readonly recurring: RecurringJournalsService) {}

  /** Shortly after midnight UTC, generate everything that has come due (and catch up any runs
   *  missed while the service was down). */
  @Cron('0 5 0 * * *', { timeZone: 'UTC' })
  async generateDueEntries() {
    try {
      await this.recurring.generateDue();
    } catch (error) {
      this.logger.error('Recurring entry run failed', error);
    }
  }
}
