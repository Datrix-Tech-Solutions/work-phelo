import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get personal employee dashboard' })
  @ApiResponse({ status: 200, description: 'Employee dashboard data returned' })
  getMyDashboard(@Req() req: any) {
    return this.dashboardService.getEmployeeDashboard(
      req.user.tenantId,
      req.user.id,
    );
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get Company Admin dashboard summary' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard summary returned successfully',
    schema: {
      example: {
        adminFirstName: 'Abena',
        companyName: 'Acme Ghana Ltd',
        totalEmployees: 12,
        activeEmployees: 10,
        pendingLeaveRequests: 2,
        assignedAssetsCount: 0,
        hasEmployees: true,
        modules: {
          hr: { enabled: true, locked: false },
          payroll: { enabled: true, locked: false },
          assets: { enabled: false, locked: true },
          recruitment: { enabled: false, locked: true },
        },
      },
    },
  })
  getSummary(@Req() req: any) {
    return this.dashboardService.getSummary(
      req.user.tenantId,
      req.user.tenantSlug,
      req.user.firstName,
      req.user.tenantName,
    );
  }
}
