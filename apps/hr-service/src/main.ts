import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
      urls: [
        process.env.RABBITMQ_URL || 'amqp://erp:erppassword@localhost:5672',
      ],
      queue: 'hr_queue',
      queueOptions: {
        durable: true,
        arguments: {
          'x-message-ttl': 3600000,
          'x-dead-letter-exchange': 'workphelo.dlx',
          'x-dead-letter-routing-key': 'hr_queue',
        },
      },
    },
  });

  await app.startAllMicroservices();
  const port = process.env.PORT || 4002;
  await app.listen(port);
  console.log(`HR service running on port ${port}`);
}

bootstrap();
