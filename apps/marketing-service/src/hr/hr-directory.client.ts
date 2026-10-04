import { Injectable } from '@nestjs/common';
import { InternalServiceClient } from '@work-phelo/internal-auth';

export interface DirectoryPerson {
  employeeId: string;
  /** The login account linked to the employee, when there is one. */
  userId?: string | null;
  name: string;
  department: string | null;
  jobTitle?: string | null;
  email?: string | null;
}

export interface ResolvedDirectory {
  /** Employee linked to the user, or null when the user has no employee record. */
  person: DirectoryPerson | null;
  people: DirectoryPerson[];
}

const BASE = '/internal/employee-directory';

/** Typed wrapper over hr-service's internal employee directory routes. */
@Injectable()
export class HrDirectoryClient {
  private readonly http = new InternalServiceClient({
    serviceName: 'marketing-service',
    targetName: 'hr-service',
    baseUrl: process.env.HR_SERVICE_URL,
    timeoutMs: Number(process.env.HR_SERVICE_TIMEOUT_MS),
  });

  list(tenantId: string) {
    return this.http.get<DirectoryPerson[]>(BASE, { query: { tenantId } });
  }

  resolve(
    tenantId: string,
    input: { userId?: string; employeeIds?: string[]; userIds?: string[] },
  ) {
    return this.http.post<ResolvedDirectory>(`${BASE}/resolve`, {
      body: { tenantId, ...input },
    });
  }
}
