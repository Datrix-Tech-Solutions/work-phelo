import { createHash, createHmac, timingSafeEqual } from 'crypto';
import {
  INTERNAL_SERVICE_AUTH_HEADERS,
  INTERNAL_SERVICE_AUTH_MIN_SECRET_LENGTH,
} from './constants';

export function isUsableSecret(secret: string | undefined): secret is string {
  return typeof secret === 'string' && secret.length >= INTERNAL_SERVICE_AUTH_MIN_SECRET_LENGTH;
}

/** HMAC-SHA256 over `service:timestamp:METHOD:path` (path excludes the query string). */
export function computeSignature(
  secret: string,
  serviceName: string,
  timestamp: string,
  method: string,
  path: string,
): string {
  return createHmac('sha256', secret)
    .update([serviceName, timestamp, method.toUpperCase(), path].join(':'))
    .digest('hex');
}

export function signaturesMatch(expected: string, supplied: string): boolean {
  if (!/^[a-f\d]{64}$/i.test(supplied)) return false;
  const expectedBuffer = Buffer.from(expected, 'hex');
  const suppliedBuffer = Buffer.from(supplied, 'hex');
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** JSON with object keys sorted recursively, so both ends serialise a body identically. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value)) ?? '';
}

function sortKeys(value: unknown): unknown {
  // Mirror what JSON.stringify would send for Dates and other values with a toJSON.
  if (value && typeof (value as { toJSON?: unknown }).toJSON === 'function') {
    return sortKeys((value as { toJSON: () => unknown }).toJSON());
  }
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}

/** No body, and an empty `{}` that a body parser fills in, are the same thing to the signature. */
export function canonicalBody(body: unknown): string {
  if (body === undefined || body === null) return '';
  if (typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 0) {
    return '';
  }
  return canonicalJson(body);
}

/** Query pairs sorted by key then value, so ordering never changes the signature. */
export function canonicalQuery(entries: Iterable<[string, string]>): string {
  return [...entries]
    .sort(([ak, av], [bk, bv]) => (ak === bk ? (av < bv ? -1 : av > bv ? 1 : 0) : ak < bk ? -1 : 1))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

export interface RequestSignatureInput {
  serviceName: string;
  timestamp: string;
  method: string;
  path: string;
  query: Iterable<[string, string]>;
  body: unknown;
  actingUserId?: string;
}

/**
 * HMAC-SHA256 over the legacy fields plus a hash of the query, a hash of the body and the acting
 * user. Unlike the legacy signature it stops a captured request being replayed with a different
 * tenant, payload or user.
 */
export function computeRequestSignature(secret: string, input: RequestSignatureInput): string {
  return createHmac('sha256', secret)
    .update(
      [
        'v2',
        input.serviceName,
        input.timestamp,
        input.method.toUpperCase(),
        input.path,
        sha256(canonicalQuery(input.query)),
        sha256(canonicalBody(input.body)),
        input.actingUserId ?? '',
      ].join(':'),
    )
    .digest('hex');
}

export function buildAuthHeaders(input: {
  secret: string;
  serviceName: string;
  method: string;
  path: string;
  timestamp?: string;
  /** When set, a request signature covering these (plus the acting user) is sent as well. */
  signRequest?: {
    query: Iterable<[string, string]>;
    body: unknown;
    actingUserId?: string;
  };
}): Record<string, string> {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000).toString();
  const headers: Record<string, string> = {
    [INTERNAL_SERVICE_AUTH_HEADERS.service]: input.serviceName,
    [INTERNAL_SERVICE_AUTH_HEADERS.timestamp]: timestamp,
    [INTERNAL_SERVICE_AUTH_HEADERS.signature]: computeSignature(
      input.secret,
      input.serviceName,
      timestamp,
      input.method,
      input.path,
    ),
  };
  if (input.signRequest) {
    headers[INTERNAL_SERVICE_AUTH_HEADERS.requestSignature] = computeRequestSignature(
      input.secret,
      {
        serviceName: input.serviceName,
        timestamp,
        method: input.method,
        path: input.path,
        query: input.signRequest.query,
        body: input.signRequest.body,
        actingUserId: input.signRequest.actingUserId,
      },
    );
    if (input.signRequest.actingUserId) {
      headers[INTERNAL_SERVICE_AUTH_HEADERS.actingUser] = input.signRequest.actingUserId;
    }
  }
  return headers;
}
