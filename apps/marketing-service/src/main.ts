import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');
  setupSwagger(app);
  const port = process.env.PORT || 4006;
  await app.listen(port);
  console.log(`Marketing service running on port ${port}`);
}

void bootstrap();
