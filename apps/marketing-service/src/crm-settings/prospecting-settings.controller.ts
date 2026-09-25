import {
  Body,
  Controller,
  Delete,
  Get,
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { MarketingCrmSettingCategory } from '../../prisma/generated/client';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireAnyPermission } from '../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MarketingCrmSettingsPermission } from './crm-settings.permissions';
import {
  ApiErrorResponseDto,
  CreateProspectingSettingDto,
  ProspectingSettingResponseDto,
  ProspectingSettingsListResponseDto,
  QueryProspectingSettingsDto,
  UpdateProspectingSettingDto,
} from './dto/prospecting-setting.dto';
import { ProspectingSettingsService } from './prospecting-settings.service';

type CategoryPermissions = {
  view: string;
  create: string;
  edit: string;
  delete: string;
};

const PRODUCTS_PERMISSIONS: CategoryPermissions = {
  view: MarketingCrmSettingsPermission.PRODUCTS_VIEW,
  create: MarketingCrmSettingsPermission.PRODUCTS_CREATE,
  edit: MarketingCrmSettingsPermission.PRODUCTS_EDIT,
  delete: MarketingCrmSettingsPermission.PRODUCTS_DELETE,
};

const DECISION_MAKERS_PERMISSIONS: CategoryPermissions = {
  view: MarketingCrmSettingsPermission.DECISION_MAKERS_VIEW,
  create: MarketingCrmSettingsPermission.DECISION_MAKERS_CREATE,
  edit: MarketingCrmSettingsPermission.DECISION_MAKERS_EDIT,
  delete: MarketingCrmSettingsPermission.DECISION_MAKERS_DELETE,
};

@Controller('crm-settings')
@ApiTags('Marketing - CRM Settings')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description: 'Marketing module, leads feature or permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('marketing')
@RequireFeature('marketing', 'leads')
export class ProspectingSettingsController {
  constructor(private readonly service: ProspectingSettingsService) {}

  @Get('products')
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.CRM_SETTINGS_VIEW,
    PRODUCTS_PERMISSIONS.view,
  )
  @ApiOperation({ summary: 'List prospect product and service options' })
  @ApiOkResponse({ type: ProspectingSettingsListResponseDto })
  listProducts(
    @Query() query: QueryProspectingSettingsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.list(
      request.user.tenantId,
      MarketingCrmSettingCategory.PRODUCT,
      query,
    );
  }

  @Post('products')
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.CRM_SETTINGS_CREATE,
    PRODUCTS_PERMISSIONS.create,
  )
  @ApiOperation({ summary: 'Create a prospect product or service option' })
  @ApiCreatedResponse({ type: ProspectingSettingResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  createProduct(
    @Body() dto: CreateProspectingSettingDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.create(
      request.user,
      MarketingCrmSettingCategory.PRODUCT,
      dto,
    );
  }

  @Get('products/:id')
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.CRM_SETTINGS_VIEW,
    PRODUCTS_PERMISSIONS.view,
  )
  @ApiOperation({ summary: 'Get a prospect product or service option' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProspectingSettingResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  getProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.findOne(
      request.user.tenantId,
      MarketingCrmSettingCategory.PRODUCT,
      id,
    );
  }

  @Patch('products/:id')
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.CRM_SETTINGS_EDIT,
    PRODUCTS_PERMISSIONS.edit,
  )
  @ApiOperation({ summary: 'Update a prospect product or service option' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProspectingSettingResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProspectingSettingDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.update(
      request.user,
      MarketingCrmSettingCategory.PRODUCT,
      id,
      dto,
    );
  }

  @Delete('products/:id')
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.CRM_SETTINGS_DELETE,
    PRODUCTS_PERMISSIONS.delete,
  )
  @ApiOperation({ summary: 'Archive a prospect product or service option' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProspectingSettingResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  archiveProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.archive(
      request.user,
      MarketingCrmSettingCategory.PRODUCT,
      id,
    );
  }

  @Get('decision-makers')
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.CRM_SETTINGS_VIEW,
    DECISION_MAKERS_PERMISSIONS.view,
  )
  @ApiOperation({ summary: 'List prospect decision makers' })
  @ApiOkResponse({ type: ProspectingSettingsListResponseDto })
  listDecisionMakers(
    @Query() query: QueryProspectingSettingsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.list(
      request.user.tenantId,
      MarketingCrmSettingCategory.DECISION_MAKER,
      query,
    );
  }

  @Post('decision-makers')
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.CRM_SETTINGS_CREATE,
    DECISION_MAKERS_PERMISSIONS.create,
  )
  @ApiOperation({ summary: 'Create a prospect decision maker' })
  @ApiCreatedResponse({ type: ProspectingSettingResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  createDecisionMaker(
    @Body() dto: CreateProspectingSettingDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.create(
      request.user,
      MarketingCrmSettingCategory.DECISION_MAKER,
      dto,
    );
  }

  @Get('decision-makers/:id')
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.CRM_SETTINGS_VIEW,
    DECISION_MAKERS_PERMISSIONS.view,
  )
  @ApiOperation({ summary: 'Get a prospect decision maker' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProspectingSettingResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  getDecisionMaker(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.findOne(
      request.user.tenantId,
      MarketingCrmSettingCategory.DECISION_MAKER,
      id,
    );
  }

  @Patch('decision-makers/:id')
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.CRM_SETTINGS_EDIT,
    DECISION_MAKERS_PERMISSIONS.edit,
  )
  @ApiOperation({ summary: 'Update a prospect decision maker' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProspectingSettingResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  updateDecisionMaker(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProspectingSettingDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.update(
      request.user,
      MarketingCrmSettingCategory.DECISION_MAKER,
      id,
      dto,
    );
  }

  @Delete('decision-makers/:id')
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.CRM_SETTINGS_DELETE,
    DECISION_MAKERS_PERMISSIONS.delete,
  )
  @ApiOperation({ summary: 'Archive a prospect decision maker' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProspectingSettingResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  archiveDecisionMaker(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.archive(
      request.user,
      MarketingCrmSettingCategory.DECISION_MAKER,
      id,
    );
  }

}
