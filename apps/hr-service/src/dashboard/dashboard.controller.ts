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
      req.user,
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

  @Get('department-distribution')
  @ApiOperation({ summary: 'Get employee count per department' })
  @ApiResponse({ status: 200, description: 'Department distribution returned' })
  getDepartmentDistribution(@Req() req: any) {
    return this.dashboardService.getDepartmentDistribution(req.user.tenantId);
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Get last 5 employee record changes' })
  @ApiResponse({ status: 200, description: 'Recent activity returned' })
  getRecentActivity(@Req() req: any) {
    return this.dashboardService.getRecentActivity(req.user.tenantId);
  }

  @Get('upcoming-birthdays')
  @ApiOperation({ summary: 'Get employees with birthdays in next 30 days' })
  @ApiResponse({ status: 200, description: 'Upcoming birthdays returned' })
  getUpcomingBirthdays(@Req() req: any) {
    return this.dashboardService.getUpcomingBirthdays(req.user.tenantId);
  }

  @Get('recently-added')
  @ApiOperation({ summary: 'Get last 5 employees added to the company' })
  @ApiResponse({
    status: 200,
    description: 'Recently added employees returned',
  })
  getRecentlyAdded(@Req() req: any) {
    return this.dashboardService.getRecentlyAdded(req.user.tenantId);
  }
}
