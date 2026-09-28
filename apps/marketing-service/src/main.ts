import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
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
  app.setGlobalPrefix('api');
  if (isSwaggerEnabled()) {
    setupSwagger(app);
  }
  const port = process.env.PORT || 4006;
  await app.listen(port);
  console.log(`Marketing service running on port ${port}`);
}

void bootstrap();
