import { Injectable } from '@nestjs/common';
import { InternalServiceClient } from '@work-phelo/internal-auth';

export interface ModuleUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}

/** Typed wrapper over auth-service's internal module-users route. */
@Injectable()
export class AuthDirectoryClient {
  private readonly http = new InternalServiceClient({
    serviceName: 'marketing-service',
    targetName: 'auth-service',
    baseUrl: process.env.AUTH_SERVICE_URL,
    timeoutMs: Number(process.env.AUTH_SERVICE_TIMEOUT_MS),
  });

  /** Users who hold at least one permission in the module, through a role or a direct grant. */
  moduleUsers(tenantId: string, module = 'MARKETING') {
    return this.http.get<ModuleUser[]>(
      `/internal/tenants/${tenantId}/module-users`,
      { query: { module } },
    );
  }
}
