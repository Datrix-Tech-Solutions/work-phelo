import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { RequestUser } from '@work-phelo/types';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  TenantDocumentTemplateResponseDto,
  UpsertTenantDocumentTemplateDto,
} from './dto/tenant-document-template.dto';
import { TenantDocumentTemplateService } from './tenant-document-template.service';

type AuthenticatedRequest = Request & { user: RequestUser };

@ApiTags('Tenant Document Template')
@ApiBearerAuth('access-token')
@Controller('tenants/:tenantId/document-template')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'TENANT_ADMIN')
export class TenantDocumentTemplateController {
  constructor(private readonly templates: TenantDocumentTemplateService) {}

  @Get()
  @ApiOperation({
    summary: 'Get tenant document template',
    description:
      'Returns defaults (version 0) when no template has been saved. The watermark image is exposed only as a short-lived signed URL.',
  })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiOkResponse({ type: TenantDocumentTemplateResponseDto })
  get(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.assertAccess(tenantId, request.user);
    return this.templates.get(tenantId);
  }

  @Put()
  @ApiOperation({
    summary: 'Save tenant document template',
    description:
      'Replaces the layout settings and increments the version. Pass expectedVersion to reject saves over a newer version.',
  })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiBody({ type: UpsertTenantDocumentTemplateDto })
  @ApiOkResponse({ type: TenantDocumentTemplateResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid template values.' })
  @ApiConflictResponse({ description: 'Template changed since it was loaded.' })
  upsert(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: UpsertTenantDocumentTemplateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    this.assertAccess(tenantId, request.user);
    return this.templates.upsert(tenantId, request.user.id, dto);
  }

  @Post('watermark')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload the private watermark image' })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: TenantDocumentTemplateResponseDto })
  @ApiBadRequestResponse({
    description: 'Missing, unsupported or oversized image.',
  })
  uploadWatermark(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    this.assertAccess(tenantId, request.user);
    return this.templates.uploadWatermark(tenantId, request.user.id, file);
  }

  @Delete('watermark')
  @ApiOperation({ summary: 'Remove the watermark image' })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiOkResponse({ type: TenantDocumentTemplateResponseDto })
  removeWatermark(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.assertAccess(tenantId, request.user);
    return this.templates.removeWatermark(tenantId, request.user.id);
  }

  private assertAccess(tenantId: string, user: RequestUser): void {
    if (user.role === 'TENANT_ADMIN' && tenantId !== user.tenantId) {
      throw new ForbiddenException(
        'You can only manage document settings for your own company.',
      );
    }
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'TENANT_ADMIN') {
      throw new ForbiddenException(
        'Only Super Admins and Tenant Admins can manage document settings.',
      );
    }
  }
}
