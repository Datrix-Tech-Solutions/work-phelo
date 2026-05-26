import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@Controller('access')
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('operations')
@RequireFeature('operations', 'reinsurance')
@RequirePermissions('operations.reinsurance.dashboard:VIEW')
export class AccessController {
  @Get('verify')
  verify(@Req() request: Request & { user: RequestUser }) {
    return {
      status: 'ok',
      service: 'reinsurance-service',
      tenantId: request.user.tenantId,
      authorized: true,
    };
  }
}
