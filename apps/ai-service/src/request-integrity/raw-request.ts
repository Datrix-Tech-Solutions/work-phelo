import {
  HttpException,
  UnauthorizedException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { json, NextFunction, Request, Response } from 'express';

const securityHeaders = [
  'authorization',
  'cookie',
  'x-gateway-auth-context',
  'x-user-permissions',
  'x-gateway-permissions-signature',
  'x-ai-request-integrity',
  'idempotency-key',
  'content-type',
  'content-length',
  'transfer-encoding',
  'content-encoding',
] as const;
interface CapturedRequest {
  method: string;
  target: string;
  headers: Readonly<Record<string, string | undefined>>;
  body: Buffer;
}
const captured = new WeakMap<Request, CapturedRequest>();

export function readCapturedRequest(request: Request): CapturedRequest {
  const value = captured.get(request);
  if (
    !value ||
    request.method !== value.method ||
    request.originalUrl !== value.target ||
    securityHeaders.some((name) => request.headers[name] !== value.headers[name])
  )
    throw new UnauthorizedException();
  return { ...value, body: Buffer.from(value.body) };
}

// Strict capture is opt-in and isolated from foundation/eligibility parsing.
export function integrityJsonBoundary(enabled: boolean) {
  const ordinary = json({ limit: '32kb' });
  const strict = json({
    limit: '32kb',
    inflate: false,
    strict: false,
    verify: (req, _res, bytes) => {
      const value = captured.get(req as Request);
      if (!value) throw new UnauthorizedException();
      value.body = Buffer.from(bytes);
    },
  });
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl.split('?')[0].toLowerCase().startsWith('/api/conversations'))
      res.setHeader('Cache-Control', 'no-store');
    if (!enabled || !req.originalUrl.split('?')[0].startsWith('/api/conversations'))
      return ordinary(req, res, next);
    try {
      const headers: Record<string, string | undefined> = {};
      for (const name of securityHeaders) {
        const count = req.rawHeaders.filter(
          (value, index) => index % 2 === 0 && value.toLowerCase() === name,
        ).length;
        const value = req.headers[name];
        if (count > 1 || (value !== undefined && typeof value !== 'string'))
          throw new UnauthorizedException();
        headers[name] = value;
      }
      if (
        headers['content-type'] !== undefined &&
        headers['content-type'] !== 'application/json; charset=utf-8'
      )
        throw new UnsupportedMediaTypeException();
      if (
        headers.cookie !== undefined ||
        headers['transfer-encoding'] !== undefined ||
        (headers['content-encoding'] !== undefined && headers['content-encoding'] !== 'identity') ||
        (headers['content-type'] !== undefined &&
          headers['content-type'] !== 'application/json; charset=utf-8') ||
        (headers['content-length'] !== undefined &&
          !/^(0|[1-9][0-9]*)$/.test(headers['content-length']))
      )
        throw new UnauthorizedException();
      captured.set(req, {
        method: req.method,
        target: req.originalUrl,
        headers: Object.freeze(headers),
        body: Buffer.alloc(0),
      });
      return strict(req, res, next);
    } catch (error) {
      return next(error instanceof HttpException ? error : new UnauthorizedException());
    }
  };
}
