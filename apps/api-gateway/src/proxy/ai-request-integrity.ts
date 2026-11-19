import {
  createHash,
  createSecretKey,
  KeyObject,
  randomBytes,
  randomUUID,
} from 'crypto';
import * as http from 'http';
import * as https from 'https';
import * as jwt from 'jsonwebtoken';

export const AI_INTEGRITY_HEADER = 'x-ai-request-integrity';
export const AI_INTEGRITY_TYPE = 'workphelo.ai.request+jwt';
export class AiRequestIntegrityError extends Error {
  constructor(readonly status: 400 | 404 | 413 | 415 | 503 | 504 = 400) {
    super('AI request integrity unavailable or invalid');
  }
}
const sha256 = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');
const fieldHash = (field: string, value: string) =>
  sha256(JSON.stringify(['workphelo.ai.request', 1, field, value]));
const text = (value: unknown): value is string =>
  typeof value === 'string' && !!value && /^[\x21-\x7e]+$/.test(value);

export type AiSigningConfig = Readonly<
  { enabled: false } | { enabled: true; keyId: string; key: KeyObject }
>;
export function parseAiSigningConfig(
  env: Record<string, unknown>,
): AiSigningConfig {
  if (
    env.AI_REQUEST_SIGNING_ENABLED === undefined ||
    env.AI_REQUEST_SIGNING_ENABLED === 'false'
  )
    return Object.freeze({ enabled: false });
  if (
    env.AI_REQUEST_SIGNING_ENABLED !== 'true' ||
    !['test', 'development'].includes(String(env.NODE_ENV))
  )
    throw new AiRequestIntegrityError(503);
  let material: Buffer | undefined;
  try {
    const encoded = env.AI_REQUEST_SIGNING_KEY,
      keyId = env.AI_REQUEST_SIGNING_KEY_ID;
    if (
      typeof encoded !== 'string' ||
      !/^[A-Za-z0-9+/]{43}=$/.test(encoded) ||
      typeof keyId !== 'string' ||
      !/^[a-f0-9]{64}$/.test(keyId)
    )
      throw new Error();
    material = Buffer.from(encoded, 'base64');
    if (
      material.length !== 32 ||
      material.toString('base64') !== encoded ||
      sha256(material) !== keyId
    )
      throw new Error();
    for (const name of [
      'JWT_SECRET',
      'FIELD_ENCRYPTION_KEY',
      'HR_FIELD_ENCRYPTION_KEY',
      'REINSURANCE_MAILBOX_TOKEN_ENCRYPTION_KEY',
    ]) {
      const shared = env[name];
      if (
        typeof shared === 'string' &&
        [
          shared,
          Buffer.from(shared, 'utf8').toString('base64'),
          /^[a-f0-9]{64}$/i.test(shared)
            ? Buffer.from(shared, 'hex').toString('base64')
            : '',
        ].includes(encoded)
      )
        throw new Error();
    }
    for (const name of ['AI_MESSAGE_ENCRYPTION_KEYS', 'AI_FINGERPRINT_KEYS']) {
      if (env[name] === undefined) continue;
      const encodedRing = env[name];
      if (typeof encodedRing !== 'string') throw new Error();
      const entries: unknown = JSON.parse(encodedRing);
      if (
        !Array.isArray(entries) ||
        entries.some(
          (entry: unknown) =>
            !entry ||
            typeof entry !== 'object' ||
            ('key' in entry && entry.key === encoded),
        )
      )
        throw new Error();
    }
    return Object.freeze({
      enabled: true,
      keyId,
      key: createSecretKey(material),
    });
  } catch {
    throw new AiRequestIntegrityError(503);
  } finally {
    material?.fill(0);
  }
}

function header(
  headers: http.IncomingHttpHeaders,
  name: string,
  rawHeaders?: string[],
) {
  if (
    rawHeaders &&
    rawHeaders.filter(
      (_, index) => index % 2 === 0 && rawHeaders[index].toLowerCase() === name,
    ).length > 1
  )
    throw new AiRequestIntegrityError();
  const value = headers[name];
  if (Array.isArray(value)) throw new AiRequestIntegrityError();
  return value;
}

export function selectAiAccessCredential(input: {
  headers: http.IncomingHttpHeaders;
  cookies?: unknown;
  rawHeaders?: string[];
}): string {
  const authorization = header(
    input.headers,
    'authorization',
    input.rawHeaders,
  );
  const rawCookie = header(input.headers, 'cookie', input.rawHeaders);
  if (
    rawCookie &&
    rawCookie
      .split(';')
      .filter((pair) => pair.trim().split('=')[0] === 'access_token').length > 1
  )
    throw new AiRequestIntegrityError();
  const cookies = input.cookies;
  const cookie =
    cookies &&
    typeof cookies === 'object' &&
    !Array.isArray(cookies) &&
    Object.hasOwn(cookies, 'access_token')
      ? (cookies as Record<string, unknown>).access_token
      : undefined;
  if (rawCookie) {
    const access = rawCookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('access_token='));
    if (access) {
      try {
        if (
          cookie === undefined ||
          decodeURIComponent(access.slice(13)) !== cookie
        )
          throw new Error();
      } catch {
        throw new AiRequestIntegrityError();
      }
    }
  }
  const bearer =
    authorization === undefined
      ? undefined
      : /^Bearer ([^\s]+)$/i.exec(authorization)?.[1];
  if (
    (authorization !== undefined && !bearer) ||
    (cookie !== undefined && (!text(cookie) || cookie.length > 16384))
  )
    throw new AiRequestIntegrityError();
  if (cookie !== undefined && bearer !== undefined && cookie !== bearer)
    throw new AiRequestIntegrityError();
  const token = cookie ?? bearer;
  if (!text(token) || token.length > 16384) throw new AiRequestIntegrityError();
  return token;
}

declare const descriptorBrand: unique symbol;
export interface AiForwardingDescriptor {
  readonly [descriptorBrand]: true;
}
declare const signedBrand: unique symbol;
export interface SignedAiForwardingDescriptor {
  readonly [signedBrand]: true;
}
interface Snapshot {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  rawQuery: string;
  body: Buffer;
  contentType: string;
  accessToken: string;
  identityAssertion: string;
  permissions: string;
  permissionsSignature: string;
  idempotencyKey: string | null;
  deadlineAtMs: number;
  requestId: string;
}
const descriptors = new WeakMap<AiForwardingDescriptor, Readonly<Snapshot>>();
const signedDescriptors = new WeakMap<
  SignedAiForwardingDescriptor,
  { snapshot: Readonly<Snapshot>; proof: string; proofExpiresAtMs: number }
>();

export interface AiForwardingInput {
  method: string;
  externalTarget: string;
  headers: http.IncomingHttpHeaders;
  rawHeaders?: string[];
  cookies?: unknown;
  body?: unknown;
  identityAssertion: string;
  permissions: string;
  permissionsSignature: string;
  deadlineAtMs: number;
}

export function validateAiConversationTarget(
  method: string,
  target: string,
): void {
  if (
    typeof target !== 'string' ||
    target.length > 2048 ||
    !/^[\x21-\x7e]+$/.test(target) ||
    target.includes('#')
  )
    throw new AiRequestIntegrityError();
  const path = target.split('?')[0];
  const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
  if (
    !new RegExp(`^/api/v1/ai/conversations(?:/${uuid}(?:/messages)?)?$`).test(
      path,
    )
  )
    throw new AiRequestIntegrityError(404);
  const methods = path.endsWith('/messages')
    ? ['POST']
    : path === '/api/v1/ai/conversations'
      ? ['GET', 'POST']
      : ['GET', 'DELETE'];
  if (!methods.includes(method)) throw new AiRequestIntegrityError(404);
}

// The descriptor is the final representation consumed by the private HTTP adapter.
export function buildAiForwardingDescriptor(
  input: AiForwardingInput,
): AiForwardingDescriptor {
  try {
    const target = input.externalTarget;
    validateAiConversationTarget(input.method, target);
    if (
      typeof target !== 'string' ||
      target.length > 2048 ||
      !/^[\x21-\x7e]+$/.test(target) ||
      target.includes('#')
    )
      throw new AiRequestIntegrityError();
    const question = target.indexOf('?');
    const externalPath = question < 0 ? target : target.slice(0, question);
    const rawQuery = question < 0 ? '' : target.slice(question + 1);
    if (question >= 0 && !rawQuery) throw new AiRequestIntegrityError();
    const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
    const match = new RegExp(
      `^/api/v1/ai(/conversations(?:/${uuid}(?:/messages)?)?)$`,
    ).exec(externalPath);
    if (!match) throw new AiRequestIntegrityError(404);
    const suffix = match[1];
    const methods = suffix.endsWith('/messages')
      ? ['POST']
      : suffix === '/conversations'
        ? ['GET', 'POST']
        : ['GET', 'DELETE'];
    if (!methods.includes(input.method)) throw new AiRequestIntegrityError(404);
    const seen = new Set<string>();
    if (rawQuery) {
      if (input.method !== 'GET') throw new AiRequestIntegrityError();
      for (const pair of rawQuery.split('&')) {
        const equals = pair.indexOf('=');
        if (
          equals < 1 ||
          pair.indexOf('=', equals + 1) >= 0 ||
          /%(?![0-9a-fA-F]{2})/.test(pair)
        )
          throw new AiRequestIntegrityError();
        const name = pair.slice(0, equals),
          value = pair.slice(equals + 1);
        if (
          !['limit', 'cursor'].includes(name) ||
          seen.has(name) ||
          !value ||
          value.length > 512
        )
          throw new AiRequestIntegrityError();
        const decoded = decodeURIComponent(value);
        if (
          name === 'limit'
            ? !/^(?:[1-9]|[1-9][0-9]|100)$/.test(decoded)
            : !/^[A-Za-z0-9_-]+$/.test(decoded)
        )
          throw new AiRequestIntegrityError();
        seen.add(name);
      }
    }
    if (
      header(input.headers, 'transfer-encoding', input.rawHeaders) !== undefined
    )
      throw new AiRequestIntegrityError();
    const encoding = header(
      input.headers,
      'content-encoding',
      input.rawHeaders,
    );
    if (encoding !== undefined && encoding.toLowerCase() !== 'identity')
      throw new AiRequestIntegrityError(415);
    const length = header(input.headers, 'content-length', input.rawHeaders);
    if (length !== undefined && !/^(0|[1-9][0-9]*)$/.test(length))
      throw new AiRequestIntegrityError();
    const suppliedType = header(
      input.headers,
      'content-type',
      input.rawHeaders,
    );
    if (
      suppliedType !== undefined &&
      !/^application\/json(?:;\s*charset=utf-8)?$/i.test(suppliedType)
    )
      throw new AiRequestIntegrityError(415);
    if (
      input.method !== 'POST' &&
      (input.body !== undefined || (length !== undefined && length !== '0'))
    )
      throw new AiRequestIntegrityError();
    if (input.body !== undefined && suppliedType === undefined)
      throw new AiRequestIntegrityError(415);
    const serialized =
      input.body === undefined ? undefined : JSON.stringify(input.body);
    if (input.body !== undefined && serialized === undefined)
      throw new AiRequestIntegrityError();
    const body =
      serialized === undefined
        ? Buffer.alloc(0)
        : Buffer.from(serialized, 'utf8');
    if (body.length > 32768) throw new AiRequestIntegrityError(413);
    if (input.body === undefined && length !== undefined && length !== '0')
      throw new AiRequestIntegrityError();
    const key = header(input.headers, 'idempotency-key', input.rawHeaders);
    if (key !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(key))
      throw new AiRequestIntegrityError();
    if (
      !text(input.identityAssertion) ||
      input.identityAssertion.length > 32768 ||
      typeof input.permissions !== 'string' ||
      input.permissions.length > 16384 ||
      !/^[\x20-\x7e]*$/.test(input.permissions) ||
      !/^[a-f0-9]{64}$/.test(input.permissionsSignature)
    )
      throw new AiRequestIntegrityError();
    const permissions: unknown = JSON.parse(input.permissions);
    if (
      !Array.isArray(permissions) ||
      permissions.some((entry: unknown) => typeof entry !== 'string')
    )
      throw new AiRequestIntegrityError();
    if (
      !Number.isSafeInteger(input.deadlineAtMs) ||
      input.deadlineAtMs <= Date.now() ||
      input.deadlineAtMs > Date.now() + 10000
    )
      throw new AiRequestIntegrityError();
    const snapshot: Snapshot = {
      method: input.method as Snapshot['method'],
      path: '/api' + suffix,
      rawQuery,
      body,
      contentType:
        serialized === undefined ? '' : 'application/json; charset=utf-8',
      accessToken: selectAiAccessCredential(input),
      identityAssertion: input.identityAssertion,
      permissions: input.permissions,
      permissionsSignature: input.permissionsSignature,
      idempotencyKey: key ?? null,
      deadlineAtMs: input.deadlineAtMs,
      requestId: randomUUID(),
    };
    const descriptor = Object.freeze({}) as AiForwardingDescriptor;
    descriptors.set(descriptor, Object.freeze(snapshot));
    return descriptor;
  } catch (error) {
    if (error instanceof AiRequestIntegrityError) throw error;
    throw new AiRequestIntegrityError();
  }
}

export class AiRequestIntegritySigner {
  private readonly config: AiSigningConfig;
  constructor(config: AiSigningConfig) {
    let material: Buffer | undefined;
    try {
      if (config.enabled === false) {
        this.config = Object.freeze({ enabled: false });
        return;
      }
      if (
        config.enabled !== true ||
        !(config.key instanceof KeyObject) ||
        config.key.type !== 'secret' ||
        config.key.symmetricKeySize !== 32
      )
        throw new Error();
      const exported = config.key.export();
      if (!Buffer.isBuffer(exported)) throw new Error();
      material = exported;
      if (sha256(material) !== config.keyId) throw new Error();
      this.config = Object.freeze({
        enabled: true,
        keyId: config.keyId,
        key: config.key,
      });
    } catch {
      throw new AiRequestIntegrityError(503);
    } finally {
      material?.fill(0);
    }
  }
  seal(descriptor: AiForwardingDescriptor): SignedAiForwardingDescriptor {
    if (!this.config.enabled || process.env.NODE_ENV === 'production')
      throw new AiRequestIntegrityError(503);
    const snapshot = descriptors.get(descriptor);
    if (!snapshot) throw new AiRequestIntegrityError();
    const now = Math.floor(Date.now() / 1000);
    const exp = Math.min(now + 10, Math.ceil(snapshot.deadlineAtMs / 1000));
    if (
      snapshot.deadlineAtMs <= Date.now() ||
      snapshot.deadlineAtMs > Date.now() + 10000 ||
      exp <= now
    )
      throw new AiRequestIntegrityError();
    const proof = jwt.sign(
      {
        v: 1,
        method: snapshot.method,
        pathHash: fieldHash('path', snapshot.path),
        queryHash: fieldHash('raw-query', snapshot.rawQuery),
        bodyHash: sha256(snapshot.body),
        bodyLength: snapshot.body.length,
        contentType: snapshot.contentType,
        idempotencyKeyHash: fieldHash(
          'idempotency-key',
          JSON.stringify(snapshot.idempotencyKey),
        ),
        tokenHash: sha256(snapshot.accessToken),
        identityAssertionHash: sha256(snapshot.identityAssertion),
        deadlineAtMs: snapshot.deadlineAtMs,
        requestId: snapshot.requestId,
        jti: randomBytes(32).toString('base64url'),
        iat: now,
        exp,
      },
      this.config.key,
      {
        algorithm: 'HS256',
        keyid: this.config.keyId,
        issuer: 'workphelo-gateway',
        audience: 'workphelo-ai-request',
        header: { alg: 'HS256', typ: AI_INTEGRITY_TYPE },
      },
    );
    const signed = Object.freeze({}) as SignedAiForwardingDescriptor;
    signedDescriptors.set(signed, {
      snapshot,
      proof,
      proofExpiresAtMs: exp * 1000,
    });
    return signed;
  }
}

// One adapter owns both request options and the final body write; no reserialization.
export function openSignedAiRequest(
  signed: SignedAiForwardingDescriptor,
  serviceOrigin: string,
  onResponse: (response: http.IncomingMessage) => void,
  onFailure: (error: AiRequestIntegrityError) => void,
) {
  const value = signedDescriptors.get(signed);
  if (!value) throw new AiRequestIntegrityError();
  const { snapshot, proof } = value;
  const deadline = Math.min(snapshot.deadlineAtMs, value.proofExpiresAtMs);
  let url: URL;
  try {
    url = new URL(serviceOrigin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error();
  } catch {
    throw new AiRequestIntegrityError();
  }
  if (deadline <= Date.now()) throw new AiRequestIntegrityError();
  const headers: http.OutgoingHttpHeaders = {
    authorization: `Bearer ${snapshot.accessToken}`,
    'x-gateway-auth-context': snapshot.identityAssertion,
    'x-user-permissions': snapshot.permissions,
    'x-gateway-permissions-signature': snapshot.permissionsSignature,
    [AI_INTEGRITY_HEADER]: proof,
    'content-length': snapshot.body.length,
    ...(snapshot.contentType ? { 'content-type': snapshot.contentType } : {}),
    ...(snapshot.idempotencyKey !== null
      ? { 'idempotency-key': snapshot.idempotencyKey }
      : {}),
  };
  let settled = false;
  const request = (url.protocol === 'https:' ? https : http).request(
    {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      method: snapshot.method,
      path: snapshot.path + (snapshot.rawQuery ? '?' + snapshot.rawQuery : ''),
      headers,
      agent: false,
    },
    (response) => {
      if (settled) {
        response.destroy();
        return;
      }
      response.once('end', () => {
        settled = true;
        clearTimeout(timer);
      });
      response.once('error', () => fail(503));
      response.once('aborted', () => fail(503));
      onResponse(response);
    },
  );
  let sent = false;
  // The native request is deliberately private: callers cannot change headers or write bytes.
  const fail = (status: 503 | 504) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    request.destroy();
    onFailure(new AiRequestIntegrityError(status));
  };
  const timer = setTimeout(() => fail(504), Math.max(1, deadline - Date.now()));
  timer.unref();
  request.once('close', () => {
    if (settled) clearTimeout(timer);
    else fail(503);
  });
  request.on('error', () => fail(503));
  return Object.freeze({
    cancel() {
      fail(503);
    },
    send() {
      if (sent || settled || deadline <= Date.now()) {
        request.destroy();
        throw new AiRequestIntegrityError();
      }
      sent = true;
      request.end(snapshot.body);
    },
  });
}
