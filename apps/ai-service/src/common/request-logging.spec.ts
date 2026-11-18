import { EventEmitter } from 'events';
import { Request, Response } from 'express';
import { recordErrorCode, requestLogging, HttpLogEntry } from './request-logging';

describe('Safe HTTP logging', () => {
  function fixture(path: unknown = '/api/fixture/:id') {
    const req = {
      method: 'POST',
      route: { path },
      url: '/api/fixture/private?token=private',
      path: '/api/fixture/private',
      params: { id: 'private' },
      query: { token: 'private' },
      body: { prompt: 'private' },
      headers: {
        'x-request-id': 'injected\n"status":200',
        authorization: 'private',
        cookie: 'private',
      },
    } as unknown as Request;
    const setHeader = jest.fn();
    const res = Object.assign(new EventEmitter(), {
      statusCode: 403,
      writableFinished: true,
      setHeader,
    }) as unknown as Response;
    const entries: HttpLogEntry[] = [];
    const next = jest.fn();
    requestLogging((entry) => entries.push(entry))(req, res, next);
    return { req, res, entries, next, setHeader };
  }

  it('generates a safe correlation ID and logs only allowlisted fields', () => {
    const { res, entries, next, setHeader } = fixture();
    recordErrorCode(res, 'FORBIDDEN');
    res.emit('finish');
    expect(next).toHaveBeenCalledTimes(1);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      requestId: entries[0].requestId,
      method: 'POST',
      route: '/api/fixture/:id',
      status: 403,
      durationMs: entries[0].durationMs,
      errorCode: 'FORBIDDEN',
    });
    expect(JSON.stringify(entries)).not.toMatch(
      /private|injected|authorization|cookie|prompt|token/,
    );
    expect(entries[0].requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(Number.isFinite(entries[0].durationMs)).toBe(true);
    expect(setHeader).toHaveBeenCalledWith('x-request-id', entries[0].requestId);
    expect(res.listenerCount('close')).toBe(0);
  });

  it.each([
    null,
    ['/unsafe'],
    '/unsafe?token=private',
    '/unsafe\nprivate',
    '/unsafe\n',
    'x'.repeat(200),
  ])('does not log unsafe route metadata', (path) => {
    const { res, entries } = fixture(path);
    res.emit('finish');
    expect(entries[0].route).toBe('[unmatched]');
  });

  it('logs an interrupted response once without retaining listeners', () => {
    const { res, entries } = fixture();
    Object.assign(res, { writableFinished: false });
    res.emit('close');
    res.emit('finish');
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe(499);
    expect(res.listenerCount('finish')).toBe(0);
  });

  it('rejects unbounded correlation IDs and error codes', () => {
    const { req, res, entries } = fixture();
    req.headers['x-request-id'] = 'private'.repeat(10000);
    recordErrorCode(res, 'private' as 'FORBIDDEN');
    res.emit('finish');
    expect(entries[0].errorCode).toBeUndefined();
    expect(entries[0].requestId.length).toBe(36);
  });

  it('does not throw if the log sink fails', () => {
    const { req, res } = fixture();
    const response = Object.assign(new EventEmitter(), {
      statusCode: 200,
      writableFinished: true,
      setHeader: jest.fn(),
    }) as unknown as Response;
    requestLogging(() => {
      throw new Error('private-log-sink');
    })(req, response, jest.fn());
    expect(() => response.emit('finish')).not.toThrow();
    res.emit('finish');
  });
});
