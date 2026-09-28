import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
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
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { ApiErrorResponseDto } from '../crm-settings/dto/prospecting-setting.dto';
import { CreateProspectDto } from './dto/create-prospect.dto';
import { ProspectResponseDto } from './dto/prospect-response.dto';
import { ProspectsService } from './prospects.service';

@Controller('prospects')
@ApiTags('Marketing - Prospects')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description:
    'Marketing module, leads feature or prospect permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('marketing')
@RequireFeature('marketing', 'leads')
export class ProspectsController {
  constructor(private readonly service: ProspectsService) {}

  @Post()
  @RequireAnyPermission(MarketingCrmSettingsPermission.PROSPECTS_CREATE)
  @ApiOperation({ summary: 'Create a marketing prospect' })
  @ApiCreatedResponse({ type: ProspectResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  create(
    @Body() dto: CreateProspectDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.create(request.user, dto);
  }
}
