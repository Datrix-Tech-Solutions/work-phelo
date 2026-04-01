import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
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
