import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { InternalServiceAuthGuard } from '../auth/guards/internal-service-auth.guard';
import { TenantConfigService } from './tenant-config.service';

@ApiTags('Internal Tenant Modules')
@Controller('internal/tenants/:tenantId/modules')
@UseGuards(InternalServiceAuthGuard)
export class TenantModulesInternalController {
  constructor(private readonly config: TenantConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Which modules a tenant has enabled, for an internal service',
    description:
      'Service-authenticated. Lets a service confirm that a tenant exists and uses a module before acting on it on a platform administrator’s behalf.',
  })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  get(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.config.getModuleConfig(tenantId);
  }
}
