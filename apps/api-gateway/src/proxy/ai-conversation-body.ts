import { json, NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { AiRequestIntegrityError } from './ai-request-integrity';

const sizes = new WeakMap<Request, number>();
export function aiConversationBody(request: Request): unknown {
  const size = sizes.get(request);
  if (size === undefined) throw new AiRequestIntegrityError();
  return size === 0 ? undefined : (request.body as unknown);
}
export function aiConversationJsonBoundary() {
  const parser = json({
    limit: '32kb',
    strict: false,
    inflate: false,
    verify: (req, _res, bytes) => {
      if (!Buffer.from(bytes.toString('utf8'), 'utf8').equals(bytes))
        throw new Error('Invalid JSON encoding');
      sizes.set(req as Request, bytes.length);
    },
  });
  return (req: Request, res: Response, next: NextFunction) => {
    if (
      !/^\/api\/v1\/ai(?:\/|$)/i.test(req.originalUrl.split('?')[0]) ||
      /^\/api\/v1\/ai\/eligibility(?:\?|$)/.test(req.originalUrl)
    )
      return next();
    res.setHeader('Cache-Control', 'no-store');
    const reject = (status: number) => {
      // Do not reuse a connection after rejecting framing or an unread body.
      res.setHeader('Connection', 'close');
      return res.status(status).json({
        statusCode: status,
        code:
          status === 413
            ? 'REQUEST_TOO_LARGE'
            : status === 415
              ? 'UNSUPPORTED_MEDIA_TYPE'
              : 'INVALID_REQUEST',
        message: 'Request rejected',
        requestId: randomUUID(),
      });
    };
    const names = [
      'authorization',
      'cookie',
      'origin',
      'content-length',
      'content-type',
      'content-encoding',
      'transfer-encoding',
      'idempotency-key',
    ];
    for (const name of names) {
      if (
        req.rawHeaders.filter(
          (value, index) => index % 2 === 0 && value.toLowerCase() === name,
        ).length > 1 ||
        Array.isArray(req.headers[name])
      )
        return reject(400);
    }
    const length = req.headers['content-length'];
    if (
      req.headers['transfer-encoding'] !== undefined ||
      (length !== undefined && !/^(0|[1-9][0-9]*)$/.test(length))
    )
      return reject(400);
    if (length !== undefined && Number(length) > 32768) return reject(413);
    if (
      req.headers['content-encoding'] !== undefined &&
      req.headers['content-encoding'] !== 'identity'
    )
      return reject(415);
    const type = req.headers['content-type'];
    if (
      type !== undefined &&
      !/^application\/json(?:;\s*charset=utf-8)?$/i.test(type)
    )
      return reject(415);
    if (length !== undefined && length !== '0' && type === undefined)
      return reject(415);
    sizes.set(req, 0);
    parser(req, res, (error?: unknown) => {
      if (error) {
        const kind =
          typeof error === 'object' && 'type' in error ? error.type : undefined;
        reject(kind === 'entity.too.large' ? 413 : 400);
        return;
      }
      if (length !== undefined && Number(length) !== sizes.get(req)) {
        reject(400);
        return;
      }
      next();
    });
  };
}
