import { Module } from '@nestjs/common';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlacementFinancialActivityReader } from './placement-financial-activity.reader';
import { PlacementFinancialLockPolicy } from './placement-financial-lock.policy';
import { PlacementsController } from './placements.controller';
import { PlacementsService } from './placements.service';

@Module({
  imports: [PrismaModule, RabbitMQModule],
  controllers: [PlacementsController],
  providers: [
    PlacementsService,
    PlacementFinancialActivityReader,
    PlacementFinancialLockPolicy,
  ],
  exports: [PlacementsService],
})
export class PlacementsModule {}
