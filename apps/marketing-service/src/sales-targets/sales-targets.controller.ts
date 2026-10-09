import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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
import {
  CreateSalesTargetDto,
  QuerySalesTargetsDto,
  UpdateSalesTargetDto,
} from './dto/sales-target.dto';
import { SalesTargetsService } from './sales-targets.service';

type AuthedRequest = Request & { user: RequestUser };

@Controller('sales-targets')
@ApiTags('Marketing - Sales Targets')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description:
    'Marketing module, leads feature or targets permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('marketing')
@RequireFeature('marketing', 'leads')
export class SalesTargetsController {
  constructor(private readonly service: SalesTargetsService) {}

  @Get()
  // Open to every Marketing user: without marketing.targets.all:VIEW the service returns only the
  // caller's own targets.
  @ApiOperation({
    summary: 'Sales rep targets with achieved revenue',
    description:
      'Achieved revenue is the money Accounting has received from the rep’s billable clients, dated within the target period. A product target counts only transactions raised for that product. achieved is null when Accounting cannot be reached.',
  })
  @ApiOkResponse({
    description: 'Targets with achieved, remaining and percent.',
  })
  list(@Query() query: QuerySalesTargetsDto, @Req() request: AuthedRequest) {
    return this.service.list(request.user, query);
  }

  @Get('reps')
  @RequirePermissions(P.TARGETS_CREATE)
  @ApiOperation({ summary: 'Marketing users a target can be set for' })
  reps(@Req() request: AuthedRequest) {
    return this.service.reps(request.user);
  }

  @Post()
  @RequirePermissions(P.TARGETS_CREATE)
  @ApiOperation({ summary: 'Set a target for a sales rep' })
  create(@Body() dto: CreateSalesTargetDto, @Req() request: AuthedRequest) {
    return this.service.create(request.user, dto);
  }

  @Patch(':id')
  @RequirePermissions(P.TARGETS_EDIT)
  @ApiOperation({ summary: 'Change a target’s amount' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalesTargetDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.update(request.user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(P.TARGETS_DELETE)
  @ApiOperation({ summary: 'Remove a target' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    await this.service.remove(request.user, id);
  }
}
