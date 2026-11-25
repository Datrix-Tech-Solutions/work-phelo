import Redis from 'ioredis';
import { createHmac } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { AiAdmissionError, AiRateAdmission } from './ai-rate-admission';

const original = process.env;
describe('AI admission configuration fails closed', () => {
  afterEach(() => {
    process.env = original;
    jest.restoreAllMocks();
  });
  it('rechecks the monotonic deadline even if event-loop scheduling delayed its timeout callback', async () => {
    const admission = new AiRateAdmission();
    jest
      .spyOn(
        admission as unknown as { perform: () => Promise<void> },
        'perform',
      )
      .mockResolvedValue();
    jest.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(101);
    await expect(
      admission.admit('tenant', 'owner', 'GET'),
    ).rejects.toMatchObject({ status: 503 });
  });
  it.each([undefined, 'false', 'true'])(
    'does not admit with missing credentials (%s)',
    async (flag) => {
      process.env = { NODE_ENV: 'test', AI_RESOURCE_SAFEGUARDS_ENABLED: flag };
      const admission = new AiRateAdmission();
      await expect(
        admission.admit('tenant', 'owner', 'GET'),
      ).rejects.toMatchObject({ status: 503 });
      await admission.onModuleDestroy();
    },
  );
});

const url = process.env.AI_TEST_ADMISSION_REDIS_URL;
(url ? describe : describe.skip)(
  'Shared AI admission on disposable Redis',
  () => {
    let admin: Redis;
    let replicas: AiRateAdmission[];
    beforeAll(async () => {
      const target = new URL(url!);
      if (
        !['127.0.0.1', 'localhost'].includes(target.hostname) ||
        target.port !== '17991' ||
        !['', '/0'].includes(target.pathname)
      )
        throw new Error('Only dedicated disposable safeguard Redis is allowed');
      admin = new Redis(url!);
      await admin.ping();
    });
    beforeEach(async () => {
      process.env = {
        ...original,
        AI_RESOURCE_SAFEGUARDS_ENABLED: 'true',
        AI_ADMISSION_REDIS_URL: url,
        AI_ADMISSION_KEY_HMAC_SECRET: Buffer.alloc(32, 74).toString('base64'),
      };
      await admin.flushdb();
      await admin.config('SET', 'maxmemory-policy', 'noeviction');
      await admin.config('SET', 'maxmemory', '67108864');
      const runId = (await admin.info('server')).match(/run_id:([^\r\n]+)/)![1];
      const tag = createHmac('sha256', Buffer.alloc(32, 74))
        .update('workphelo.ai.admission.v1')
        .digest('hex');
      await admin.set('ai:admission:v1:epoch', `${runId}:${tag}`);
      replicas = [new AiRateAdmission(), new AiRateAdmission()];
    });
    afterEach(async () => {
      for (const replica of replicas) await replica.onModuleDestroy();
      process.env = original;
    });
    afterAll(async () => {
      await admin?.quit();
    });
    it('atomically shares owner capacity across replicas and keeps delete separate from writes', async () => {
      await Promise.all(
        replicas.map((r) => r.admit('tenant', 'owner', 'POST')),
      );
      await expect(
        replicas[0].admit('tenant', 'owner', 'POST'),
      ).rejects.toMatchObject({ status: 429, retryAfter: 6 });
      await replicas[0].admit('tenant', 'owner', 'DELETE');
      await replicas[1].admit('other-tenant', 'owner', 'POST');
      await replicas[1].admit('tenant', 'other-owner', 'POST');
    });
    it('shares tenant capacity, does not partially spend rejected owner buckets, and hashes identities', async () => {
      // Warm connections before measuring parallel admission rather than connection startup.
      await Promise.all(
        replicas.map((r, i) => r.admit('warm-' + i, 'warm', 'GET')),
      );
      const results = await Promise.all(
        Array.from({ length: 24 }, (_, i) =>
          replicas[i % 2]
            .admit('private-tenant', 'private-owner-' + i, 'POST')
            .then(
              () => 200,
              (error: AiAdmissionError) => error.getStatus(),
            ),
        ),
      );
      expect(results.filter((code) => code === 200)).toHaveLength(20);
      expect(results.filter((code) => code === 429)).toHaveLength(4);
      const keys = await admin.keys('ai:admission:v1:*');
      expect(keys.join(' ')).not.toMatch(/private-tenant|private-owner/);
      const ownerBuckets = keys.filter((key) => key.includes(':write:owner:'));
      expect(ownerBuckets).toHaveLength(20);
    });
    it('enforces read burst ten and returns integer Retry-After within 1..60', async () => {
      for (let i = 0; i < 10; i++)
        await replicas[i % 2].admit('tenant', 'owner', 'GET');
      try {
        await replicas[0].admit('tenant', 'owner', 'GET');
        throw new Error('Admission unexpectedly allowed');
      } catch (error) {
        expect(error).toBeInstanceOf(AiAdmissionError);
        expect((error as AiAdmissionError).getStatus()).toBe(429);
        expect((error as AiAdmissionError).retryAfter).toBeGreaterThanOrEqual(
          1,
        );
        expect((error as AiAdmissionError).retryAfter).toBeLessThanOrEqual(60);
      }
    });
    it('rejects missing or stale failover epoch, malformed state, and eviction-policy changes', async () => {
      await replicas[0].admit('tenant', 'owner', 'GET');
      const key = (await admin.keys('*:read:tenant'))[0];
      await admin.set(key, 'corrupted');
      await expect(
        replicas[0].admit('tenant', 'owner', 'GET'),
      ).rejects.toMatchObject({ status: 503 });
      await admin.del(key);
      await admin.hset(key, 'at', '123');
      await expect(
        replicas[0].admit('tenant', 'owner', 'GET'),
      ).rejects.toMatchObject({ status: 503 });
      await admin.del(key);
      await admin.hset(key, 'tokens', 'nan', 'at', String(Date.now()));
      await expect(
        replicas[0].admit('tenant', 'owner', 'GET'),
      ).rejects.toMatchObject({ status: 503 });
      await admin.del(key);
      await admin.del('ai:admission:v1:epoch');
      await expect(
        replicas[1].admit('tenant', 'owner', 'GET'),
      ).rejects.toMatchObject({ status: 503 });
      await admin.set('ai:admission:v1:epoch', 'previous-process');
      await expect(
        replicas[1].admit('tenant', 'owner', 'GET'),
      ).rejects.toMatchObject({ status: 503 });
      await admin.config('SET', 'maxmemory-policy', 'allkeys-lru');
      await expect(
        replicas[0].admit('tenant', 'owner', 'GET'),
      ).rejects.toMatchObject({ status: 503 });
    });
    it('fails closed for a denied Redis command/ACL without local admission fallback', async () => {
      await admin.call(
        'ACL',
        'SETUSER',
        'ai-denied',
        'on',
        '>fixture-only',
        '~ai:admission:v1:*',
        '+ping',
        '+info',
      );
      process.env.AI_ADMISSION_REDIS_URL =
        'redis://ai-denied:fixture-only@127.0.0.1:17991';
      await expect(
        replicas[0].admit('tenant', 'owner', 'GET'),
      ).rejects.toMatchObject({ status: 503 });
      await admin.call('ACL', 'DELUSER', 'ai-denied');
    });
    it('bounds an unavailable connection instead of waiting for retries', async () => {
      process.env.AI_ADMISSION_REDIS_URL = 'redis://127.0.0.1:1';
      await expect(
        replicas[0].admit('tenant', 'owner', 'GET'),
      ).rejects.toMatchObject({ status: 503 });
    });
    it('rejects mismatched replica keys rather than creating another independent budget', async () => {
      process.env.AI_ADMISSION_KEY_HMAC_SECRET = Buffer.alloc(32, 75).toString(
        'base64',
      );
      await expect(
        replicas[0].admit('tenant', 'owner', 'GET'),
      ).rejects.toMatchObject({ status: 503 });
      expect(await admin.keys('*:read:*')).toHaveLength(0);
    });
  },
);
