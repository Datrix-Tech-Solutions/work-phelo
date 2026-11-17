import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { InferenceProviderError, ProviderErrorCode } from '../inference/provider-error';
import { SafeErrorCode } from './error-codes';
import { recordErrorCode, requestIdFor } from './request-logging';

interface SafeError {
  statusCode: number;
  code: SafeErrorCode;
  message: string;
}
const providerErrors: Record<ProviderErrorCode, SafeError> = {
  CANCELLED: { statusCode: 408, code: 'CANCELLED', message: 'Request cancelled' },
  DEADLINE_EXCEEDED: {
    statusCode: 504,
    code: 'DEADLINE_EXCEEDED',
    message: 'Inference deadline exceeded',
  },
  UNAVAILABLE: { statusCode: 503, code: 'UNAVAILABLE', message: 'Inference unavailable' },
  INVALID_RESPONSE: {
    statusCode: 502,
    code: 'INVALID_RESPONSE',
    message: 'Inference response unavailable',
  },
};
const httpCodes: Partial<Record<number, SafeErrorCode>> = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  413: 'REQUEST_TOO_LARGE',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};

export function normalizeError(error: unknown): SafeError {
  try {
    if (error instanceof InferenceProviderError && Object.hasOwn(providerErrors, error.code)) {
      return { ...providerErrors[error.code] };
    }
    const parserType =
      error && typeof error === 'object' && 'type' in error ? error.type : undefined;
    const proposedStatus =
      error instanceof HttpException
        ? error.getStatus()
        : parserType === 'entity.too.large'
          ? 413
          : parserType === 'entity.parse.failed'
            ? 400
            : 500;
    const statusCode =
      Number.isInteger(proposedStatus) && proposedStatus >= 400 && proposedStatus <= 599
        ? proposedStatus
        : 500;
    return {
      statusCode,
      code: httpCodes[statusCode] ?? (statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_REJECTED'),
      message: statusCode >= 500 ? 'Service unavailable' : 'Request rejected',
    };
  } catch {
    return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Service unavailable' };
  }
}

@Catch()
export class SafeHttpExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const safe = normalizeError(error);
    recordErrorCode(res, safe.code);
    if (!res.headersSent) {
      res.status(safe.statusCode).json({ ...safe, requestId: requestIdFor(res) });
    }
  }
}
