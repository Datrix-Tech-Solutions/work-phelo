import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  INTERNAL_SERVICE_AUTH_HEADERS,
  InternalServiceAuthGuard,
} from '@work-phelo/internal-auth';
import { AssetsService } from './assets.service';
import {
  InternalAssignVehicleDto,
  InternalCreateVehicleAssetDto,
  InternalListVehicleAssetsQueryDto,
  InternalTenantDto,
  InternalUpdateVehicleAssetDto,
  InternalVehicleStatusDto,
} from './dto/internal-fleet-asset.dto';
import { AssetType } from '../../prisma/generated/client';

/**
 * Vehicle-asset operations for marketing-service's fleet module. The asset
 * stays the single source of truth here; marketing only stores fleet-specific
 * details keyed by asset id. Callers are authenticated as a service, so every
 * query is scoped by the tenantId they pass.
 */
@ApiTags('Internal Fleet Assets')
@Controller('internal/fleet-assets')
@UseGuards(InternalServiceAuthGuard)
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.service, required: true })
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.timestamp, required: true })
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.signature, required: true })
@ApiUnauthorizedResponse({ description: 'Invalid service credentials.' })
export class InternalFleetAssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  @ApiOperation({ summary: 'List active vehicle assets for a tenant' })
  @ApiOkResponse({ description: 'Vehicle assets.' })
  list(@Query() query: InternalListVehicleAssetsQueryDto) {
    const { tenantId, ...filters } = query;
    return this.assets.findVehicles(tenantId, filters);
  }

  @Get('options')
  @ApiOperation({ summary: 'Branch and driver choices for fleet forms' })
  options(@Query() query: InternalTenantDto) {
    return this.assets.findFleetOptions(query.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one vehicle asset' })
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: InternalTenantDto,
  ) {
    return this.assets.findVehicleById(query.tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a VEHICLE asset' })
  create(@Body() dto: InternalCreateVehicleAssetDto) {
    const { tenantId, ...asset } = dto;
    return this.assets.create(tenantId, { ...asset, type: AssetType.VEHICLE });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a vehicle asset name or branch' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InternalUpdateVehicleAssetDto,
  ) {
    await this.assets.findVehicleById(dto.tenantId, id);
    return this.assets.update(dto.tenantId, id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.branchId !== undefined ? { branchId: dto.branchId ?? '' } : {}),
    });
  }

  @Post(':id/status')
  @ApiOperation({ summary: 'Set AVAILABLE, MAINTENANCE or RETIRED' })
  async setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InternalVehicleStatusDto,
  ) {
    await this.assets.findVehicleById(dto.tenantId, id);
    return this.assets.changeStatus(dto.tenantId, id, dto.status);
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign a driver (employee) to the vehicle' })
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InternalAssignVehicleDto,
  ) {
    await this.assets.findVehicleById(dto.tenantId, id);
    return this.assets.assign(dto.tenantId, id, dto.employeeId);
  }

  @Post(':id/unassign')
  @ApiOperation({ summary: 'Remove the current driver from the vehicle' })
  async unassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InternalTenantDto,
  ) {
    await this.assets.findVehicleById(dto.tenantId, id);
    return this.assets.unassign(dto.tenantId, id);
  }
}
