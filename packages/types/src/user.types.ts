export enum RoleType {
  SUPER_ADMIN = 'SUPER_ADMIN',
  TENANT_ADMIN = 'TENANT_ADMIN',
  EMPLOYEE = 'EMPLOYEE',
}

/** Shape of the JWT payload issued by the auth service */
/** Where a token may be used. "careers" tokens only reach the job-posting endpoints. */
export type TokenScope = 'careers';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tenantId: string;
  tenantSlug: string;
  tenantName?: string;
  firstName?: string;
  companyRoleId?: string | null;
  moduleConfig?: Record<string, boolean>;
  featureConfig?: Record<string, Record<string, boolean>>;
  integrationConfig?: Record<string, boolean>;
  labelConfig?: Record<string, string>;
  permissions?: string[];
  /** Set on tokens issued to the careers site; the gateway restricts what they can call. */
  scope?: TokenScope;
  iat?: number;
  exp?: number;
}

/** Shape of request.user after JWT validation in any service */
export interface RequestUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  firstName: string;
  companyRoleId?: string | null;
  avatarUrl?: string | null;
  moduleConfig: Record<string, boolean>;
  featureConfig: Record<string, Record<string, boolean>>;
  integrationConfig?: Record<string, boolean>;
  labelConfig?: Record<string, string>;
  permissions: string[];
}
