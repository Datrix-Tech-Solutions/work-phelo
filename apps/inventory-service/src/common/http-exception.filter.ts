import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') return;
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    if (error instanceof HttpException) {
      return res.status(error.getStatus()).json(error.getResponse());
    }
    const req = http.getRequest<Request>();
    this.logger.error(
      'Unhandled exception on ' + req.method + ' ' + req.path,
      error instanceof Error ? error.stack : 'Non-Error exception',
    );
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: 'An unexpected error occurred',
      error: 'Internal Server Error',
    });
  }
}
