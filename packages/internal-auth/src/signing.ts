import { createHmac, timingSafeEqual } from 'crypto';
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

export function buildAuthHeaders(input: {
  secret: string;
  serviceName: string;
  method: string;
  path: string;
  timestamp?: string;
}): Record<string, string> {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000).toString();
  return {
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
}
