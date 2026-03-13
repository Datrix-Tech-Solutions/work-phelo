export enum RoleType {
  SUPER_ADMIN = 'SUPER_ADMIN',
  TENANT_ADMIN = 'TENANT_ADMIN',
  EMPLOYEE = 'EMPLOYEE',
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  roleType: RoleType;
  isActive: boolean;
  mfaEnabled: boolean;
}

export interface JwtPayload {
  sub: string;
  tenantId: string;
  tenantSlug: string;
  roleType: RoleType;
  permissions: string[];
  iat?: number;
  exp?: number;
}
