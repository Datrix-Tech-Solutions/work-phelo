import { Injectable, Logger } from '@nestjs/common';

/**
 * Hands a saved campaign to whatever actually sends it. The campaigns service
 * calls this after the campaign and its recipient rows are committed, so the
 * real SMS/email pipeline only has to replace the provider bound to
 * CAMPAIGN_DISPATCHER in CampaignsModule.
 */
export interface CampaignDispatcher {
  /** Send now (INSTANT) or arrange to send on the scheduled date (SCHEDULED). */
  dispatch(campaignId: string): Promise<void>;
  /** Stop a scheduled campaign from sending. Called after it is marked CANCELLED. */
  cancel(campaignId: string): Promise<void>;
}

export const CAMPAIGN_DISPATCHER = Symbol('CAMPAIGN_DISPATCHER');

/** Placeholder until SMS/email delivery is set up: campaigns stay unsent. */
@Injectable()
export class NoopCampaignDispatcher implements CampaignDispatcher {
  private readonly logger = new Logger(NoopCampaignDispatcher.name);

  dispatch(campaignId: string): Promise<void> {
    this.logger.log(
      `Campaign ${campaignId} saved; delivery is not configured, nothing was sent`,
    );
    return Promise.resolve();
  }

  cancel(campaignId: string): Promise<void> {
    this.logger.log(`Campaign ${campaignId} cancelled; nothing to unschedule`);
    return Promise.resolve();
  }
}
