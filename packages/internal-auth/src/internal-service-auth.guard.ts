import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import {
  DEFAULT_MAX_CLOCK_SKEW_SECONDS,
  INTERNAL_SERVICE_AUTH_HEADERS,
  INTERNAL_SERVICE_AUTH_REQUIRE_REQUEST_SIGNATURE_ENV,
} from './constants';
import {
  computeRequestSignature,
  computeSignature,
  isUsableSecret,
  signaturesMatch,
} from './signing';

export interface AuthenticatedInternalRequest extends Request {
  internalServiceName: string;
  /** The user the calling service acted for. Set only when the request signature verified. */
  internalActingUserId?: string;
}

const INVALID = 'Invalid internal service credentials.';

@Injectable()
export class InternalServiceAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const serviceName = this.header(request, INTERNAL_SERVICE_AUTH_HEADERS.service);
    const timestamp = this.header(request, INTERNAL_SERVICE_AUTH_HEADERS.timestamp);
    const signature = this.header(request, INTERNAL_SERVICE_AUTH_HEADERS.signature);
    const secret = process.env.INTERNAL_SERVICE_AUTH_SECRET?.trim();

    if (
      !serviceName ||
      !timestamp ||
      !signature ||
      !isUsableSecret(secret) ||
      !this.isAllowedService(serviceName) ||
      !this.isFreshTimestamp(timestamp)
    ) {
      throw new UnauthorizedException(INVALID);
    }

    const [path, queryString = ''] = request.originalUrl.split('?');
    const expected = computeSignature(secret, serviceName, timestamp, request.method, path);

    if (!signaturesMatch(expected, signature)) {
      throw new UnauthorizedException(INVALID);
    }

    const authenticated = request as AuthenticatedInternalRequest;
    const requestSignature = this.header(request, INTERNAL_SERVICE_AUTH_HEADERS.requestSignature);

    if (requestSignature) {
      // The legacy signature above only proves who is calling which route. This one also binds
      // the query (e.g. tenantId), the body and the acting user to the caller.
      const actingUserId = this.header(request, INTERNAL_SERVICE_AUTH_HEADERS.actingUser);
      const expectedRequest = computeRequestSignature(secret, {
        serviceName,
        timestamp,
        method: request.method,
        path,
        query: new URLSearchParams(queryString).entries(),
        body: (request as Request & { body?: unknown }).body,
        actingUserId: actingUserId || undefined,
      });
      if (!signaturesMatch(expectedRequest, requestSignature)) {
        throw new UnauthorizedException(INVALID);
      }
      if (actingUserId) authenticated.internalActingUserId = actingUserId;
    } else if (this.requiresRequestSignature()) {
      throw new UnauthorizedException(INVALID);
    }

    authenticated.internalServiceName = serviceName;
    return true;
  }

  private header(request: Request, name: string): string {
    const value = request.headers[name];
    return Array.isArray(value) ? (value[0]?.trim() ?? '') : value?.trim() || '';
  }

  private requiresRequestSignature(): boolean {
    return process.env[INTERNAL_SERVICE_AUTH_REQUIRE_REQUEST_SIGNATURE_ENV]?.trim() === 'true';
  }

  private isAllowedService(serviceName: string): boolean {
    const allowedServices = (process.env.INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    return allowedServices.includes(serviceName);
  }

  private isFreshTimestamp(timestamp: string): boolean {
    if (!/^\d+$/.test(timestamp)) return false;
    const timestampSeconds = Number(timestamp);
    const parsed = Number(process.env.INTERNAL_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS);
    const maxClockSkewSeconds =
      Number.isSafeInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CLOCK_SKEW_SECONDS;
    return (
      Number.isSafeInteger(timestampSeconds) &&
      Math.abs(Date.now() - timestampSeconds * 1000) <= maxClockSkewSeconds * 1000
    );
  }
}
