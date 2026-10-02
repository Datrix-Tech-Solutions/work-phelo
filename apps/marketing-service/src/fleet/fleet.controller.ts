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
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireAnyPermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { ApiErrorResponseDto } from '../crm-settings/dto/prospecting-setting.dto';
import {
  AssignFleetDriverDto,
  CreateFleetVehicleDto,
  QueryFleetVehiclesDto,
  SetFleetVehicleStatusDto,
  UpdateFleetVehicleDto,
} from './dto/fleet.dto';
import { FleetService } from './fleet.service';

const { FLEET_VIEW, FLEET_CREATE, FLEET_EDIT, FLEET_DELETE } =
  MarketingCrmSettingsPermission;

type AuthedRequest = Request & { user: RequestUser };

@Controller('fleet')
@ApiTags('Marketing - Fleet')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description: 'Marketing module or fleet permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('marketing')
export class FleetController {
  constructor(private readonly service: FleetService) {}

  @Get()
  @RequireAnyPermission(FLEET_VIEW)
  @ApiOperation({
    summary: 'List fleet vehicles',
    description:
      'Vehicle assets from HR merged with fleet details. Vehicles created in HR appear with needsFleetDetails=true.',
  })
  list(@Query() query: QueryFleetVehiclesDto, @Req() request: AuthedRequest) {
    return this.service.list(request.user, query);
  }

  @Get('options')
  @RequireAnyPermission(FLEET_VIEW)
  @ApiOperation({
    summary: 'Branch and driver choices for fleet forms',
    description:
      'Served from HR so marketing users do not need HR access to fill the pickers.',
  })
  options(@Req() request: AuthedRequest) {
    return this.service.options(request.user);
  }

  @Get(':assetId')
  @RequireAnyPermission(FLEET_VIEW)
  @ApiOperation({ summary: 'Get a fleet vehicle by its HR asset ID' })
  @ApiParam({ name: 'assetId', format: 'uuid' })
  findOne(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.findOne(request.user, assetId);
  }

  @Post()
  @RequireAnyPermission(FLEET_CREATE)
  @ApiOperation({
    summary: 'Create a vehicle',
    description:
      'Creates the vehicle as an HR asset (so it also appears on the HR assets page) and stores its fleet details.',
  })
  create(@Body() dto: CreateFleetVehicleDto, @Req() request: AuthedRequest) {
    return this.service.create(request.user, dto);
  }

  @Patch(':assetId')
  @RequireAnyPermission(FLEET_EDIT)
  @ApiOperation({
    summary: 'Update fleet details or branch',
    description:
      'For a vehicle created in HR with no fleet details yet, all detail fields are required on the first save.',
  })
  @ApiParam({ name: 'assetId', format: 'uuid' })
  update(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() dto: UpdateFleetVehicleDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.update(request.user, assetId, dto);
  }

  @Post(':assetId/status')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(FLEET_EDIT)
  @ApiOperation({
    summary: 'Set vehicle status (available, maintenance, retired)',
  })
  @ApiParam({ name: 'assetId', format: 'uuid' })
  setStatus(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() dto: SetFleetVehicleStatusDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.setStatus(request.user, assetId, dto.status);
  }

  @Post(':assetId/driver')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(FLEET_EDIT)
  @ApiOperation({ summary: 'Assign a driver to the vehicle' })
  @ApiParam({ name: 'assetId', format: 'uuid' })
  assignDriver(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() dto: AssignFleetDriverDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.assignDriver(request.user, assetId, dto.employeeId);
  }

  @Delete(':assetId/driver')
  @RequireAnyPermission(FLEET_EDIT)
  @ApiOperation({ summary: 'Remove the current driver from the vehicle' })
  @ApiParam({ name: 'assetId', format: 'uuid' })
  unassignDriver(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.unassignDriver(request.user, assetId);
  }

  @Delete(':assetId')
  @RequireAnyPermission(FLEET_DELETE)
  @ApiOperation({
    summary: 'Retire a vehicle',
    description:
      'Frees any assigned driver and retires the HR asset. HR records are kept.',
  })
  @ApiParam({ name: 'assetId', format: 'uuid' })
  remove(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.remove(request.user, assetId);
  }
}
