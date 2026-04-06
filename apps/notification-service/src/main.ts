import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [
        process.env.RABBITMQ_URL || 'amqp://erp:erppassword@localhost:5672',
      ],
      queue: 'notification_queue',
      queueOptions: {
        durable: true,
        arguments: {
          'x-message-ttl': 3600000, // 1 hour — discard stale messages on restart
        },
      },
      noAck: false,
    },
  });

  app.setGlobalPrefix('api');
  setupSwagger(app);

  await app.startAllMicroservices();

  const port = process.env.PORT || 4004;
  await app.listen(port);

  console.log(`Notification service running on port ${port}`);
  console.log(`Listening on RabbitMQ queue: notification_queue`);
}

bootstrap();
// Mon Apr  6 07:39:10 GMT 2026
