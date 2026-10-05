import { Injectable } from '@nestjs/common';
import { InternalServiceClient } from '@work-phelo/internal-auth';
import { registeredModuleFor } from '../../ledger/source-transactions/source-registry';

/**
 * Tells hr-service what happened to a payroll run's liabilities in Accounting. Used for
 * backend-triggered side effects, never from a request a browser is waiting on. Where it
 * calls comes from the Payroll entry in the source registry.
 */
@Injectable()
export class AccountingHrClient {
  notifyNetPaySettled(tenantId: string, payrollRunId: string) {
    return this.post(`${payrollRunId}/net-pay-settled`, tenantId);
  }

  notifyFullySettled(tenantId: string, payrollRunId: string) {
    return this.post(`${payrollRunId}/fully-settled`, tenantId);
  }

  private post(suffix: string, tenantId: string) {
    const registration = registeredModuleFor('HR');
    const callback = registration?.callback;
    const client = new InternalServiceClient({
      serviceName: 'accounting-service',
      targetName: registration?.serviceName ?? 'hr-service',
      baseUrl: callback ? process.env[callback.baseUrlEnv] : undefined,
      timeoutMs: Number(process.env.HR_SERVICE_TIMEOUT_MS),
    });
    return client.post(`${callback?.path ?? ''}/${suffix}`, {
      body: { tenantId },
    });
  }
}
