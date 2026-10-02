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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
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
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { ApiErrorResponseDto } from '../crm-settings/dto/prospecting-setting.dto';
import { ClientsService } from './clients.service';
import {
  ClientDetailProductDto,
  ClientDetailResponseDto,
} from './dto/client-response.dto';
import {
  AddClientProductDto,
  ConvertProspectToClientDto,
  CreateClientDto,
} from './dto/create-client.dto';
import {
  ClientListResponseDto,
  QueryClientsDto,
} from './dto/query-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const {
  CLIENTS_VIEW,
  CLIENTS_CREATE,
  CLIENTS_EDIT,
  CLIENTS_EDIT_ALL,
  CLIENTS_DELETE,
  CLIENTS_DELETE_ALL,
  PROSPECTS_EDIT,
  PROSPECTS_EDIT_ALL,
} = MarketingCrmSettingsPermission;

@Controller('clients')
@ApiTags('Marketing - Clients')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description:
    'Marketing module, leads feature or client permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('marketing')
@RequireFeature('marketing', 'leads')
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  @Get()
  @RequireAnyPermission(CLIENTS_VIEW)
  @ApiOperation({
    summary: 'List marketing clients',
    description:
      'Users with marketing.clients:VIEW see their assigned clients. Users with marketing.clients.all:VIEW may list tenant-wide clients and filter by assigned user.',
  })
  @ApiOkResponse({ type: ClientListResponseDto })
  list(
    @Query() query: QueryClientsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.list(request.user, query);
  }

  @Post()
  @RequireAnyPermission(CLIENTS_CREATE)
  @ApiOperation({
    summary: 'Create a marketing client',
    description:
      'Creates a client directly, without a prospect. Linked products start as PENDING.',
  })
  @ApiCreatedResponse({ type: ClientDetailResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  create(
    @Body() dto: CreateClientDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.create(request.user, dto);
  }

  @Post(':id/products')
  @RequireAnyPermission(CLIENTS_EDIT, CLIENTS_EDIT_ALL)
  @ApiOperation({
    summary: 'Add a product or service to a client',
    description:
      'Users with marketing.clients:EDIT can edit assigned clients. Users with marketing.clients.all:EDIT can edit any client within their tenant. The product starts as PENDING.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: ClientDetailProductDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  addProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddClientProductDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.addProduct(request.user, id, dto);
  }

  @Get(':id')
  @RequireAnyPermission(CLIENTS_VIEW)
  @ApiOperation({
    summary: 'Get marketing client details',
    description:
      'Users with marketing.clients:VIEW can view assigned clients. Users with marketing.clients.all:VIEW can view any client within their tenant.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ClientDetailResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.findOne(request.user, id);
  }

  @Patch(':id')
  @RequireAnyPermission(CLIENTS_EDIT, CLIENTS_EDIT_ALL)
  @ApiOperation({
    summary: 'Update a marketing client',
    description:
      'Users with marketing.clients:EDIT can update assigned clients. Users with marketing.clients.all:EDIT can update any client within their tenant.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ClientDetailResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.update(request.user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAnyPermission(CLIENTS_DELETE, CLIENTS_DELETE_ALL)
  @ApiOperation({
    summary: 'Delete a marketing client',
    description:
      'Deletes the client with its contacts and products. Interactions and follow-ups that were recorded while it was a prospect stay with that prospect. Users with marketing.clients:DELETE can delete assigned clients. Users with marketing.clients.all:DELETE can delete any client within their tenant.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Client deleted.' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.remove(request.user, id);
  }
}

@Controller('prospects')
@ApiTags('Marketing - Clients')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description:
    'Marketing module, leads feature, client create or prospect edit permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('marketing')
@RequireFeature('marketing', 'leads')
export class ProspectConversionController {
  constructor(private readonly service: ClientsService) {}

  @Post(':prospectId/convert')
  @RequirePermissions(CLIENTS_CREATE)
  @RequireAnyPermission(PROSPECTS_EDIT, PROSPECTS_EDIT_ALL)
  @ApiOperation({
    summary: 'Convert a prospect to a client',
    description:
      'Requires marketing.clients:CREATE and permission to edit the prospect (marketing.prospects:EDIT for assigned prospects, marketing.prospects.all:EDIT for any). Only prospects at 100% progress can be converted. Contacts are copied, products carry over as PENDING, and the prospect interactions and follow-ups are shared with the new client.',
  })
  @ApiParam({ name: 'prospectId', format: 'uuid' })
  @ApiCreatedResponse({ type: ClientDetailResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  convert(
    @Param('prospectId', ParseUUIDPipe) prospectId: string,
    @Body() dto: ConvertProspectToClientDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.convertProspect(request.user, prospectId, dto);
  }
}
