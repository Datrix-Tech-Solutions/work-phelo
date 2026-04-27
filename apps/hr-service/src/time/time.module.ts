import { Module, forwardRef } from '@nestjs/common';
import { TimeService } from './time.service';
import { TimeController } from './time.controller';
import { RabbitMQModule } from '../messaging/rabbitmq.module';

@Module({
  imports: [forwardRef(() => RabbitMQModule)],
  controllers: [TimeController],
  providers: [TimeService],
  exports: [TimeService],
})
export class TimeModule {}
