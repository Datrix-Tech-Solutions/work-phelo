import { HttpException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import Redis from 'ioredis';
import { performance } from 'node:perf_hooks';

export class AiAdmissionError extends HttpException {
  constructor(
    status: 429 | 503,
    readonly retryAfter = 1,
  ) {
    super('AI admission unavailable', status);
  }
}

export const ADMISSION_SCRIPT = `
if redis.call('GET',KEYS[1]) ~= ARGV[1] then return {-1,0} end
if redis.call('EXISTS',KEYS[4]) ~= 0 then return {-1,0} end
local tm=redis.call('TIME'); local now=tonumber(tm[1])*1000+tonumber(tm[2])/1000
local states={}; local wait=0
for i=2,3 do
 local kind=redis.call('TYPE',KEYS[i]).ok
 if kind~='none' and kind~='hash' then return {-1,0} end
 local ttl=redis.call('PTTL',KEYS[i])
 if kind=='hash' and (ttl<=0 or ttl>120000) then return {-1,0} end
 local rate=tonumber(ARGV[2+(i-2)*2]); local cap=tonumber(ARGV[3+(i-2)*2])
 local old=redis.call('HMGET',KEYS[i],'tokens','at')
 local tokens=cap; local at=now
 if kind=='hash' and (not old[1] or not old[2]) then return {-1,0} end
 if kind=='hash' then
   tokens=tonumber(old[1]); at=tonumber(old[2])
   if not tokens or not at or tokens~=tokens or at~=at or tokens<0 or tokens>cap or at<0 or at>now+1000 then return {-1,0} end
   tokens=math.min(cap,tokens+math.max(0,now-at)*rate/60000)
 end
 states[i]=tokens
 if tokens<1 then wait=math.max(wait,(1-tokens)*60000/rate) end
end
-- Redis does not roll back script writes. Preflight known failures, then leave a
-- persistent failure marker until ALL writes succeed. Never repair it in-app.
if not redis.acl_check_cmd('SET',KEYS[4],KEYS[3],'NX') or
   not redis.acl_check_cmd('DEL',KEYS[4]) then return {-1,0} end
for i=2,3 do
 if not redis.acl_check_cmd('HSET',KEYS[i],'tokens',states[i]-1,'at',now) or
    not redis.acl_check_cmd('PEXPIRE',KEYS[i],120000) then return {-1,0} end
end
if wait>0 then return {0,math.min(60,math.max(1,math.ceil(wait/1000)))} end
if not redis.call('SET',KEYS[4],KEYS[3],'NX') then return {-1,0} end
for i=2,3 do
 redis.call('HSET',KEYS[i],'tokens',states[i]-1,'at',now)
 redis.call('PEXPIRE',KEYS[i],120000)
end
if redis.call('DEL',KEYS[4]) ~= 1 then return {-1,0} end
return {1,0}
`;

@Injectable()
export class AiRateAdmission implements OnModuleDestroy {
  private client?: Redis;
  private checked?: Promise<string>;

  async admit(tenantId: string, userId: string, method: string): Promise<void> {
    const started = performance.now();
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.perform(tenantId, userId, method),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            this.client?.disconnect();
            reject(new AiAdmissionError(503));
          }, 100);
        }),
      ]);
      if (performance.now() - started >= 100) throw new AiAdmissionError(503);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async perform(
    tenantId: string,
    userId: string,
    method: string,
  ): Promise<void> {
    try {
      if (process.env.AI_RESOURCE_SAFEGUARDS_ENABLED !== 'true')
        throw new Error();
      const encoded = process.env.AI_ADMISSION_KEY_HMAC_SECRET ?? '';
      const key = Buffer.from(encoded, 'base64');
      if (key.length !== 32 || key.toString('base64') !== encoded)
        throw new Error();
      if (!this.client || this.client.status === 'end') {
        const url = new URL(process.env.AI_ADMISSION_REDIS_URL ?? '');
        if (!['redis:', 'rediss:'].includes(url.protocol)) throw new Error();
        this.client = new Redis(url.toString(), {
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 0,
          connectTimeout: 100,
          commandTimeout: 100,
          retryStrategy: () => null,
          autoResendUnfulfilledCommands: false,
        });
        this.client.on('error', () => undefined);
        this.client.on('end', () => {
          this.checked = undefined;
        });
      }
      const client = this.client;
      if (!this.checked)
        this.checked = (async () => {
          if (client.status === 'wait') await client.connect();
          return 'connected';
        })();
      await this.checked;
      const memory = await client.info('memory');
      const server = await client.info('server');
      if (
        !/maxmemory_policy:noeviction\r?\n/.test(memory) ||
        !/maxmemory:[1-9]\d*\r?\n/.test(memory)
      )
        throw new Error();
      const runId = server.match(/run_id:([a-f0-9]+)\r?\n/)?.[1];
      const version = server.match(/redis_version:(\d+)\./)?.[1];
      if (!runId || !version || Number(version) < 7) throw new Error();
      const hash = (value: string) =>
        createHmac('sha256', key).update(value).digest('hex');
      const epoch = `${runId}:${hash('workphelo.ai.admission.v1')}`;
      const tenant = hash(JSON.stringify(['tenant', tenantId]));
      const owner = hash(JSON.stringify(['owner', tenantId, userId]));
      const operation =
        method === 'GET'
          ? 'read'
          : method === 'POST'
            ? 'write'
            : method === 'DELETE'
              ? 'delete'
              : undefined;
      if (!operation) throw new Error();
      const rates =
        operation === 'read' ? [600, 100, 60, 10] : [100, 20, 10, 2];
      const result: unknown = await client.eval(
        ADMISSION_SCRIPT,
        4,
        'ai:admission:v1:epoch',
        `ai:admission:v1:{${tenant}}:${operation}:tenant`,
        `ai:admission:v1:{${tenant}}:${operation}:owner:${owner}`,
        `ai:admission:v1:{${tenant}}:${operation}:incomplete`,
        epoch,
        ...rates,
      );
      if (!Array.isArray(result) || result.length !== 2) throw new Error();
      if (
        result[0] === 0 &&
        typeof result[1] === 'number' &&
        Number.isInteger(result[1]) &&
        result[1] >= 1 &&
        result[1] <= 60
      )
        throw new AiAdmissionError(429, result[1]);
      if (result[0] !== 1) throw new Error();
    } catch (error) {
      if (error instanceof AiAdmissionError) throw error;
      this.checked = undefined;
      throw new AiAdmissionError(503);
    }
  }

  async onModuleDestroy() {
    if (this.client && this.client.status !== 'end') this.client.disconnect();
  }
}
