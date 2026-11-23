import { Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

export function requestLogging(logger: Pick<Logger, 'log'> = new Logger('HTTP')) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      logger.log(
        req.method + ' ' + req.path + ' ' + res.statusCode + ' ' + (Date.now() - startedAt) + 'ms',
      );
    });
    next();
  };
}
