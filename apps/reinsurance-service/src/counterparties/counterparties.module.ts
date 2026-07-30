import { Module } from '@nestjs/common';
import { ReinsuranceAccountingIntegrationModule } from '../accounting-integration/reinsurance-accounting-integration.module';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { CounterpartiesController } from './counterparties.controller';
import { CounterpartiesService } from './counterparties.service';

@Module({
  imports: [RabbitMQModule, ReinsuranceAccountingIntegrationModule],
  controllers: [CounterpartiesController],
  providers: [CounterpartiesService],
})
export class CounterpartiesModule {}
