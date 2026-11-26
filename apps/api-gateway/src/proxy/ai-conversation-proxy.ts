import { HttpException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { randomUUID, createHash, createHmac } from 'crypto';
import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import {
  AiRequestIntegrityError,
  AiRequestIntegritySigner,
  buildAiForwardingDescriptor,
  openSignedAiRequest,
  parseAiSigningConfig,
  selectAiAccessCredential,
  validateAiConversationTarget,
} from './ai-request-integrity';
import { aiConversationBody } from './ai-conversation-body';
import { AiAdmissionError } from './ai-rate-admission';

export const AI_CONVERSATION_TIMEOUT_MS = 5000;
const codes: Record<number, string> = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'REQUEST_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const uuid = (value: unknown) =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const date = (value: unknown) =>
  typeof value === 'string' &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const exact = (value: Record<string, unknown>, fields: string[]) =>
  Object.keys(value).sort().join(',') === [...fields].sort().join(',');
const cursor = (value: unknown) =>
  value === null ||
  (typeof value === 'string' &&
    value.length <= 256 &&
    /^[A-Za-z0-9_-]+$/.test(value));
function demoEnabled(): boolean {
  return (
    process.env.AI_INTERNAL_DEMO_ENABLED === 'true' &&
    ['development', 'test'].includes(process.env.NODE_ENV ?? '') &&
    process.env.AI_RUNTIME_SCOPE === 'isolated-demo'
  );
}
function metadata(value: unknown, created = false): boolean {
  return (
    record(value) &&
    exact(
      value,
      created
        ? ['id', 'createdAt', 'expiresAt']
        : ['id', 'createdAt', 'updatedAt', 'expiresAt'],
    ) &&
    uuid(value.id) &&
    date(value.createdAt) &&
    date(value.expiresAt) &&
    (created || date(value.updatedAt))
  );
}
function message(value: unknown, content: boolean): boolean {
  return (
    record(value) &&
    exact(value, [
      'id',
      'conversationId',
      'sequence',
      'role',
      'createdAt',
      ...(content ? ['content'] : []),
    ]) &&
    uuid(value.id) &&
    uuid(value.conversationId) &&
    Number.isInteger(value.sequence) &&
    Number(value.sequence) > 0 &&
    Number(value.sequence) <= 2147483647 &&
    (value.role === 'USER' || value.role === 'DEMO_ASSISTANT') &&
    date(value.createdAt) &&
    (!content ||
      (typeof value.content === 'string' &&
        Buffer.byteLength(value.content) <= 16384 &&
        Buffer.from(value.content).toString('utf8') === value.content))
  );
}
function validSuccess(value: unknown, method: string, target: string): boolean {
  const path = target.split('?')[0];
  if (method === 'POST') {
    if (!path.endsWith('/messages')) return metadata(value, true);
    if (!demoEnabled())
      return record(value) && value.role === 'USER' && message(value, false);
    if (!record(value)) return false;
    const { demo, ...userMessage } = value;
    return (
      userMessage.role === 'USER' &&
      message(userMessage, false) &&
      record(demo) &&
      exact(demo, ['mode', 'synthetic', 'reply']) &&
      demo.mode === 'scripted-demo' &&
      demo.synthetic === true &&
      message(demo.reply, true) &&
      record(demo.reply) &&
      demo.reply.role === 'DEMO_ASSISTANT' &&
      demo.reply.conversationId === userMessage.conversationId &&
      demo.reply.sequence === Number(userMessage.sequence) + 1
    );
  }
  if (!record(value)) return false;
  if (path === '/api/v1/ai/conversations')
    return (
      exact(value, ['items', 'nextCursor']) &&
      Array.isArray(value.items) &&
      value.items.length <= 100 &&
      value.items.every((item) => metadata(item)) &&
      cursor(value.nextCursor)
    );
  return (
    exact(value, ['conversation', 'messages']) &&
    metadata(value.conversation) &&
    record(value.messages) &&
    exact(value.messages, ['items', 'nextCursor']) &&
    Array.isArray(value.messages.items) &&
    value.messages.items.length <= 100 &&
    value.messages.items.every((item) => message(item, true)) &&
    cursor(value.messages.nextCursor)
  );
}
export function checkBrowserOrigin(req: Request) {
  const cookies: unknown = req.cookies;
  const cookieUsed = record(cookies) && cookies.access_token !== undefined;
  if (!cookieUsed || !['POST', 'DELETE'].includes(req.method)) return;
  const origin = req.headers.origin;
  const trusted = (
    process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000']
  ).map((value) => value.trim());
  const canonical = (value: string) => {
    try {
      const url = new URL(value);
      return (
        ['http:', 'https:'].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        url.origin === value &&
        !value.includes('*')
      );
    } catch {
      return false;
    }
  };
  if (
    typeof origin !== 'string' ||
    !canonical(origin) ||
    trusted.some((value) => !canonical(value)) ||
    !trusted.includes(origin)
  )
    throw new HttpException('Request rejected', 403);
}

export async function forwardAiConversation(
  req: Request,
  res: Response,
  serviceOrigin: string | undefined,
  authenticate: (token: string, deadlineAtMs: number) => Promise<RequestUser>,
  admit: (user: RequestUser, method: string) => Promise<void>,
): Promise<void> {
  const requestId = randomUUID(),
    deadlineAtMs = Date.now() + AI_CONVERSATION_TIMEOUT_MS;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('x-request-id', requestId);
  const reject = (status: number) => {
    if (!res.headersSent && !res.writableEnded && !res.destroyed)
      res.status(codes[status] ? status : 503).json({
        statusCode: codes[status] ? status : 503,
        code: codes[status] ?? codes[503],
        message: status >= 500 ? 'Service unavailable' : 'Request rejected',
        requestId,
      });
  };
  try {
    validateAiConversationTarget(req.method, req.originalUrl);
    const config = parseAiSigningConfig(process.env);
    if (!config.enabled || !serviceOrigin)
      throw new AiRequestIntegrityError(503);
    if (process.env.AI_INTERNAL_DEMO_ENABLED === 'true' && !demoEnabled())
      throw new AiRequestIntegrityError(503);
    if (
      !req.headers.authorization &&
      !(record(req.cookies as unknown) && req.cookies.access_token)
    )
      throw new HttpException('Unauthorized', 401);
    const token = selectAiAccessCredential(req);
    checkBrowserOrigin(req);
    const user = await authenticate(token, deadlineAtMs);
    await admit(user, req.method);
    if (Date.now() >= deadlineAtMs) throw new AiRequestIntegrityError(504);
    const { permissions: permissionList, ...identity } = user;
    const permissions = JSON.stringify(permissionList),
      secret = process.env.JWT_SECRET!;
    const identityAssertion = jwt.sign(
      {
        user: identity,
        permissionsHash: createHash('sha256').update(permissions).digest('hex'),
        tokenHash: createHash('sha256').update(token).digest('hex'),
      },
      secret,
      { issuer: 'workphelo-gateway', audience: 'ai', expiresIn: 30 },
    );
    const descriptor = buildAiForwardingDescriptor({
      method: req.method,
      externalTarget: req.originalUrl,
      headers: req.headers,
      rawHeaders: req.rawHeaders,
      cookies: req.cookies as unknown,
      body: aiConversationBody(req),
      identityAssertion,
      permissions,
      permissionsSignature: createHmac('sha256', secret)
        .update(`${user.id}:${user.tenantId}:${permissions}`)
        .digest('hex'),
      deadlineAtMs,
    });
    const signed = new AiRequestIntegritySigner(config).seal(descriptor);
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        req.off('aborted', aborted);
        res.off('close', aborted);
        resolve();
      };
      const fail = (error: AiRequestIntegrityError) => {
        reject(error.status);
        finish();
      };
      const aborted = () => {
        adapter.cancel();
        finish();
      };
      const adapter = openSignedAiRequest(
        signed,
        serviceOrigin,
        (upstream) => {
          const chunks: Buffer[] = [];
          let length = 0;
          upstream.on('data', (chunk: Buffer) => {
            length += chunk.length;
            if (length > 262144) {
              upstream.destroy();
              fail(new AiRequestIntegrityError(503));
              return;
            }
            chunks.push(chunk);
          });
          upstream.once('end', () => {
            if (done) return;
            if (Date.now() >= deadlineAtMs) {
              fail(new AiRequestIntegrityError(504));
              return;
            }
            const status = upstream.statusCode ?? 503;
            if (codes[status]) {
              if (status === 429) {
                const value = upstream.headers['retry-after'];
                const retry =
                  typeof value === 'string' &&
                  /^(?:[1-9]|[1-5][0-9]|60)$/.test(value)
                    ? value
                    : '1';
                res.setHeader('Retry-After', retry);
              }
              if (status === 409) {
                try {
                  const error: unknown = JSON.parse(
                    Buffer.concat(chunks).toString('utf8'),
                  );
                  if (
                    record(error) &&
                    error.code === 'AI_STORAGE_QUOTA_EXCEEDED'
                  ) {
                    res.status(409).json({
                      statusCode: 409,
                      code: 'AI_STORAGE_QUOTA_EXCEEDED',
                      message: 'AI storage capacity reached',
                      requestId,
                    });
                    finish();
                    return;
                  }
                } catch {
                  /* Never forward an untrusted upstream body. */
                }
              }
              reject(status);
              finish();
              return;
            }
            if (req.method === 'DELETE' && status === 204 && length === 0) {
              res.status(204).end();
              finish();
              return;
            }
            try {
              const bytes = Buffer.concat(chunks);
              if (!Buffer.from(bytes.toString('utf8')).equals(bytes))
                throw new Error();
              const value: unknown = JSON.parse(bytes.toString('utf8'));
              if (
                status !== (req.method === 'POST' ? 201 : 200) ||
                !validSuccess(value, req.method, req.originalUrl)
              )
                throw new Error();
              if (Date.now() >= deadlineAtMs) {
                fail(new AiRequestIntegrityError(504));
                return;
              }
              if (!res.destroyed) res.status(status).json(value);
              finish();
            } catch {
              fail(new AiRequestIntegrityError(503));
            }
          });
        },
        fail,
      );
      req.once('aborted', aborted);
      res.once('close', aborted);
      try {
        adapter.send();
      } catch (error) {
        adapter.cancel();
        fail(
          error instanceof AiRequestIntegrityError
            ? error
            : new AiRequestIntegrityError(503),
        );
      }
    });
  } catch (error) {
    if (error instanceof AiAdmissionError && error.getStatus() === 429)
      res.setHeader('Retry-After', String(error.retryAfter));
    reject(
      error instanceof AiRequestIntegrityError
        ? error.status
        : error instanceof HttpException
          ? error.getStatus()
          : 503,
    );
  }
}
