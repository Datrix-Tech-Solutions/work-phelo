import { Module, forwardRef } from '@nestjs/common';
import { AppraisalsService } from './appraisals.service';
import { AppraisalsController } from './appraisals.controller';
import { RabbitMQModule } from '../messaging/rabbitmq.module';

@Module({
  imports: [forwardRef(() => RabbitMQModule)],
  controllers: [AppraisalsController],
  providers: [AppraisalsService],
  exports: [AppraisalsService],
})
export class AppraisalsModule {}
