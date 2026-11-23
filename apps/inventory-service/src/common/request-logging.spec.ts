import { NextFunction, Request, Response } from 'express';
import { requestLogging } from './request-logging';

it('logs method/path/status/timing, never headers or query parameters', () => {
  const logger = { log: jest.fn() };
  const next = jest.fn();
  let finish: () => void = () => undefined;
  const res = {
    statusCode: 200,
    on: (_event: string, callback: () => void) => {
      finish = callback;
    },
  };
  requestLogging(logger)(
    {
      method: 'GET',
      path: '/api/health',
      url: '/api/health?token=private-secret',
      headers: { authorization: 'private-secret' },
    } as unknown as Request,
    res as unknown as Response,
    next as NextFunction,
  );
  finish();
  expect(next).toHaveBeenCalledTimes(1);
  expect(logger.log).toHaveBeenCalledWith(expect.stringMatching(/^GET \/api\/health 200 \d+ms$/));
  expect(JSON.stringify(logger.log.mock.calls)).not.toContain('private-secret');
});
