import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { ClientProxyFactory } from '@nestjs/microservices';
import { RequestUser } from '@work-phelo/types';
import { MarketingRabbitPublisher } from '../messaging/rabbitmq.publisher';
import { startMarketingConsumers } from '../messaging/consumer-lifecycle';
import { CampaignsService } from '../campaigns/campaigns.service';
import { CampaignSchedulerService } from '../campaigns/campaign-scheduler.service';
import { AccountingClient } from '../accounting/accounting.client';
import { marketingActivation, marketingActivationFlags } from './activation';
import { assertMarketingRuntimeEnv } from './runtime-env';
import { parseSmsSenderReadinessMode } from '../sms/sms-sender-readiness';
import { ProspectingSettingsService } from '../crm-settings/prospecting-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { MarketingCrmSettingCategory } from '../../prisma/generated/client';

describe('Marketing production activation safety', () => {
  const original = process.env;
  beforeEach(() => {
    process.env = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/fixture',
      JWT_SECRET: 'fixture-only',
      RABBITMQ_URL: 'amqp://fixture:fixture@127.0.0.1:1/unreachable',
    };
  });
  afterEach(() => {
    process.env = original;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('defaults all business activation off and sender readiness strict', () => {
    for (const flag of marketingActivationFlags)
      expect(marketingActivation(flag)).toBe(false);
    expect(parseSmsSenderReadinessMode()).toBe('strict');
    expect(() => assertMarketingRuntimeEnv()).not.toThrow();
  });
  it.each(marketingActivationFlags)('fails closed on malformed %s', (flag) => {
    process.env[flag] = '1';
    expect(() => assertMarketingRuntimeEnv()).toThrow(
      `${flag} must be true or false`,
    );
  });
  it('does not bind, consume or acknowledge broker messages when consumers are disabled', async () => {
    const connectMicroservice = jest.fn(),
      startAllMicroservices = jest.fn();
    await startMarketingConsumers({
      connectMicroservice,
      startAllMicroservices,
    } as unknown as INestApplication);
    expect(connectMicroservice).not.toHaveBeenCalled();
    expect(startAllMicroservices).not.toHaveBeenCalled();
  });
  it('fails explicitly enabled consumers without a broker URL', () => {
    process.env.MARKETING_RABBITMQ_CONSUMER_ENABLED = 'true';
    delete process.env.RABBITMQ_URL;
    expect(() => assertMarketingRuntimeEnv()).toThrow('RABBITMQ_URL');
  });
  it('closes the app if an explicitly enabled consumer cannot start', async () => {
    process.env.MARKETING_RABBITMQ_CONSUMER_ENABLED = 'true';
    const app = {
      connectMicroservice: jest.fn(),
      startAllMicroservices: jest
        .fn()
        .mockRejectedValue(new Error('synthetic broker outage')),
      close: jest.fn().mockResolvedValue(undefined),
    };
    await expect(
      startMarketingConsumers(app as unknown as INestApplication),
    ).rejects.toThrow('Marketing RabbitMQ startup unavailable');
    expect(app.close).toHaveBeenCalledTimes(1);
  });
  it('does not open Notification clients or send any provider requests while disabled', async () => {
    const create = jest.spyOn(ClientProxyFactory, 'create');
    const publisher = new MarketingRabbitPublisher();
    await expect(publisher.campaignDispatchBatch({} as never)).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(
      publisher.submitSmsSenderIdentity({} as never),
    ).rejects.toThrow(ServiceUnavailableException);
    await expect(
      publisher.refreshSmsSenderIdentityStatus({} as never),
    ).rejects.toThrow(ServiceUnavailableException);
    await publisher.inAppCreate({} as never);
    await publisher.onModuleDestroy();
    expect(create).not.toHaveBeenCalled();
  });
  it('does not create automatic timers or invoke campaign operations', async () => {
    jest.useFakeTimers();
    const campaigns = { dispatchDueScheduledCampaigns: jest.fn() };
    const scheduler = new CampaignSchedulerService(
      campaigns as unknown as CampaignsService,
    );
    scheduler.onApplicationBootstrap();
    expect(jest.getTimerCount()).toBe(0);
    expect(campaigns.dispatchDueScheduledCampaigns).not.toHaveBeenCalled();
    await scheduler.onModuleDestroy();
  });
  it('blocks explicit send before campaign lookup, reservation or transaction work', async () => {
    const service = Object.create(
      CampaignsService.prototype,
    ) as CampaignsService;
    await expect(service.send({} as RequestUser, 'synthetic')).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(
      service.dispatchDueScheduledCampaigns(),
    ).resolves.toBeUndefined();
  });
  it('keeps tenant-scoped CRM reads available with every business activation flag off', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ProspectingSettingsService({
      marketingCrmSettingOption: { findMany },
    } as unknown as PrismaService);
    await expect(
      service.list('tenant-fixture', MarketingCrmSettingCategory.PRODUCT),
    ).resolves.toEqual({ items: [] });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-fixture',
          category: 'PRODUCT',
          archivedAt: null,
        },
      }),
    );
  });
  it('does not overlap enabled maintenance and awaits its owned work on shutdown', async () => {
    jest.useFakeTimers();
    process.env.MARKETING_AUTOMATIC_PROCESSING_ENABLED = 'true';
    process.env.MARKETING_OUTBOUND_COMMUNICATION_ENABLED = 'true';
    process.env.MARKETING_CAMPAIGN_SCHEDULER_INTERVAL_MS = '1000';
    let release!: () => void;
    const job = new Promise<void>((resolve) => {
      release = resolve;
    });
    const run = jest.fn().mockReturnValue(job);
    const scheduler = new CampaignSchedulerService({
      dispatchDueScheduledCampaigns: run,
    } as unknown as CampaignsService);
    scheduler.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(3000);
    expect(run).toHaveBeenCalledTimes(1);
    let stopped = false;
    const stop = scheduler.onModuleDestroy().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    release();
    await stop;
    expect(stopped).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
  it('keeps accounting integration disabled even with a configured service URL', () => {
    process.env.ACCOUNTING_SERVICE_URL = 'http://127.0.0.1:1';
    const client = new AccountingClient();
    expect(client.isConfigured()).toBe(false);
    expect(() => client.getOptions('tenant-fixture', 'user-fixture')).toThrow(
      ServiceUnavailableException,
    );
  });
  it('requires strict provider-authoritative readiness for production outbound activation', () => {
    process.env.MARKETING_OUTBOUND_COMMUNICATION_ENABLED = 'true';
    process.env.SMS_SENDER_READINESS_MODE = 'legacy';
    expect(() => assertMarketingRuntimeEnv()).toThrow(
      'requires strict sender readiness',
    );
  });
});
