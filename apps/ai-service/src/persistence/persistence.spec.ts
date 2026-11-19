import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaClient } from '../../prisma/generated/client';
import { TrustedContextService } from '../auth/trusted-context.service';
import { parseRuntimeEnv } from '../config/runtime-env';
import { AiDatabaseService } from './ai-database.service';
import { ConversationsRepository } from './conversations.repository';
import { OwnershipContext, OwnershipContextFactory } from './ownership-context';

const tenantId = '11111111-1111-4111-8111-111111111111';
const ownerUserId = '22222222-2222-4222-8222-222222222222';
const valid = { NODE_ENV: 'test', AI_PROVIDER: 'mock', AI_POLICY_VERSION: 'test-v1' };

describe('Disabled persistence, configuration and scoped repository', () => {
  function database(enabled = false, connects = true) {
    const client = { $connect: jest.fn(), $disconnect: jest.fn() };
    if (!connects) client.$connect.mockRejectedValue(new Error('private-driver-credential'));
    const factory = jest.fn(() => client as unknown as PrismaClient);
    const config = new ConfigService({
      AI_PERSISTENCE_ENABLED: enabled,
      DATABASE_URL: enabled ? 'postgresql://test:test@127.0.0.1/test?schema=ai' : undefined,
    });
    return { service: new AiDatabaseService(config, factory), factory, client };
  }
  it('does not instantiate or connect a client when disabled', async () => {
    const { service, factory } = database();
    await service.onModuleInit();
    await service.onModuleDestroy();
    expect(factory).not.toHaveBeenCalled();
    await expect(service.run(() => Promise.resolve(null))).rejects.toThrow(
      'Persistence unavailable',
    );
  });
  it('connects/disconnects exactly once and blocks use after shutdown', async () => {
    const { service, client } = database(true);
    await service.onModuleInit();
    await service.run(() => Promise.resolve(null));
    await service.onModuleDestroy();
    await service.onModuleDestroy();
    expect(client.$connect).toHaveBeenCalledTimes(1);
    expect(client.$disconnect).toHaveBeenCalledTimes(1);
    await expect(service.run(() => Promise.resolve(null))).rejects.toThrow(
      'Persistence unavailable',
    );
  });
  it('sanitizes connection failures and releases the client', async () => {
    const { service, client } = database(true, false);
    await expect(service.onModuleInit()).rejects.toThrow('Persistence unavailable');
    expect(client.$disconnect).toHaveBeenCalledTimes(1);
  });
  it('fails closed if enabled without URL even outside runtime validation', async () => {
    const config = {
      get: (name: string) => (name === 'AI_PERSISTENCE_ENABLED' ? true : undefined),
    } as ConfigService;
    const factory = jest.fn();
    await expect(new AiDatabaseService(config, factory).onModuleInit()).rejects.toThrow(
      'Persistence unavailable',
    );
    expect(factory).not.toHaveBeenCalled();
  });
  it.each([
    undefined,
    '',
    'https://db.test',
    'postgresql://u:p@localhost/db?schema=hr',
    'postgresql://u:p@localhost/db',
    'postgresql://u:p@localhost/db?schema=ai&schema=hr',
    'postgresql://u:p@localhost/db?schema=ai&options=-csearch_path=hr',
  ])(
    'rejects enabled invalid database configuration without leaking values: %p',
    (DATABASE_URL) => {
      expect(() =>
        parseRuntimeEnv({ ...valid, AI_PERSISTENCE_ENABLED: 'true', DATABASE_URL }),
      ).toThrow('Invalid or missing AI runtime configuration: DATABASE_URL');
    },
  );
  it('defaults off and does not require database credentials', () => {
    expect(parseRuntimeEnv(valid)).toMatchObject({ AI_PERSISTENCE_ENABLED: false });
    expect(parseRuntimeEnv(valid)).not.toHaveProperty('DATABASE_URL');
  });
  it('accepts an explicit AI-schema URL without enabling inference/authentication', () => {
    expect(
      parseRuntimeEnv({
        ...valid,
        AI_PERSISTENCE_ENABLED: 'true',
        DATABASE_URL: 'postgresql://u:p@localhost/db?schema=ai',
      }),
    ).toMatchObject({
      AI_PERSISTENCE_ENABLED: true,
      AI_ENABLED: false,
      AI_AUTHENTICATED_ROUTES_ENABLED: false,
    });
  });
  it('rejects forged ownership objects before calling the database', async () => {
    const run = jest.fn();
    const repository = new ConversationsRepository({ run } as unknown as AiDatabaseService);
    await expect(
      repository.listOwned({ tenantId, ownerUserId } as unknown as OwnershipContext),
    ).rejects.toThrow('Unauthorized');
    expect(run).not.toHaveBeenCalled();
  });
  it('mints opaque context only after trusted authentication and scopes every read', async () => {
    const verifyRequest = jest.fn().mockReturnValue({ id: ownerUserId, tenantId });
    const context = new OwnershipContextFactory({
      verifyRequest,
    } as unknown as TrustedContextService).fromRequest({} as Request);
    expect(verifyRequest).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(context)).toBe('{}');
    const client = {
      $queryRaw: jest.fn().mockResolvedValue([{ now: new Date() }]),
      aiConversation: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const db = { transaction: (fn: (c: unknown) => unknown) => fn(client) };
    const repository = new ConversationsRepository(db as unknown as AiDatabaseService);
    await repository.findOwned(context, tenantId);
    await repository.listOwned(context, 10);
    for (const method of [client.aiConversation.findFirst, client.aiConversation.findMany]) {
      expect(method).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            ownerUserId,
            expiresAt: { gt: expect.any(Date) as unknown },
          }) as unknown,
          select: { id: true, createdAt: true, updatedAt: true, expiresAt: true },
        }),
      );
    }
    await expect(repository.requireOwned(context, 'not-a-uuid')).rejects.toThrow(
      'Conversation not found',
    );
    await expect(repository.listOwned(context, 101)).rejects.toThrow('Bad Request');
  });
});
