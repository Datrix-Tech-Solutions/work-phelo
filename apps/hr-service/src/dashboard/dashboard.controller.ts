import { Controller, Get, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@Req() req: any) {
    return this.dashboardService.getSummary(
      req.user.tenantId,
      req.user.tenantSlug,
      req.user.firstName,
      req.user.tenantName,
    );
  }
}
