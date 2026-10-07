import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InternalServiceClientError } from '@work-phelo/internal-auth';
import { Request } from 'express';
import {
  TenantModules,
  TenantModulesClient,
} from '../../sms/tenant-modules.client';

/**
 * For platform routes that act on the tenant named in the path: that tenant must exist and have
 * Marketing switched on. (ModuleGuard answers the same question for the caller's own tenant.)
 */
@Injectable()
export class TenantMarketingEnabledGuard implements CanActivate {
  constructor(private readonly tenants: TenantModulesClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request<{ tenantId: string }>>();

    let modules: TenantModules;
    try {
      modules = await this.tenants.get(request.params.tenantId);
    } catch (error) {
      if (
        error instanceof InternalServiceClientError &&
        error.statusCode === 404
      ) {
        throw new NotFoundException('Tenant not found');
      }
      throw new ServiceUnavailableException(
        'Could not confirm the company’s modules. Please try again.',
      );
    }

    if (!modules.moduleConfig?.marketing) {
      throw new BadRequestException(
        'The Marketing module is not enabled for this company.',
      );
    }
    return true;
  }
}
