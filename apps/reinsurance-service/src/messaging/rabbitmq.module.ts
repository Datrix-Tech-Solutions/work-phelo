import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CounterpartyEventPublisher } from './counterparty-event.publisher';
import { PlacementEventPublisher } from './placement-event.publisher';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'AUTH_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.getOrThrow<string>('RABBITMQ_URL')],
            queue: 'auth_queue',
            queueOptions: {
              durable: true,
              arguments: {
                'x-message-ttl': 3600000,
              },
            },
          },
        }),
      },
    ]),
  ],
  providers: [CounterpartyEventPublisher, PlacementEventPublisher],
  exports: [CounterpartyEventPublisher, PlacementEventPublisher],
})
export class RabbitMQModule {}
