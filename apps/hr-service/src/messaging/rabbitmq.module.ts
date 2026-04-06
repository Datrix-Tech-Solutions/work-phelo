import { LeaveModule } from '../leave/leave.module';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RabbitMQPublisher } from './rabbitmq.publisher';
import { EventsHandler } from './events.handler';

@Module({
  imports: [
    LeaveModule,
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
            arguments: { 'x-message-ttl': 3600000 },
          },
        },
      },
      {
        name: 'AUTH_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [
            process.env.RABBITMQ_URL || 'amqp://erp:erppassword@localhost:5672',
          ],
          queue: 'auth_queue',
          queueOptions: {
            durable: true,
            arguments: { 'x-message-ttl': 3600000 },
          },
        },
      },
    ]),
  ],
  providers: [RabbitMQPublisher],
  exports: [RabbitMQPublisher],
})
export class RabbitMQModule {}
