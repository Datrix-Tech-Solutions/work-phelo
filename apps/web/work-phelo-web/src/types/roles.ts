// ── Permission Action ─────────────────────────────────────
export type PermissionAction =
  | 'VIEW'
  | 'CREATE'
  | 'EDIT'
  | 'DELETE'
  | 'APPROVE'
  | 'RUN'
  | 'EXPORT'
  | 'ASSIGN';

// ── Resource ──────────────────────────────────────────────
export interface Resource {
  id: string;
  name: string;
  module: string;
  description?: string;
  isActive: boolean;
}

// ── Permission Set ────────────────────────────────────────
export interface PermissionSetResource {
  id: string;
  permissionSetId: string;
  resourceId: string;
  action: PermissionAction;
  resource: Resource;
}

export interface PermissionSet {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  resources: PermissionSetResource[];
  _count?: { users: number };
}

// ── Company Role ──────────────────────────────────────────
export interface CompanyRole {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  /** Sidebar visibility JSON — keys are module names, values are 'none' | 'view' | 'edit' */
  permissions: Record<string, 'none' | 'view' | 'edit'>;
  createdAt: string;
  _count?: { users: number };
}

// ── User Direct Permission ────────────────────────────────
export interface UserPermission {
  id: string;
  tenantId: string;
  userId: string;
  resourceId: string;
  action: PermissionAction;
  isActive: boolean;
  grantedAt: string;
  grantedBy: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  revokedBy?: string | null;
  resource: Resource;
  user?: { firstName: string; lastName: string; email: string };
}

// ── Effective Permissions ────────────────────────────────
export interface EffectivePermissionSet {
  id: string;
  name: string;
  grantedAt: string;
  permissions: { resource: string; action: PermissionAction }[];
}

export interface UserEffectivePermissions {
  userId: string;
  systemRole: string;
  companyRole: string | null;
  directPermissions: (UserPermission & { source: 'direct' })[];
  permissionSets: EffectivePermissionSet[];
  /** Deduplicated merged list — "resource:action" strings */
  effectivePermissions: string[];
}

// ── DTOs ─────────────────────────────────────────────────
export interface CreateCompanyRoleDto {
  name: string;
  description?: string;
  permissions?: Record<string, 'none' | 'view' | 'edit'>;
}

export interface UpdateCompanyRoleDto {
  name?: string;
  description?: string;
  permissions?: Record<string, 'none' | 'view' | 'edit'>;
}

export interface PermissionSetResourceDto {
  resourceId: string;
  action: PermissionAction;
}

export interface CreatePermissionSetDto {
  name: string;
  description?: string;
  resources: PermissionSetResourceDto[];
}

export interface UpdatePermissionSetDto {
  name?: string;
  description?: string;
  resources: PermissionSetResourceDto[];
}

export interface GrantPermissionDto {
  userId: string;
  resourceId: string;
  action: PermissionAction;
  expiresAt?: string;
  reason?: string;
}

export interface RevokePermissionDto {
  userId: string;
  resourceId: string;
  action: PermissionAction;
  reason?: string;
}
