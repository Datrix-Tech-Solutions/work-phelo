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
import { FeatureGuard } from '../auth/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ApiErrorResponseDto } from '../crm-settings/dto/prospecting-setting.dto';
import { DashboardService } from './dashboard.service';
import {
  QueryDashboardGrowthDto,
  QueryDashboardRevenueDto,
  QueryDashboardSummaryDto,
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

  // Open to every Marketing user, like the lists it summarises: without the matching
  // view-all permission the figures cover only the caller's own prospects and clients.
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
}
