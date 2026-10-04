import { Injectable } from '@nestjs/common';
import { InternalServiceClient } from '@work-phelo/internal-auth';

export interface UserName {
  id: string;
  firstName: string;
  lastName: string;
}

/** Typed wrapper over auth-service's internal user-names route. */
@Injectable()
export class AuthUsersClient {
  private readonly http = new InternalServiceClient({
    serviceName: 'marketing-service',
    targetName: 'auth-service',
    baseUrl: process.env.AUTH_SERVICE_URL,
    timeoutMs: Number(process.env.AUTH_SERVICE_TIMEOUT_MS),
  });

  /** Names of specific users of the tenant, whatever permissions they hold. */
  names(tenantId: string, userIds: string[]) {
    return this.http.get<UserName[]>(`/internal/tenants/${tenantId}/users`, {
      query: { ids: userIds.join(',') },
    });
  }
}
