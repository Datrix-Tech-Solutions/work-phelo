import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger.config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(helmet());
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:8080',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  setupSwagger(app);

  // Connect as hybrid microservice to listen to RabbitMQ events
  app.connectMicroservice<any>({
    transport: Transport.RMQ,
    options: {
      urls: [
        process.env.RABBITMQ_URL || 'amqp://erp:erppassword@localhost:5672',
      ],
      queue: 'auth_queue',
      queueOptions: {
        durable: true,
        arguments: {
          'x-message-ttl': 3600000,
        },
      },
      noAck: false,
      prefetchCount: 10,
    },
  });

  await app.startAllMicroservices();
  const port = process.env.PORT || 4001;
  await app.listen(port);
  console.log(`Auth service running on port ${port}`);
}

bootstrap();
