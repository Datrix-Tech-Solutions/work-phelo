import { INestApplication, ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { requestLogging } from './common/request-logging';

export function configureApplication(app: INestApplication): void {
  app.enableShutdownHooks();
  const limit = process.env.HTTP_BODY_LIMIT ?? '1mb';
  app.use(json({ limit }));
  app.use(urlencoded({ extended: true, limit }));
  app.use(helmet());
  app.use(cookieParser());
  app.use(requestLogging());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');
}
