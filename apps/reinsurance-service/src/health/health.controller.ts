import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseReadinessService } from './database-readiness.service';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseReadinessService) {}

  @Get()
  async check() {
    try {
      await this.database.check();

      return {
        status: 'ok',
        service: 'reinsurance-service',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'reinsurance-service',
        message: 'Reinsurance database is unavailable',
      });
    }
  }
}
