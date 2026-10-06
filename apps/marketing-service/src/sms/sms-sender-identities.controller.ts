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
  CreateSmsSenderIdentityDto,
  QuerySmsSenderIdentitiesDto,
  RejectSmsSenderIdentityDto,
  UpdateSmsSenderIdentityDto,
} from './dto/sms-sender-identity.dto';
import { SmsSenderIdentitiesService } from './sms-sender-identities.service';

const {
  SMS_SENDER_IDENTITIES_VIEW,
  SMS_SENDER_IDENTITIES_CREATE,
  SMS_SENDER_IDENTITIES_EDIT,
  SMS_SENDER_IDENTITIES_DELETE,
  SMS_SENDER_IDENTITIES_SUBMIT,
  SMS_SENDER_IDENTITIES_APPROVE,
} = MarketingCrmSettingsPermission;

type AuthedRequest = Request & { user: RequestUser };

@Controller('settings/sms-sender-identities')
@ApiTags('Marketing - SMS Sender Identities')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description:
    'Marketing module or SMS sender identity permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('marketing')
export class SmsSenderIdentitiesController {
  constructor(private readonly service: SmsSenderIdentitiesService) {}

  @Get()
  @RequireAnyPermission(SMS_SENDER_IDENTITIES_VIEW)
  @ApiOperation({ summary: 'List tenant SMS sender identities' })
  list(
    @Query() query: QuerySmsSenderIdentitiesDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.list(request.user.tenantId, query);
  }

  @Post()
  @RequireAnyPermission(SMS_SENDER_IDENTITIES_CREATE)
  @ApiOperation({ summary: 'Create a draft SMS sender identity' })
  create(
    @Body() dto: CreateSmsSenderIdentityDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.create(request.user, dto);
  }

  @Get(':id')
  @RequireAnyPermission(SMS_SENDER_IDENTITIES_VIEW)
  @ApiOperation({ summary: 'Get an SMS sender identity' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.findOne(request.user.tenantId, id);
  }

  @Patch(':id')
  @RequireAnyPermission(SMS_SENDER_IDENTITIES_EDIT)
  @ApiOperation({ summary: 'Update a draft or rejected SMS sender identity' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSmsSenderIdentityDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.update(request.user, id, dto);
  }

  @Delete(':id')
  @RequireAnyPermission(SMS_SENDER_IDENTITIES_DELETE)
  @ApiOperation({ summary: 'Archive an SMS sender identity' })
  @ApiParam({ name: 'id', format: 'uuid' })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.archive(request.user, id);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(SMS_SENDER_IDENTITIES_SUBMIT)
  @ApiOperation({
    summary: 'Submit an SMS sender identity for provider approval',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.submit(request.user, id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(SMS_SENDER_IDENTITIES_APPROVE)
  @ApiOperation({ summary: 'Mark an SMS sender identity as approved' })
  @ApiParam({ name: 'id', format: 'uuid' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.approve(request.user, id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(SMS_SENDER_IDENTITIES_APPROVE)
  @ApiOperation({ summary: 'Reject an SMS sender identity approval request' })
  @ApiParam({ name: 'id', format: 'uuid' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectSmsSenderIdentityDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.reject(request.user, id, dto);
  }

  @Post(':id/default')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(SMS_SENDER_IDENTITIES_EDIT)
  @ApiOperation({
    summary: 'Set an approved SMS sender identity as tenant default',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  setDefault(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.setDefault(request.user, id);
  }
}
