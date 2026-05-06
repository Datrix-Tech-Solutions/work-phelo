export type TenantStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  country?: string;
  industry?: string;
  size?: string;
  status: TenantStatus;
  createdAt: string;
  moduleConfig?: Record<string, boolean>;
  featureConfig?: Record<string, Record<string, boolean>>;
}

export interface RegisterTenantPayload {
  name: string;
  slug: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  country?: string;
  industry?: string;
  size?: string;
}

// ── Tenant User ──────────────────────────────────────────
export interface TenantUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'EMPLOYEE';
  status: string;
}

// ── Audit Log ────────────────────────────────────────────
export interface AuditLog {
  id: string;
  resource: string;
  action: string;
  createdAt: string;
  changes?: { after?: Record<string, unknown> };
}

export interface AuditData {
  logs: AuditLog[];
}

// ── Company (SuperAdmin table display model) ─────────────
export interface Company {
  id: string;
  name: string;
  dateCreated: string;
  contact: string;
  industry: string;
  status: TenantStatus;
}
