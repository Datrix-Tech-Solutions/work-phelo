import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

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
          'x-message-ttl': 3600000,
        },
      },
      noAck: false,
    },
  });
  app.setGlobalPrefix('api');
  await app.startAllMicroservices();
  const port = process.env.PORT || 4004;
  await app.listen(port);
  console.log(`Notification service running on port ${port}`);
  console.log(`Listening on RabbitMQ queue: notification_queue`);
}
bootstrap();
