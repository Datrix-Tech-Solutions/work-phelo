import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { assertReinsuranceRuntimeEnv } from './config/runtime-env';
import { setupSwagger } from './swagger.config';

async function bootstrap() {
  assertReinsuranceRuntimeEnv();

  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');

  if (process.env.ENABLE_SWAGGER === 'true') {
    setupSwagger(app);
  }

  const port = process.env.PORT || 4007;
  await app.listen(port);
  console.log(`Reinsurance service running on port ${port}`);
}

void bootstrap();
