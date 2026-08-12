import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { isSwaggerEnabled } from '@work-phelo/config';
import { AppModule } from './app.module';
import {
  ACCOUNTING_GLOBAL_PREFIX,
  ACCOUNTING_GLOBAL_PREFIX_EXCLUSIONS,
} from './config/global-prefix';
import { assertAccountingRuntimeEnv } from './config/runtime-env';
import { setupSwagger } from './swagger.config';

async function bootstrap() {
  assertAccountingRuntimeEnv();
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix(ACCOUNTING_GLOBAL_PREFIX, {
    exclude: ACCOUNTING_GLOBAL_PREFIX_EXCLUSIONS,
  });
  if (isSwaggerEnabled()) setupSwagger(app);

  const port = process.env.PORT || 4008;
  await app.listen(port);
  console.log(`Accounting service running on port ${port}`);
}

void bootstrap();
