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
