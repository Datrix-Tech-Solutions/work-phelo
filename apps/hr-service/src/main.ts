import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger.config';
import { GlobalExceptionFilter } from './common/prisma-exception.filter';

async function bootstrap() {
  if (!process.env.RABBITMQ_URL) throw new Error('RABBITMQ_URL is required');

  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  setupSwagger(app);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL],
      queue: 'hr_queue',
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

  const port = process.env.PORT || 4002;
  await app.listen(port);
  console.log(`HR service running on port ${port}`);
  // Start RabbitMQ consumer after HTTP is up — connection failures won't block the HTTP server
  app
    .startAllMicroservices()
    .catch((err: Error) =>
      console.error('RabbitMQ microservice failed to start:', err.message),
    );
}

void bootstrap();
