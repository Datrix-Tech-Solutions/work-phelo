import { GatewayTimeoutException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { verify } from 'jsonwebtoken';
import { TrustedContextService } from '../auth/trusted-context.service';
import { RequestNonceStore } from '../persistence/request-nonce.store';
import { readCapturedRequest } from './raw-request';
import { RequestVerificationKeys } from './verification-keys';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const fieldHash = (field: string, value: string) =>
  hash(JSON.stringify(['workphelo.ai.request', 1, field, value]));
const hex = /^[a-f0-9]{64}$/;
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const same = (claimed: unknown, actual: string) =>
  typeof claimed === 'string' &&
  hex.test(claimed) &&
  timingSafeEqual(Buffer.from(claimed, 'hex'), Buffer.from(actual, 'hex'));
const payloadFields = [
  'aud',
  'bodyHash',
  'bodyLength',
  'contentType',
  'deadlineAtMs',
  'exp',
  'iat',
  'idempotencyKeyHash',
  'identityAssertionHash',
  'iss',
  'jti',
  'method',
  'pathHash',
  'queryHash',
  'requestId',
  'tokenHash',
  'v',
]
  .sort()
  .join(',');

declare const verifiedBrand: unique symbol;
export interface VerifiedAiRequest {
  readonly [verifiedBrand]: true;
}
const accepted = new WeakMap<
  VerifiedAiRequest,
  Readonly<{ tenantId: string; ownerUserId: string; deadlineAtMs: number; requestId: string }>
>();
export function requireConsumedAiRequest(context: VerifiedAiRequest) {
  const value = accepted.get(context);
  if (!value) throw new UnauthorizedException();
  if (value.deadlineAtMs <= Date.now()) throw new GatewayTimeoutException();
  return value;
}

@Injectable()
export class RequestIntegrityService {
  constructor(
    private readonly keys: RequestVerificationKeys,
    private readonly authentication: TrustedContextService,
    private readonly nonces: RequestNonceStore,
  ) {}

  async authenticateAndConsume(request: Request): Promise<VerifiedAiRequest> {
    this.keys.requireEnabled();
    const user = this.authentication.verifyRequest(request);
    let proof: Record<string, unknown>;
    try {
      const received = readCapturedRequest(request),
        headers = received.headers;
      const compact = headers['x-ai-request-integrity'];
      if (typeof compact !== 'string' || compact.length > 8192) throw new Error();
      const parts = compact.split('.');
      if (parts.length !== 3) throw new Error();
      const decode = (part: string): unknown => {
        if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new Error();
        const bytes = Buffer.from(part, 'base64url');
        if (bytes.toString('base64url') !== part) throw new Error();
        const value: unknown = JSON.parse(bytes.toString('utf8'));
        // Gateway emits JSON.stringify: this also rejects duplicate JSON member names.
        if (!bytes.equals(Buffer.from(JSON.stringify(value), 'utf8'))) throw new Error();
        return value;
      };
      const header = decode(parts[0]);
      if (
        !object(header) ||
        Object.keys(header).sort().join(',') !== 'alg,kid,typ' ||
        header.alg !== 'HS256' ||
        header.typ !== 'workphelo.ai.request+jwt' ||
        typeof header.kid !== 'string' ||
        !hex.test(header.kid)
      )
        throw new Error();
      if (
        !/^[A-Za-z0-9_-]{43}$/.test(parts[2]) ||
        Buffer.from(parts[2], 'base64url').toString('base64url') !== parts[2]
      )
        throw new Error();
      const decoded = decode(parts[1]);
      if (!object(decoded) || Object.keys(decoded).sort().join(',') !== payloadFields)
        throw new Error();
      const verified = verify(compact, this.keys.get(header.kid), {
        algorithms: ['HS256'],
        issuer: 'workphelo-gateway',
        audience: 'workphelo-ai-request',
        maxAge: '10s',
        clockTolerance: 0,
      });
      if (!object(verified)) throw new Error();
      proof = verified;
      const now = Date.now();
      if (
        proof.v !== 1 ||
        proof.iss !== 'workphelo-gateway' ||
        proof.aud !== 'workphelo-ai-request' ||
        typeof proof.iat !== 'number' ||
        !Number.isSafeInteger(proof.iat) ||
        proof.iat < 0 ||
        proof.iat * 1000 > now + 1000 ||
        typeof proof.exp !== 'number' ||
        !Number.isSafeInteger(proof.exp) ||
        proof.exp <= proof.iat ||
        proof.exp - proof.iat > 10 ||
        proof.exp * 1000 <= now ||
        typeof proof.deadlineAtMs !== 'number' ||
        !Number.isSafeInteger(proof.deadlineAtMs) ||
        proof.deadlineAtMs <= now ||
        proof.deadlineAtMs > proof.iat * 1000 + 11000 ||
        typeof proof.jti !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test(proof.jti) ||
        Buffer.from(proof.jti, 'base64url').toString('base64url') !== proof.jti ||
        typeof proof.requestId !== 'string' ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
          proof.requestId,
        ) ||
        typeof proof.bodyLength !== 'number' ||
        !Number.isSafeInteger(proof.bodyLength) ||
        proof.bodyLength < 0 ||
        proof.bodyLength > 32768
      )
        throw new Error();
      const target = received.target;
      if (target.length > 2048 || !/^[\x21-\x7e]+$/.test(target) || target.includes('#'))
        throw new Error();
      const question = target.indexOf('?'),
        path = question < 0 ? target : target.slice(0, question),
        query = question < 0 ? '' : target.slice(question + 1);
      if (question >= 0 && !query) throw new Error();
      const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
      if (!new RegExp(`^/api/conversations(?:/${uuid}(?:/messages)?)?$`).test(path))
        throw new Error();
      const methods = path.endsWith('/messages')
        ? ['POST']
        : path === '/api/conversations'
          ? ['GET', 'POST']
          : ['GET', 'DELETE'];
      if (!methods.includes(received.method) || proof.method !== received.method) throw new Error();
      const seen = new Set<string>();
      if (query) {
        if (received.method !== 'GET') throw new Error();
        for (const pair of query.split('&')) {
          const equals = pair.indexOf('=');
          if (equals < 1 || pair.indexOf('=', equals + 1) >= 0 || /%(?![0-9a-fA-F]{2})/.test(pair))
            throw new Error();
          const name = pair.slice(0, equals),
            value = pair.slice(equals + 1);
          if (!['limit', 'cursor'].includes(name) || seen.has(name) || !value || value.length > 512)
            throw new Error();
          const decodedValue = decodeURIComponent(value);
          if (
            name === 'limit'
              ? !/^(?:[1-9]|[1-9][0-9]|100)$/.test(decodedValue)
              : !/^[A-Za-z0-9_-]+$/.test(decodedValue)
          )
            throw new Error();
          seen.add(name);
        }
      }
      const credential = headers.authorization;
      if (
        typeof credential !== 'string' ||
        !/^Bearer [\x21-\x7e]+$/.test(credential) ||
        !headers['x-gateway-auth-context']
      )
        throw new Error();
      const idempotencyKey = headers['idempotency-key'];
      if (
        idempotencyKey !== undefined &&
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(idempotencyKey)
      )
        throw new Error();
      if (
        proof.bodyLength !== received.body.length ||
        headers['content-length'] !== String(received.body.length) ||
        (received.method !== 'POST' && received.body.length !== 0) ||
        proof.contentType !== (headers['content-type'] ?? '') ||
        (received.body.length > 0 && proof.contentType !== 'application/json; charset=utf-8') ||
        !same(proof.pathHash, fieldHash('path', path)) ||
        !same(proof.queryHash, fieldHash('raw-query', query)) ||
        !same(proof.bodyHash, hash(received.body)) ||
        !same(proof.tokenHash, hash(credential.slice(7))) ||
        !same(proof.identityAssertionHash, hash(headers['x-gateway-auth-context'])) ||
        !same(
          proof.idempotencyKeyHash,
          fieldHash('idempotency-key', JSON.stringify(idempotencyKey ?? null)),
        )
      )
        throw new Error();
    } catch {
      throw new UnauthorizedException();
    }
    const digest = createHash('sha256')
      .update(
        JSON.stringify([
          'workphelo.ai.request-nonce',
          1,
          'workphelo-gateway',
          'workphelo-ai-request',
          proof.jti,
        ]),
      )
      .digest();
    await this.nonces.consume(digest, proof.iat * 1000, proof.exp * 1000, proof.deadlineAtMs);
    const effectiveDeadline = Math.min(proof.deadlineAtMs, proof.exp * 1000);
    if (effectiveDeadline <= Date.now()) throw new GatewayTimeoutException();
    const context = Object.freeze({}) as VerifiedAiRequest;
    accepted.set(
      context,
      Object.freeze({
        tenantId: user.tenantId,
        ownerUserId: user.id,
        deadlineAtMs: effectiveDeadline,
        requestId: proof.requestId,
      }),
    );
    return context;
  }
}
