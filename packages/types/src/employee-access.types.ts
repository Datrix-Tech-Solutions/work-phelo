export const EmployeeAccessPatterns = {
  execute: 'auth.employee_access.execute.v1',
  finalize: 'auth.employee_access.finalize.v1',
  status: 'auth.employee_access.status.v1',
  verifyLink: 'hr.employee_access.verify_link.v1',
  notify: 'notification.employee_access.invite.v1',
  lifecycle: 'auth.employee_access.lifecycle.v1',
  account: 'auth.employee_access.account.v1',
  snapshot: 'auth.employee_access.snapshot.v1',
  recover: 'auth.employee_access.recover.v1',
  receipt: 'notification.employee_access.receipt.v1',
  offboarded: 'hr.employee_access.offboarded.v1',
} as const;

export interface EmployeeAccessSnapshotRequest {
  tenantId: string;
  actorUserId: string;
  userIds: string[];
}
export interface EmployeeAccessSnapshot {
  items: { userId: string; status: EmployeeAccessAccount['status'] }[];
  capturedAt: string;
}
export interface EmployeeAccessRecovery extends EmployeeAccessReference {
  employeePermission: 'CREATE' | 'EDIT';
  recoveryId: string;
  operatorUserId: string;
  reason: string;
  action: 'GRANT' | 'SUSPEND' | 'RESTORE' | 'RESEND';
}
export interface EmployeeAccessRecoveryResult {
  outcome: 'REQUEUE' | 'FAILED' | 'BLOCKED';
  errorCode: string | null;
}
export interface EmployeeInviteReceiptRequest {
  operationId: string;
  tenantId: string;
  userId: string;
}
export interface EmployeeInviteReceiptState {
  status: 'MISSING' | 'PROVIDER_ACCEPTED' | 'RETRY' | 'BLOCKED';
  errorCode: string | null;
}

export interface EmployeeAccessLifecycle extends EmployeeAccessReference {
  userId: string;
  action: 'SUSPEND' | 'RESTORE' | 'RESEND';
  reason: string;
  idempotencyKey: string;
}

export interface EmployeeAccessAccountRequest {
  tenantId: string;
  actorUserId: string;
  employeeId: string;
  userId: string;
}

export interface EmployeeAccessAccount {
  status:
    | 'MISSING'
    | 'PROVISIONING'
    | 'PROVISIONING_FAILED'
    | 'ACTIVE'
    | 'SUSPENDED'
    | 'INACTIVE'
    | 'INVITED'
    | 'INVITE_EXPIRED'
    | 'INCONSISTENT';
}

export interface EmployeeAccessLifecycleResult {
  operationId: string;
  tenantId: string;
  employeeId: string;
  userId: string;
  status: 'COMPLETED' | 'READY' | 'FAILED' | 'PAUSED';
  errorCode: string | null;
}

export interface EmployeeAccessCommandPayload {
  operationId: string;
  tenantId: string;
  employeeId: string;
  actorUserId: string;
  idempotencyKey: string;
  requestHash: string;
  employeePermission: 'CREATE' | 'EDIT';
  email: string;
  firstName: string;
  lastName: string;
}

export interface EmployeeAccessReference {
  operationId: string;
  tenantId: string;
  employeeId: string;
  actorUserId: string;
  requestHash: string;
  userId?: string;
}

export interface EmployeeAccessCommandResult {
  operationId: string;
  tenantId: string;
  employeeId: string;
  userId: string | null;
  status: 'PROVISIONED' | 'READY' | 'PROVIDER_ACCEPTED' | 'FAILED' | 'PAUSED' | 'EXPIRED';
  errorCode: string | null;
}

export interface EmployeeAccessInvite {
  operationId: string;
  tenantId: string;
  userId: string;
  email: string;
  firstName: string;
  tenantName: string;
  acceptInviteUrl: string;
  expiresAt: string;
}

export interface EmployeeAccessInviteResult {
  status: 'PROVIDER_ACCEPTED' | 'RETRY' | 'EXPIRED' | 'UNKNOWN';
}
