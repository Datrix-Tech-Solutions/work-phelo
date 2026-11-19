import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { SafeHttpExceptionFilter } from './common/http-exception.filter';
import { HttpLogSink, requestLogging } from './common/request-logging';
import { integrityJsonBoundary } from './request-integrity/raw-request';

export function configureApplication(
  app: INestApplication,
  log?: HttpLogSink,
  integrityEnabled = false,
): void {
  app.enableShutdownHooks();
  app.use(requestLogging(log));
  app.use(helmet());
  app.use(cookieParser());
  app.use(integrityJsonBoundary(integrityEnabled));
  app.useGlobalFilters(new SafeHttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false },
    }),
  );
  app.setGlobalPrefix('api');
}
