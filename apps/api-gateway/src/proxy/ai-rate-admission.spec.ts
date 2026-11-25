import Redis from 'ioredis';
import { createHmac } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import {
  ADMISSION_SCRIPT,
  AiAdmissionError,
  AiRateAdmission,
} from './ai-rate-admission';

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
      jest.restoreAllMocks();
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
      await admin.pexpire(key, 120000);
      await expect(
        replicas[0].admit('tenant', 'owner', 'GET'),
      ).rejects.toMatchObject({ status: 503 });
      await admin.del(key);
      await admin.hset(key, 'tokens', 'nan', 'at', String(Date.now()));
      await admin.pexpire(key, 120000);
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
    const bucketKeys = () => {
      const hash = (value: string) =>
        createHmac('sha256', Buffer.alloc(32, 74)).update(value).digest('hex');
      const prefix = `ai:admission:v1:{${hash(JSON.stringify(['tenant', 'tenant']))}}:write:`;
      return {
        tenant: prefix + 'tenant',
        owner:
          prefix +
          'owner:' +
          hash(JSON.stringify(['owner', 'tenant', 'owner'])),
        marker: prefix + 'incomplete',
      };
    };
    it('does not reset an exhausted owner hash missing both mandatory fields', async () => {
      await replicas[0].admit('tenant', 'owner', 'POST');
      await replicas[1].admit('tenant', 'owner', 'POST');
      await expect(
        replicas[0].admit('tenant', 'owner', 'POST'),
      ).rejects.toMatchObject({ status: 429 });
      const keys = bucketKeys();
      await admin.del(keys.owner);
      await admin.hset(keys.owner, 'unrelated', 'field');
      await admin.pexpire(keys.owner, 120000);
      const before = await admin.hgetall(keys.tenant);
      await expect(
        replicas[1].admit('tenant', 'owner', 'POST'),
      ).rejects.toMatchObject({ status: 503 });
      expect(await admin.hgetall(keys.tenant)).toEqual(before);
      expect(await admin.hgetall(keys.owner)).toEqual({ unrelated: 'field' });
      expect(await admin.exists(keys.marker)).toBe(0);
    });
    it.each(['tenant', 'owner'] as const)(
      'preflights malformed %s buckets before touching either scope',
      async (scope) => {
        const keys = bucketKeys();
        for (const bad of [
          { unrelated: 'field' },
          { tokens: '1' },
          { at: String(Date.now()) },
          { tokens: 'nan', at: String(Date.now()) },
          { tokens: 'inf', at: String(Date.now()) },
          { tokens: '1', at: 'inf' },
          { tokens: '-1', at: String(Date.now()) },
          { tokens: '999', at: String(Date.now()) },
          { tokens: '1', at: '-1' },
          { tokens: '1', at: String(Date.now() + 60000) },
        ]) {
          await admin.del(keys[scope]);
          await admin.hset(keys[scope], bad);
          await admin.pexpire(keys[scope], 120000);
          const other = scope === 'owner' ? keys.tenant : keys.owner;
          const before = await admin.hgetall(other);
          await expect(
            replicas[0].admit('tenant', 'owner', 'POST'),
          ).rejects.toMatchObject({ status: 503 });
          expect(await admin.hgetall(other)).toEqual(before);
          expect(await admin.hgetall(keys[scope])).toEqual(bad);
          expect(await admin.exists(keys.marker)).toBe(0);
        }
        await admin.del(keys[scope]);
        await admin.set(keys[scope], 'wrong-type');
        await expect(
          replicas[1].admit('tenant', 'owner', 'POST'),
        ).rejects.toMatchObject({ status: 503 });
        expect(await admin.get(keys[scope])).toBe('wrong-type');
      },
    );
    it('rejects denied PEXPIRE before creating a debit or incomplete marker', async () => {
      await admin.call(
        'ACL',
        'SETUSER',
        'ai-partial',
        'on',
        '>fixture-only',
        '~ai:admission:v1:*',
        '+ping',
        '+info',
        '+eval',
        '+get',
        '+exists',
        '+type',
        '+time',
        '+hmget',
        '+pttl',
        '+hset',
        '+set',
        '+del',
      );
      process.env.AI_ADMISSION_REDIS_URL =
        'redis://ai-partial:fixture-only@127.0.0.1:17991';
      try {
        await expect(
          replicas[0].admit('tenant', 'owner', 'POST'),
        ).rejects.toMatchObject({ status: 503 });
        expect(await admin.keys('*:write:*')).toEqual([]);
      } finally {
        await admin.call('ACL', 'DELUSER', 'ai-partial');
      }
    });
    it.each(['tenant', 'owner'] as const)(
      'rejects persistent or overlong TTL on an existing %s bucket',
      async (scope) => {
        const keys = bucketKeys();
        for (const ttl of [undefined, 240000]) {
          await admin.del(keys[scope]);
          await admin.hset(
            keys[scope],
            'tokens',
            '1',
            'at',
            String(Date.now()),
          );
          if (ttl) await admin.pexpire(keys[scope], ttl);
          await expect(
            replicas[0].admit('tenant', 'owner', 'POST'),
          ).rejects.toMatchObject({ status: 503 });
          expect(await admin.hget(keys[scope], 'tokens')).toBe('1');
          if (ttl)
            expect(await admin.pttl(keys[scope])).toBeGreaterThan(120000);
          else expect(await admin.pttl(keys[scope])).toBe(-1);
          expect(await admin.exists(keys.marker)).toBe(0);
        }
      },
    );
    type Evaluator = {
      eval: (
        script: string,
        keys: number,
        ...args: (string | number)[]
      ) => Promise<unknown>;
    };
    const evaluator = () =>
      (replicas[0] as unknown as { client: Evaluator }).client;
    it('keeps a persistent failure marker on unexpected mid-script failure and never repairs it automatically', async () => {
      await replicas[0].admit('warm', 'warm', 'GET');
      const client = evaluator(),
        evaluate = client.eval.bind(client);
      const script = ADMISSION_SCRIPT.replace(
        "redis.call('HSET',KEYS[i]",
        "if i==3 then error('synthetic write failure') end\n redis.call('HSET',KEYS[i]",
      );
      expect(script).not.toBe(ADMISSION_SCRIPT);
      const call = jest
        .spyOn(client, 'eval')
        .mockImplementationOnce((_script, count, ...args) =>
          evaluate(script, count, ...args),
        );
      await expect(
        replicas[0].admit('tenant', 'owner', 'POST'),
      ).rejects.toMatchObject({ status: 503 });
      expect(call).toHaveBeenCalledTimes(1);
      const keys = bucketKeys(),
        before = await admin.hgetall(keys.tenant);
      expect(await admin.get(keys.marker)).toBe(keys.owner);
      expect(await admin.ttl(keys.marker)).toBe(-1);
      await expect(
        replicas[1].admit('tenant', 'different-owner', 'POST'),
      ).rejects.toMatchObject({ status: 503 });
      expect(await admin.hgetall(keys.tenant)).toEqual(before);
      expect(await admin.get(keys.marker)).toBe(keys.owner);
      await replicas[1].admit('independent-tenant', 'owner', 'POST');
    });
    it('never retries an uncertain result or authorizes the failed request', async () => {
      await replicas[0].admit('warm', 'warm', 'GET');
      const client = evaluator(),
        evaluate = client.eval.bind(client);
      const call = jest
        .spyOn(client, 'eval')
        .mockImplementationOnce(async (script, count, ...args) => {
          await evaluate(script, count, ...args);
          throw new Error('synthetic lost response');
        });
      await expect(
        replicas[0].admit('tenant', 'owner', 'POST'),
      ).rejects.toMatchObject({ status: 503 });
      expect(call).toHaveBeenCalledTimes(1);
      const keys = bucketKeys();
      expect(await admin.exists(keys.marker)).toBe(0);
      await replicas[1].admit('tenant', 'owner', 'POST');
      await expect(
        replicas[1].admit('tenant', 'owner', 'POST'),
      ).rejects.toMatchObject({ status: 429 });
    });
    it('refills exhausted state from Redis server time without resetting the bucket', async () => {
      await replicas[0].admit('tenant', 'owner', 'POST');
      await replicas[1].admit('tenant', 'owner', 'POST');
      await expect(
        replicas[0].admit('tenant', 'owner', 'POST'),
      ).rejects.toMatchObject({ status: 429 });
      const keys = bucketKeys(),
        clock = await admin.time();
      const now = Number(clock[0]) * 1000 + Number(clock[1]) / 1000;
      // Move only the fixture's refill timestamp back one complete refill window.
      await admin.hset(keys.owner, 'at', String(now - 12000));
      await replicas[1].admit('tenant', 'owner', 'POST');
      expect(
        Number(await admin.hget(keys.owner, 'tokens')),
      ).toBeGreaterThanOrEqual(1);
      expect(await admin.pttl(keys.owner)).toBeGreaterThan(0);
      expect(await admin.pttl(keys.tenant)).toBeGreaterThan(0);
    });
  },
);
