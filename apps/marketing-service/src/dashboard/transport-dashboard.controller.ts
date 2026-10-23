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
import { RequireAnyPermission } from '../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { ApiErrorResponseDto } from '../crm-settings/dto/prospecting-setting.dto';
import {
  QueryDashboardGrowthDto,
  QueryDashboardSummaryDto,
} from './dto/dashboard-summary.dto';
import { TransportDashboardService } from './transport-dashboard.service';

type AuthedRequest = Request & { user: RequestUser };

/** Company-wide transport figures, so they need to see (or approve) every request. */
@Controller('dashboard/transport')
@ApiTags('Marketing - Transport Dashboard')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@ApiForbiddenResponse({ type: ApiErrorResponseDto })
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('marketing')
@RequireFeature('marketing', 'leads')
export class TransportDashboardController {
  constructor(private readonly service: TransportDashboardService) {}

  @Get('summary')
  @RequireAnyPermission(P.REQUESTS_VIEW_ALL, P.REQUESTS_APPROVE_ALL)
  @ApiOperation({
    summary: 'Transport dashboard figures for a period',
    description:
      'Pending approvals, trips today, on route, overdue, completed and closed counts, what needs attention, and the fleet by status.',
  })
  @ApiOkResponse({ description: 'Dashboard figures.' })
  summary(
    @Query() query: QueryDashboardSummaryDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.summary(request.user, query);
  }

  @Get('trend')
  @RequireAnyPermission(P.REQUESTS_VIEW_ALL, P.REQUESTS_APPROVE_ALL)
  @ApiOperation({
    summary: 'Requests raised and trips completed for several ranges',
  })
  @ApiOkResponse({ description: 'One entry per requested range, in order.' })
  trend(
    @Query() query: QueryDashboardGrowthDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.trend(request.user, query);
  }
}
