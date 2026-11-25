import { Module } from '@nestjs/common';
import { ProxyController } from './proxy.controller';
import { AiRateAdmission } from './ai-rate-admission';

@Module({
  controllers: [ProxyController],
  providers: [AiRateAdmission],
})
export class ProxyModule {}
