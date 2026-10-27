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
import { QueryTargetReportDto } from './dto/target-report.dto';
import { TargetReportService } from './target-report.service';

type AuthedRequest = Request & { user: RequestUser };

@Controller('reports')
@ApiTags('Marketing - Reports')
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
export class ReportsController {
  constructor(private readonly targetReport: TargetReportService) {}

  // Open to every Marketing user: without marketing.targets.all:VIEW the service narrows the
  // report to the caller's own figures.
  @Get('targets')
  @ApiOperation({
    summary: 'Yearly target against achievement, per sales rep',
    description:
      'Target, achieved revenue, remaining, percentage achieved and expected pipeline for each rep, filterable by rep, branch and department. Team totals are returned only to callers with the view-all targets permission; anyone else sees only their own row.',
  })
  @ApiOkResponse({
    description: 'The report rows and, for team viewers, totals.',
  })
  targets(@Query() query: QueryTargetReportDto, @Req() request: AuthedRequest) {
    return this.targetReport.report(request.user, query);
  }

  @Get('targets/filters')
  @ApiOperation({
    summary:
      'Reps, branches and departments the target report can be filtered by',
  })
  @ApiOkResponse({ description: 'Filter options for the caller.' })
  targetFilters(@Req() request: AuthedRequest) {
    return this.targetReport.filters(request.user);
  }
}
