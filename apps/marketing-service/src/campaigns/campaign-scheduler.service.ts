import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';

@Injectable()
export class CampaignSchedulerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(CampaignSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly campaigns: CampaignsService) {}

  onApplicationBootstrap() {
    const intervalMs = Number(
      process.env.MARKETING_CAMPAIGN_SCHEDULER_INTERVAL_MS ?? 60000,
    );
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      this.logger.warn('Campaign scheduler disabled by invalid interval');
      return;
    }
    this.timer = setInterval(() => void this.tick(), intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.campaigns.dispatchDueScheduledCampaigns();
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(
        `Scheduled campaign dispatch failed: ${detail}`,
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
