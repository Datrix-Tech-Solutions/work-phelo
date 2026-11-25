import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { RequestUser } from '@work-phelo/types';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantDocumentRenderResponseDto } from './dto/tenant-document-render.dto';
import { DOCUMENT_TEMPLATE_DOCUMENT_KEYS } from './dto/tenant-document-template.dto';
import { TenantDocumentProfileService } from './tenant-document-profile.service';
import { TenantDocumentTemplateService } from './tenant-document-template.service';

type AuthenticatedRequest = Request & { user: RequestUser };

/** Holding any of these means the user can already see the transactions being printed. */
export const DOCUMENT_RENDER_PERMISSIONS = [
  'accounting.transactions:VIEW',
  'accounting.receivables:VIEW',
  'accounting.payables:VIEW',
];

@ApiTags('Tenant Document Template')
@ApiBearerAuth('access-token')
@Controller('tenants/:tenantId/document-render')
@UseGuards(JwtAuthGuard)
export class TenantDocumentRenderController {
  constructor(
    private readonly templates: TenantDocumentTemplateService,
    private readonly profiles: TenantDocumentProfileService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get what is needed to render a company document',
    description:
      'Read-only template and company identity for users who view accounting documents. Bank accounts, tax numbers and storage keys are not included. The signature image is returned only when the template places it on an accounting document.',
  })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiOkResponse({ type: TenantDocumentRenderResponseDto })
  @ApiForbiddenResponse({ description: 'No access to company documents.' })
  async get(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<TenantDocumentRenderResponseDto> {
    this.assertAccess(tenantId, request.user);
    const [template, profile] = await Promise.all([
      this.templates.get(tenantId),
      this.profiles.get(tenantId),
    ]);
    const signs =
      template.config.signatureEnabled &&
      DOCUMENT_TEMPLATE_DOCUMENT_KEYS.some(
        (key) => key !== 'payslip' && template.config.signatureRules[key],
      );

    return {
      template: {
        config: template.config,
        version: template.version,
        defaultsApplied: template.defaultsApplied,
        watermarkUrl: template.watermarkUrl,
      },
      profile: {
        displayName: profile.displayName,
        legalName: profile.legalName,
        registrationNumber: profile.registrationNumber,
        physicalAddress: profile.physicalAddress,
        postalAddress: profile.postalAddress,
        phone: profile.phone,
        email: profile.email,
        website: profile.website,
        logoUrl: profile.logoUrl ?? null,
        signatureUrl: signs ? (profile.signatureUrl ?? null) : null,
        authorizedSignatoryName: signs ? profile.authorizedSignatoryName : null,
        authorizedSignatoryTitle: signs
          ? profile.authorizedSignatoryTitle
          : null,
      },
    };
  }

  private assertAccess(tenantId: string, user: RequestUser): void {
    if (user.role === 'SUPER_ADMIN') return;
    const allowed =
      tenantId === user.tenantId &&
      (user.role === 'TENANT_ADMIN' ||
        DOCUMENT_RENDER_PERMISSIONS.some((permission) =>
          user.permissions?.includes(permission),
        ));
    if (!allowed) {
      throw new ForbiddenException(
        "You don't have permission to access this. Contact your administrator.",
      );
    }
  }
}
