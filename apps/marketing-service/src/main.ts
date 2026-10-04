import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { isSwaggerEnabled } from '@work-phelo/config';
import { AppModule } from './app.module';
import { assertMarketingRuntimeEnv } from './config/runtime-env';
import { setupSwagger } from './swagger.config';

async function bootstrap() {
  assertMarketingRuntimeEnv();

  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Service-to-service routes are called by their bare path, not under /api.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'internal/accounting-events', method: RequestMethod.POST },
    ],
  });
  if (isSwaggerEnabled()) {
    setupSwagger(app);
  }
  const port = process.env.PORT || 4006;
  await app.listen(port);
  console.log(`Marketing service running on port ${port}`);
}

void bootstrap();
