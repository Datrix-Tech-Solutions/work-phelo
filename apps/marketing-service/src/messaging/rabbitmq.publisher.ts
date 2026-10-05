import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import { firstValueFrom, timeout } from 'rxjs';
import {
  CampaignDispatchBatchEvent,
  EventPatterns,
  InAppNotificationCreateEvent,
  PermissionRecipient,
  ResolvePermissionRecipientsCommand,
  WithMeta,
} from '@work-phelo/types';

/** Queue options must match what the consuming services declare, or RabbitMQ rejects the channel. */
const QUEUE_OPTIONS = {
  durable: true,
  arguments: { 'x-message-ttl': 3600000 },
};

/**
 * Talks to the notification and auth services over RabbitMQ. Clients are created on first use and
 * only when RABBITMQ_URL is set, so a marketing-service without a broker still boots; callers
 * treat notifications as best-effort.
 */
@Injectable()
export class MarketingRabbitPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(MarketingRabbitPublisher.name);
  private readonly timeoutMs = Number(
    process.env.RABBITMQ_RPC_TIMEOUT_MS ?? 10000,
  );
  private readonly clients = new Map<string, ClientProxy>();

  private client(queue: string): ClientProxy | null {
    const url = process.env.RABBITMQ_URL;
    if (!url) return null;
    let client = this.clients.get(queue);
    if (!client) {
      client = ClientProxyFactory.create({
        transport: Transport.RMQ,
        options: { urls: [url], queue, queueOptions: QUEUE_OPTIONS },
      });
      this.clients.set(queue, client);
    }
    return client;
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

  /** Users who currently hold a permission, e.g. everyone who can approve an appointment. */
  async resolvePermissionRecipients(
    data: ResolvePermissionRecipientsCommand,
  ): Promise<PermissionRecipient[]> {
    const client = this.client('auth_queue');
    if (!client) {
      this.logger.warn(
        'RABBITMQ_URL is not set; cannot resolve notification recipients',
      );
      return [];
    }
    return firstValueFrom(
      client
        .send<
          PermissionRecipient[],
          WithMeta<ResolvePermissionRecipientsCommand>
        >(EventPatterns.AUTH_RESOLVE_PERMISSION_RECIPIENTS, this.envelope(data))
        .pipe(timeout(this.timeoutMs)),
    );
  }

  async inAppCreate(data: InAppNotificationCreateEvent): Promise<void> {
    const client = this.client('notification_queue');
    if (!client) {
      this.logger.warn('RABBITMQ_URL is not set; skipping in-app notification');
      return;
    }
    await firstValueFrom(
      client
        .emit(EventPatterns.NOTIFICATION_IN_APP_CREATE, this.envelope(data))
        .pipe(timeout(this.timeoutMs)),
      { defaultValue: undefined },
    );
  }

  async inAppCreateMany(events: InAppNotificationCreateEvent[]): Promise<void> {
    await Promise.all(events.map((event) => this.inAppCreate(event)));
  }

  async campaignDispatchBatch(data: CampaignDispatchBatchEvent): Promise<void> {
    const client = this.client('notification_queue');
    if (!client) {
      throw new Error('RABBITMQ_URL is required for campaign dispatch');
    }
    await firstValueFrom(
      client
        .emit(EventPatterns.NOTIFY_CAMPAIGN_DISPATCH, this.envelope(data))
        .pipe(timeout(this.timeoutMs)),
      { defaultValue: undefined },
    );
  }

  onModuleDestroy() {
    for (const client of this.clients.values()) void client.close();
  }
}
