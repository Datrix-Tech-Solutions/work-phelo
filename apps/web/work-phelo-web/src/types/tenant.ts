export type TenantStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

export type TenantSource = 'PLATFORM' | 'WEBSITE';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  country?: string;
  address?: string;
  currency?: string;
  industry?: string;
  size?: string;
  status: TenantStatus;
  /** WEBSITE = a recruiter who signed up on the careers site. */
  source?: TenantSource;
  /** Shows the verified check mark next to the company on the careers site. */
  isVerified?: boolean;
  /** Whether the tenant's first user has confirmed their email (a recruiter must before being verified). */
  emailConfirmed?: boolean;
  createdAt: string;
  moduleConfig?: Record<string, boolean>;
  featureConfig?: Record<string, Record<string, boolean>>;
  /** Company-chosen display names for module features, singular (e.g. { projects: 'Case' }). */
  labelConfig?: Record<string, string>;
}

export interface RegisterTenantPayload {
  name: string;
  slug: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  country?: string;
  address?: string;
  currency?: string;
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
  resourceId?: string;
  action: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
  ipAddress?: string;
  userAgent?: string;
  status?: 'SUCCESS' | 'FAILURE';
  failureReason?: string;
  createdAt: string;
}

export interface AuditMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditData {
  logs: AuditLog[];
  meta: AuditMeta;
}

// ── Company (SuperAdmin table display model) ─────────────
export interface Company {
  id: string;
  name: string;
  email: string;
  dateCreated: string;
  contact: string;
  industry: string;
  status: TenantStatus;
  isVerified: boolean;
}
