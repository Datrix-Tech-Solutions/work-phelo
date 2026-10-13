import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import { firstValueFrom, timeout } from 'rxjs';
import {
  CampaignDeliveryResultEvent,
  EventPatterns,
  WithMeta,
} from '@work-phelo/types';

const QUEUE_OPTIONS = {
  durable: true,
  arguments: { 'x-message-ttl': 3600000 },
};

@Injectable()
export class MarketingRabbitPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(MarketingRabbitPublisher.name);
  private readonly timeoutMs = Number(
    process.env.RABBITMQ_RPC_TIMEOUT_MS ?? 10000,
  );
  private client: ClientProxy | null = null;

  private getClient(): ClientProxy | null {
    const url = process.env.RABBITMQ_URL;
    if (!url) return null;
    if (!this.client) {
      this.client = ClientProxyFactory.create({
        transport: Transport.RMQ,
        options: {
          urls: [url],
          queue: 'marketing_queue',
          queueOptions: QUEUE_OPTIONS,
        },
      });
    }
    return this.client;
  }

  private envelope<T extends object>(data: T): WithMeta<T> {
    return {
      ...data,
      _meta: {
        messageId: randomUUID(),
        correlationId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  async campaignDeliveryResult(
    data: CampaignDeliveryResultEvent,
  ): Promise<void> {
    const client = this.getClient();
    if (!client) {
      this.logger.error(
        `RABBITMQ_URL is not set; cannot publish campaign delivery result for campaign=${data.campaignId} recipient=${data.recipientId}`,
      );
      return;
    }
    await firstValueFrom(
      client
        .emit(
          EventPatterns.MARKETING_CAMPAIGN_DELIVERY_RESULT,
          this.envelope(data),
        )
        .pipe(timeout(this.timeoutMs)),
      { defaultValue: undefined },
    );
  }

  onModuleDestroy() {
    void this.client?.close();
  }
}
