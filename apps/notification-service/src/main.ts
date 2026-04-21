import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { join } from 'path';
import { GlobalExceptionFilter } from './common/prisma-exception.filter';

async function bootstrap() {
  if (!process.env.RABBITMQ_URL) throw new Error('RABBITMQ_URL is required');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(__dirname, 'public'), { prefix: '/public' });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL],
      queue: 'notification_queue',
      queueOptions: {
        durable: true,
        arguments: {
          'x-message-ttl': 3600000,
        },
      },
      noAck: true,
      prefetchCount: 10,
    },
  });
  app.setGlobalPrefix('api');
  const port = process.env.PORT || 4004;
  await app.listen(port);
  console.log(`Notification service running on port ${port}`);
  // Start RabbitMQ consumer after HTTP is up — connection failures won't block the HTTP server
  app
    .startAllMicroservices()
    .catch((err: unknown) =>
      console.error(
        'RabbitMQ microservice failed to start:',
        err instanceof Error ? err.message : String(err),
      ),
    );
}
void bootstrap();
