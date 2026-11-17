import { Module } from '@nestjs/common';
import { FoundationReadinessService } from './foundation-readiness.service';
import { HealthController } from './health.controller';

@Module({ controllers: [HealthController], providers: [FoundationReadinessService] })
export class HealthModule {}
