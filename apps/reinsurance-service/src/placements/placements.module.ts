import { Module } from '@nestjs/common';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlacementsController } from './placements.controller';
import { PlacementsService } from './placements.service';

@Module({
  imports: [PrismaModule, RabbitMQModule],
  controllers: [PlacementsController],
  providers: [PlacementsService],
  exports: [PlacementsService],
})
export class PlacementsModule {}
