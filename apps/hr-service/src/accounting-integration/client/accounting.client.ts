import { Injectable } from '@nestjs/common';
import { InternalServiceClient } from '@work-phelo/internal-auth';

const POST_ACCRUAL_PATH = '/internal/payroll-integration/post-accrual';
const POST_ROLE_ACCRUAL_PATH =
  '/internal/payroll-integration/post-role-accrual';
const STATUS_PATH = '/internal/payroll-integration/status';

export interface PostPayrollAccrualRequest {
  tenantId: string;
  payrollRunId: string;
  periodLabel: string;
  transactionDate: string;
  totalGross: number;
  totalNet: number;
  totalPAYE: number;
  totalTier1: number;
  totalTier2: number;
  totalTier3: number;
  totalEmployerCost: number;
  totalOtherDeductions: number;
}

/** A run made with payroll configurations, already totalled by accounting role. */
export interface PostPayrollRoleAccrualRequest {
  tenantId: string;
  payrollRunId: string;
  periodLabel: string;
  transactionDate: string;
  totalGross: number;
  totalNet: number;
  totalIncomeTax: number;
  totalEmployeeSocialSecurity: number;
  totalEmployerSocialSecurity: number;
  totalPension: number;
  totalOtherDeductions: number;
}

export interface PayrollLedgerLineStatus {
  paymentState: 'OPEN' | 'PARTIALLY_PAID' | 'PAID';
  amount: number;
  outstandingAmount: number;
}

export interface PayrollSettlementStatus {
  netPay: PayrollLedgerLineStatus | null;
  incomeTax: PayrollLedgerLineStatus | null;
  socialSecurity: PayrollLedgerLineStatus | null;
}

/** What Accounting says about payroll for a tenant. Payroll has no accounting setting of its own. */
export interface PayrollAccountingStatus {
  /** The Payroll source is linked in Accounting. When false, payroll runs on its own. */
  linked: boolean;
  /** Linked and every payroll account the run needs is chosen. */
  ready: boolean;
  reason: string | null;
  /** Payroll accounts still to be chosen in Accounting. */
  missingRoles: { key: string; label: string }[];
  autoPostOnApproval: boolean;
}

/**
 * Calls accounting-service's internal endpoints through the shared internal-auth client - never
 * from a request a browser is waiting on for its own sake; these are backend-triggered side
 * effects like posting a payroll run's accrual on approval.
 */
@Injectable()
export class HrAccountingClient {
  private readonly http = new InternalServiceClient({
    serviceName: 'hr-service',
    targetName: 'accounting-service',
    baseUrl: process.env.ACCOUNTING_SERVICE_URL,
    timeoutMs: Number(process.env.ACCOUNTING_SERVICE_TIMEOUT_MS),
  });

  /** False on a deployment with no accounting-service: payroll then simply runs on its own. */
  isConfigured(): boolean {
    return this.http.isConfigured();
  }

  getPayrollAccountingStatus(tenantId: string) {
    return this.http.get<PayrollAccountingStatus>(STATUS_PATH, {
      query: { tenantId },
    });
  }

  /** Posts the run's accrual on behalf of the user who approved it. */
  postPayrollAccrual(
    payload: PostPayrollAccrualRequest,
    actingUserId: string,
  ): Promise<unknown> {
    return this.http.post(POST_ACCRUAL_PATH, { body: payload, actingUserId });
  }

  /** Posts the accrual of a run made with payroll configurations, totalled by role. */
  postPayrollRoleAccrual(
    payload: PostPayrollRoleAccrualRequest,
    actingUserId: string,
  ): Promise<unknown> {
    return this.http.post(POST_ROLE_ACCRUAL_PATH, {
      body: payload,
      actingUserId,
    });
  }

  getPayrollSettlementStatus(tenantId: string, payrollRunId: string) {
    return this.http.get<PayrollSettlementStatus>(
      `/internal/payroll-integration/${payrollRunId}/settlement-status`,
      { query: { tenantId } },
    );
  }
}
