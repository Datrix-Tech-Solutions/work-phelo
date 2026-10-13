import { Injectable } from '@nestjs/common';
import { InternalServiceClient } from '@work-phelo/internal-auth';

export interface TenantModules {
  moduleConfig: Record<string, boolean>;
}

/** Typed wrapper over auth-service's internal route for a tenant's enabled modules. */
@Injectable()
export class TenantModulesClient {
  private readonly http = new InternalServiceClient({
    serviceName: 'marketing-service',
    targetName: 'auth-service',
    baseUrl: process.env.AUTH_SERVICE_URL,
    timeoutMs: Number(process.env.AUTH_SERVICE_TIMEOUT_MS),
  });

  get(tenantId: string) {
    return this.http.get<TenantModules>(
      `/internal/tenants/${tenantId}/modules`,
    );
  }
}
