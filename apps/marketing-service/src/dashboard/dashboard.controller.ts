import { PermissionExempt } from '../auth/decorators/permissions.decorator';
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { ApiErrorResponseDto } from '../crm-settings/dto/prospecting-setting.dto';
import { DashboardService } from './dashboard.service';
import {
  QueryDashboardBirthdaysDto,
  QueryDashboardGrowthDto,
  QueryDashboardRevenueDto,
  QueryDashboardSalesPersonnelDto,
  QueryDashboardSummaryDto,
  QueryDashboardTargetsDto,
} from './dto/dashboard-summary.dto';

type AuthedRequest = Request & { user: RequestUser };

@Controller('dashboard')
@ApiTags('Marketing - Dashboard')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description: 'Marketing module or leads feature is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('marketing')
@RequireFeature('marketing', 'leads')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  // Open to any Marketing user: without the general dashboard permission the figures are narrowed
  // to the caller (their personal dashboard). Either way they are scoped like the lists they
  // summarise: without the matching view-all permission they cover only the caller's own
  // prospects and clients.
  @PermissionExempt(
    'service-policy',
    'DashboardController.summary delegates caller and tenant scope to its existing policy checks.',
  )
  @Get('summary')
  @ApiOperation({
    summary: 'Marketing dashboard figures for a period',
    description:
      'Sales won, expected, achieved revenue, conversion, pipeline by stage, target progress and client counts. The pipeline covers open prospects created in the period.',
  })
  @ApiOkResponse({ description: 'Dashboard figures.' })
  summary(
    @Query() query: QueryDashboardSummaryDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.summary(request.user, query);
  }

  @PermissionExempt(
    'service-policy',
    'DashboardController.targets delegates caller and tenant scope to its existing policy checks.',
  )
  @Get('targets')
  @ApiOperation({
    summary: 'Sales target progress for a period, optionally for one rep',
    description:
      'Total target, achieved, remaining and percent for targets overlapping the range, plus the reps who have one so the dashboard can filter by rep. Without the view-all targets permission only the caller’s own targets are included.',
  })
  @ApiOkResponse({ description: 'Target figures and the reps to filter by.' })
  targets(
    @Query() query: QueryDashboardTargetsDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.targetsOverview(request.user, query);
  }

  @PermissionExempt(
    'service-policy',
    'DashboardController.upcomingBirthdays delegates caller and tenant scope to its existing policy checks.',
  )
  @Get('upcoming-birthdays')
  @ApiOperation({
    summary: 'Upcoming birthdays of prospect and client contacts',
    description:
      'Primary contacts of prospects and clients with a birthday in the next 30 days, soonest first. Scoped like the lists: without the view-all permissions only the caller’s own prospects and clients are included.',
  })
  @ApiOkResponse({ description: 'Birthdays and the look-ahead window.' })
  upcomingBirthdays(
    @Query() query: QueryDashboardBirthdaysDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.upcomingBirthdays(request.user, query);
  }

  @Get('reps')
  @RequirePermissions(P.DASHBOARD_VIEW)
  @ApiOperation({
    summary: 'Sales reps the dashboard can be filtered to',
    description:
      'Active Marketing users when the caller may see everyone’s prospects or clients, otherwise just the caller.',
  })
  @ApiOkResponse({ description: 'Reps by name.' })
  reps(@Req() request: AuthedRequest) {
    return this.service.reps(request.user);
  }

  @PermissionExempt(
    'service-policy',
    'DashboardController.growth delegates caller and tenant scope to its existing policy checks.',
  )
  @Get('growth')
  @ApiOperation({
    summary: 'New prospects and new clients for several date ranges at once',
    description:
      'Counts of prospects and clients created in each range, for charting growth over consecutive periods in one request.',
  })
  @ApiOkResponse({ description: 'One entry per requested range, in order.' })
  growth(
    @Query() query: QueryDashboardGrowthDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.growth(request.user, query);
  }

  @PermissionExempt(
    'service-policy',
    'DashboardController.revenueByProduct delegates caller and tenant scope to its existing policy checks.',
  )
  @Get('revenue-by-product')
  @ApiOperation({
    summary: 'Revenue achieved in a period, split by product',
    description:
      'Money Accounting has received in the period against the transactions raised for clients, grouped by the product each was raised for. Transactions raised without a product are grouped together.',
  })
  @ApiOkResponse({ description: 'Received amount per product, largest first.' })
  revenueByProduct(
    @Query() query: QueryDashboardRevenueDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.revenueByProduct(request.user, query);
  }

  @Get('sales-personnel')
  @RequirePermissions(P.DASHBOARD_VIEW)
  @ApiOperation({
    summary: 'Prospects, clients, expected and achieved revenue per sales rep',
    description:
      'One entry per rep with activity in the period, for ranking on any of the four figures. Achieved revenue is null for every rep when Accounting cannot be reached.',
  })
  @ApiOkResponse({
    description: 'Figures per sales rep, in no particular order.',
  })
  salesPersonnel(
    @Query() query: QueryDashboardSalesPersonnelDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.salesPersonnel(request.user, query);
  }
}
