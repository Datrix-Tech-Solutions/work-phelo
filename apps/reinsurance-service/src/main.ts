import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { assertReinsuranceRuntimeEnv } from './config/runtime-env';

async function bootstrap() {
  assertReinsuranceRuntimeEnv();

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 4007;
  await app.listen(port);
  console.log(`Reinsurance service running on port ${port}`);
}

void bootstrap();
