import { ConsoleLogger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { performance } from 'perf_hooks';
import { SAFE_ERROR_CODES, SafeErrorCode } from './error-codes';

export interface HttpLogEntry {
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  errorCode?: SafeErrorCode;
}

export type HttpLogSink = (entry: HttpLogEntry) => void;
interface RequestMetadata {
  requestId: string;
  errorCode?: SafeErrorCode;
}
const metadata = new WeakMap<Response, RequestMetadata>();
const codes = new Set<string>(SAFE_ERROR_CODES);
const methods = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

export function requestIdFor(res: Response): string {
  let current = metadata.get(res);
  if (!current) {
    current = { requestId: randomUUID() };
    metadata.set(res, current);
  }
  return current.requestId;
}

export function recordErrorCode(res: Response, code: SafeErrorCode): void {
  requestIdFor(res);
  const current = metadata.get(res);
  if (current && codes.has(code)) current.errorCode = code;
}

export function writeHttpLog(entry: HttpLogEntry): void {
  new ConsoleLogger('HTTP').log(JSON.stringify(entry));
}

export function requestLogging(log: HttpLogSink = writeHttpLog) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const started = performance.now();
    res.setHeader('x-request-id', requestIdFor(res));
    const finish = () => {
      res.off('finish', finish);
      res.off('close', finish);
      const current = metadata.get(res);
      // Express route metadata is used; never req.url, req.path, params or query.
      const route: unknown = (req.route as { path?: unknown } | undefined)?.path;
      const entry: HttpLogEntry = {
        requestId: requestIdFor(res),
        method: methods.has(req.method) ? req.method : 'OTHER',
        route:
          typeof route === 'string' &&
          route.length <= 160 &&
          route.trim() === route &&
          /^\/[A-Za-z0-9/_.:-]*$/.test(route)
            ? route
            : '[unmatched]',
        status: res.writableFinished ? res.statusCode : 499,
        durationMs: Math.max(0, Math.round(performance.now() - started)),
        ...(current?.errorCode ? { errorCode: current.errorCode } : {}),
      };
      metadata.delete(res);
      // A broken log destination must not change the HTTP result or crash the process.
      try {
        log(entry);
      } catch {
        /* No unsafe fallback serialization. */
      }
    };
    res.once('finish', finish);
    res.once('close', finish);
    next();
  };
}
