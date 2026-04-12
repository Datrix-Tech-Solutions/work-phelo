import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RabbitMQPublisher } from './rabbitmq.publisher';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'NOTIFICATION_SERVICE',
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
        },
      },
      {
        name: 'HR_SERVICE',
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
            },
          },
        },
      },
    ]),
  ],
  providers: [RabbitMQPublisher],
  exports: [RabbitMQPublisher],
})
export class RabbitMQModule {}
