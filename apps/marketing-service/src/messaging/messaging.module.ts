import { Module } from '@nestjs/common';
import { MarketingRabbitPublisher } from './rabbitmq.publisher';

/** One shared publisher, so every feature reuses the same broker connections. */
@Module({
  providers: [MarketingRabbitPublisher],
  exports: [MarketingRabbitPublisher],
})
export class MessagingModule {}
