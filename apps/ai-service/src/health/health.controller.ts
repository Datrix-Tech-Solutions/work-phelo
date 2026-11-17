import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { recordErrorCode } from '../common/request-logging';
import { FoundationReadinessService } from './foundation-readiness.service';

@Controller()
export class HealthController {
  constructor(private readonly readiness: FoundationReadinessService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'ai-service' };
  }

  @Get('ready')
  ready(@Res({ passthrough: true }) res: Response) {
    const ready = this.readiness.isReady();
    if (!ready) {
      res.status(503);
      recordErrorCode(res, 'FOUNDATION_NOT_READY');
    }
    return {
      status: ready ? 'ready' : 'not_ready',
      service: 'ai-service',
      inferenceAvailable: false,
    };
  }
}
