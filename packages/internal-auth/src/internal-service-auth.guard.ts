import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { DEFAULT_MAX_CLOCK_SKEW_SECONDS, INTERNAL_SERVICE_AUTH_HEADERS } from './constants';
import { computeSignature, isUsableSecret, signaturesMatch } from './signing';

export interface AuthenticatedInternalRequest extends Request {
  internalServiceName: string;
}

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
      throw new UnauthorizedException('Invalid internal service credentials.');
    }

    const path = request.originalUrl.split('?')[0];
    const expected = computeSignature(secret, serviceName, timestamp, request.method, path);

    if (!signaturesMatch(expected, signature)) {
      throw new UnauthorizedException('Invalid internal service credentials.');
    }

    (request as AuthenticatedInternalRequest).internalServiceName = serviceName;
    return true;
  }

  private header(request: Request, name: string): string {
    const value = request.headers[name];
    return Array.isArray(value) ? (value[0]?.trim() ?? '') : value?.trim() || '';
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
